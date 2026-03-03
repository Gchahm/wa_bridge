-- =============================================================================
-- Migration: merge_lid_chats
-- Purpose:   Merge WhatsApp @lid chats into their @s.whatsapp.net equivalents.
--
--            WhatsApp uses two JID formats for the same 1:1 contact depending
--            on which device reported the event:
--              - {lid}@lid          — Linked Identity, from phone/primary device
--              - {pn}@s.whatsapp.net — Phone-number based, from companion devices
--
--            The whatsmeow library maintains a mapping table
--            wa_meow.whatsmeow_lid_map (lid text, pn text) that translates
--            between the two. This migration finds all wa_bridge.chats rows
--            whose chat_id ends with @lid, resolves the target @s.whatsapp.net
--            chat_id via that map, and merges the data:
--
--              Case A — target @s.whatsapp.net chat already exists:
--                1. Move messages from the @lid chat to the target chat,
--                   skipping duplicates (keep the @s.whatsapp.net version).
--                2. Move reactions similarly.
--                3. Update target chat's last_message_at to MAX of both, and
--                   created_at to MIN of both, and preserve name/contact_phone_number
--                   from whichever chat has them.
--                4. Delete the now-empty @lid chat.
--
--              Case B — target @s.whatsapp.net chat does NOT exist:
--                1. Update chat_id in-place — ON UPDATE CASCADE FKs on
--                   outgoing_messages and bridge_commands follow automatically.
--                2. Backfill contact_phone_number from the new chat_id.
--
--            FK handling:
--              - fk_messages_chat (NO ACTION) and fk_reactions_message (NO ACTION)
--                are dropped before the data movement and recreated afterwards,
--                because they do not cascade and would otherwise block the UPDATEs.
--
--            The migration is a no-op if wa_meow.whatsmeow_lid_map is empty.
--
--            Depends on: 20260219000001_tables.sql, 20260227000001_add_reactions.sql,
--                        20260303000001_add_bridge_commands.sql
-- =============================================================================

-- =============================================================================
-- STEP 1: Drop non-cascading FKs that would block data movement
-- =============================================================================

-- reactions.fk_reactions_message → wa_bridge.messages(message_id, chat_id)
-- This FK has NO ACTION — dropping it lets us UPDATE reactions.chat_id freely.
ALTER TABLE wa_bridge.reactions
    DROP CONSTRAINT IF EXISTS fk_reactions_message;

-- messages.fk_messages_chat → wa_bridge.chats(chat_id)
-- This FK has NO ACTION — dropping it lets us UPDATE messages.chat_id freely
-- and also allows us to DELETE the source @lid chat after data migration.
ALTER TABLE wa_bridge.messages
    DROP CONSTRAINT IF EXISTS fk_messages_chat;

-- =============================================================================
-- STEP 2: Build the LID → PN mapping and perform the merge
-- =============================================================================

DO $$
DECLARE
    r RECORD;
    v_lid_chat_id  text;
    v_pn_chat_id   text;
    v_target_exists boolean;
