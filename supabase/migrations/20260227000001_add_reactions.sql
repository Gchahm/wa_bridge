-- =============================================================================
-- Migration: add_reactions
-- Purpose:   Add wa_bridge.reactions table to store per-message emoji reactions
--            from WhatsApp, with RLS policies, grants, a Supabase Realtime
--            broadcast trigger, and a public view for PostgREST access.
--
--            Each reaction is uniquely identified by the triple
--            (message_id, chat_id, sender_id): a sender can only hold one
--            active reaction per message at a time. An update (or removal and
--            re-send) from the bridge simply UPSERTs the row, replacing the
--            previous emoji.
--
--            The FK to wa_bridge.messages is validated immediately.
--            The FK to wa_bridge.contacts is left NOT VALIDATED because
--            reactions can arrive before the corresponding contact record is
--            created by the bridge — enforcing it would cause unnecessary
--            constraint violations during normal operation.
--
--            Depends on: 20260219000001_tables.sql
-- =============================================================================

-- =============================================================================
-- TABLE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- wa_bridge.reactions
--
-- One row per (message, chat, sender) triple. The emoji column stores the
-- Unicode emoji string that the sender chose (e.g. "👍"). A NULL emoji would
-- represent a retraction, but the bridge is expected to DELETE the row instead.
-- timestamp is the protocol-level time supplied by WhatsApp; created_at is the
-- database insertion time used for ordering when timestamp is absent.
-- -----------------------------------------------------------------------------

CREATE TABLE "wa_bridge"."reactions" (
    "message_id"  text                        NOT NULL,
    "chat_id"     text                        NOT NULL,
    "sender_id"   text                        NOT NULL,
    "emoji"       text                        NOT NULL,
    "timestamp"   timestamp without time zone,
    "created_at"  timestamp without time zone          DEFAULT now(),
    PRIMARY KEY (message_id, chat_id, sender_id)
);

ALTER TABLE "wa_bridge"."reactions" ENABLE ROW LEVEL SECURITY;

-- Every reaction must reference a message that already exists in the database.
-- NOT VALID defers the historical-data check; VALIDATE then confirms all rows
-- currently in the table satisfy the constraint before the migration commits.
ALTER TABLE "wa_bridge"."reactions"
    ADD CONSTRAINT "fk_reactions_message"
    FOREIGN KEY (message_id, chat_id) REFERENCES wa_bridge.messages (message_id, chat_id)
    NOT VALID;
ALTER TABLE "wa_bridge"."reactions" VALIDATE CONSTRAINT "fk_reactions_message";

-- sender_id references the contacts table. NOT VALID only — reactions can
-- arrive from WhatsApp before the bridge has inserted the corresponding contact
-- row, so validating this FK would cause spurious constraint failures.
ALTER TABLE "wa_bridge"."reactions"
    ADD CONSTRAINT "fk_reactions_sender"
    FOREIGN KEY (sender_id) REFERENCES wa_bridge.contacts (phone_number)
    NOT VALID;

-- Supporting index for queries that fetch all reactions for a given message.
CREATE INDEX idx_reactions_message_id_chat_id
    ON wa_bridge.reactions (message_id, chat_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- wa_bridge_app — full access (the bridge process owns reaction data)
-- -----------------------------------------------------------------------------

CREATE POLICY "wa_bridge_app_reactions"
    ON "wa_bridge"."reactions"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- authenticated — read-only (frontend displays reactions; it never writes them)
-- -----------------------------------------------------------------------------

CREATE POLICY "authenticated_read_reactions"
    ON "wa_bridge"."reactions"
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (true);

-- =============================================================================
-- TABLE-LEVEL GRANTS
-- =============================================================================

-- Bridge application needs full DML (INSERT on new reaction, UPDATE on emoji
-- change, DELETE on retraction).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "wa_bridge"."reactions" TO "wa_bridge_app";

-- Authenticated users may read reactions.
GRANT SELECT ON TABLE "wa_bridge"."reactions" TO "authenticated";

-- n8n workflows can read reaction data for automation purposes.
GRANT SELECT ON TABLE "wa_bridge"."reactions" TO "n8n_app";

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Realtime broadcast trigger
--
-- Broadcasts row-level changes through Supabase Realtime on a per-chat topic
-- so that frontend clients subscribed to 'reactions:<chat_id>' receive live
-- updates for the conversation they have open — consistent with the pattern
-- used by broadcast_message_changes.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION wa_bridge.broadcast_reaction_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM realtime.broadcast_changes(
        'reactions:' || COALESCE(NEW.chat_id, OLD.chat_id),
        TG_OP,          -- event     (INSERT / UPDATE / DELETE)
        TG_OP,          -- operation
        TG_TABLE_NAME,
        TG_TABLE_SCHEMA,
        NEW,
        OLD
    );
    RETURN NULL;
END;
$$;

CREATE TRIGGER broadcast_reaction_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON wa_bridge.reactions
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.broadcast_reaction_changes();

-- =============================================================================
-- VIEW (public schema)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.reactions — direct projection of wa_bridge.reactions
--
-- security_invoker = on ensures that RLS policies on the underlying
-- wa_bridge.reactions table are applied to every query that goes through
-- this view (consistent with all other public views in this project).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.reactions
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.reactions;

GRANT SELECT ON public.reactions TO authenticated;