BEGIN
    -- Iterate over every @lid chat that has a known PN mapping.
    -- We process one row at a time so that the logic for Case A vs Case B
    -- is explicit and safe within a single transaction.
    FOR r IN
        SELECT
            c.chat_id                                   AS lid_chat_id,
            (m.pn || '@s.whatsapp.net')                 AS pn_chat_id,
            c.name                                      AS lid_name,
            c.created_at                                AS lid_created_at,
            c.last_message_at                           AS lid_last_message_at,
            c.contact_phone_number                      AS lid_contact_phone_number,
            c.is_group                                  AS lid_is_group,
            c.agent_active                              AS lid_agent_active
        FROM wa_bridge.chats AS c
        JOIN wa_meow.whatsmeow_lid_map AS m
            ON c.chat_id = (m.lid || '@lid')
        WHERE c.chat_id LIKE '%@lid'
        ORDER BY c.chat_id   -- deterministic ordering
    LOOP
        v_lid_chat_id := r.lid_chat_id;
        v_pn_chat_id  := r.pn_chat_id;

        -- Does the target @s.whatsapp.net chat already exist?
        SELECT EXISTS (
            SELECT 1 FROM wa_bridge.chats WHERE chat_id = v_pn_chat_id
        ) INTO v_target_exists;

        IF v_target_exists THEN
            -- ----------------------------------------------------------------
            -- Case A: target chat already exists — move data then delete lid
            -- ----------------------------------------------------------------

            -- 2A-1. Move messages that do NOT conflict on the composite PK.
            --       A conflict means (message_id, v_pn_chat_id) already exists;
            --       in that case we keep the @s.whatsapp.net version and discard
            --       the @lid duplicate.
            UPDATE wa_bridge.messages AS msg
            SET chat_id = v_pn_chat_id
            WHERE msg.chat_id = v_lid_chat_id
              AND NOT EXISTS (
                  SELECT 1
                  FROM wa_bridge.messages AS existing
                  WHERE existing.message_id = msg.message_id
                    AND existing.chat_id    = v_pn_chat_id
              );

            -- Delete any remaining @lid messages that were duplicates
            -- (i.e. the UPDATE above left them behind).
            DELETE FROM wa_bridge.messages
            WHERE chat_id = v_lid_chat_id;

            -- 2A-2. Move reactions for non-conflicting (message_id, chat_id, sender_id).
            --       Reactions now reference the updated messages, so we move them
            --       to (message_id, v_pn_chat_id, sender_id) if no such row exists yet.
            UPDATE wa_bridge.reactions AS rxn
            SET chat_id = v_pn_chat_id
            WHERE rxn.chat_id = v_lid_chat_id
              AND NOT EXISTS (
                  SELECT 1
                  FROM wa_bridge.reactions AS existing
                  WHERE existing.message_id = rxn.message_id
                    AND existing.chat_id    = v_pn_chat_id
                    AND existing.sender_id  = rxn.sender_id
              );

            -- Delete any remaining @lid reactions that were duplicates.
            DELETE FROM wa_bridge.reactions
            WHERE chat_id = v_lid_chat_id;

            -- 2A-3. Merge chat metadata into the target.
            UPDATE wa_bridge.chats AS target
            SET
                -- Keep the earliest creation time between the two chats.
                created_at      = LEAST(target.created_at, r.lid_created_at),
                -- Keep the most recent last_message_at.
                last_message_at = GREATEST(target.last_message_at, r.lid_last_message_at),
                -- Prefer non-NULL name: if target lacks one, use LID's.
                name            = COALESCE(target.name, r.lid_name),
                -- Prefer non-NULL contact_phone_number similarly.
                contact_phone_number = COALESCE(
                    target.contact_phone_number,
                    r.lid_contact_phone_number
                ),
                -- If either chat had the agent active, keep it active.
                agent_active    = (target.agent_active OR r.lid_agent_active)
            WHERE target.chat_id = v_pn_chat_id;

            -- 2A-4. Delete the now-empty @lid chat.
            --       outgoing_messages and bridge_commands have ON UPDATE CASCADE
            --       but not ON DELETE CASCADE, so we must handle any remaining
            --       rows referencing the @lid chat_id before deleting it.
            --       In practice those tables should be empty for @lid chats, but
            --       we migrate them defensively to avoid a constraint violation.

            -- Move any outstanding outgoing_messages to the PN chat.
            UPDATE wa_bridge.outgoing_messages
            SET chat_id = v_pn_chat_id
            WHERE chat_id = v_lid_chat_id;

            -- Move any bridge_commands to the PN chat.
            UPDATE wa_bridge.bridge_commands
            SET chat_id = v_pn_chat_id
            WHERE chat_id = v_lid_chat_id;

            -- Now it is safe to delete the @lid chat.
            DELETE FROM wa_bridge.chats
            WHERE chat_id = v_lid_chat_id;

        ELSE
            -- ----------------------------------------------------------------
            -- Case B: target does NOT exist — rename in-place.
            --         ON UPDATE CASCADE on outgoing_messages and bridge_commands
            --         means those rows follow automatically.
            --         messages and reactions do NOT cascade, but since we dropped
            --         fk_messages_chat above and reactions has no direct FK to
            --         chats, we UPDATE them explicitly.
            -- ----------------------------------------------------------------

            -- Update messages first (FK to chats was dropped above).
            UPDATE wa_bridge.messages
            SET chat_id = v_pn_chat_id
            WHERE chat_id = v_lid_chat_id;

            -- Update reactions (FK is to messages, not chats directly, but
            -- the chat_id column must still reflect the new value).
            UPDATE wa_bridge.reactions
            SET chat_id = v_pn_chat_id
            WHERE chat_id = v_lid_chat_id;

            -- Rename the chat itself. This triggers ON UPDATE CASCADE on
            -- outgoing_messages and bridge_commands automatically.
            UPDATE wa_bridge.chats
            SET
                chat_id              = v_pn_chat_id,
                -- Backfill contact_phone_number from the new chat_id.
                -- Only set it when the chat is not a group and the contact
                -- actually exists, to keep the FK constraint satisfied.
                contact_phone_number = CASE
                    WHEN r.lid_is_group THEN r.lid_contact_phone_number
                    WHEN EXISTS (
                        SELECT 1
                        FROM wa_bridge.contacts
                        WHERE phone_number = split_part(v_pn_chat_id, '@', 1)
                    ) THEN split_part(v_pn_chat_id, '@', 1)
                    ELSE r.lid_contact_phone_number
                END
            WHERE chat_id = v_lid_chat_id;

        END IF;
    END LOOP;
END;
$$;

-- =============================================================================
-- STEP 3: Recreate the non-cascading FKs that were dropped in Step 1
-- =============================================================================

-- messages → chats (NO ACTION, same semantics as original migration)
ALTER TABLE wa_bridge.messages
    ADD CONSTRAINT fk_messages_chat
    FOREIGN KEY (chat_id)
    REFERENCES wa_bridge.chats (chat_id)
    NOT VALID;

ALTER TABLE wa_bridge.messages
    VALIDATE CONSTRAINT fk_messages_chat;

-- reactions → messages (NO ACTION, composite FK, same as original migration)
ALTER TABLE wa_bridge.reactions
    ADD CONSTRAINT fk_reactions_message
    FOREIGN KEY (message_id, chat_id)
    REFERENCES wa_bridge.messages (message_id, chat_id)
    NOT VALID;

ALTER TABLE wa_bridge.reactions
    VALIDATE CONSTRAINT fk_reactions_message;
