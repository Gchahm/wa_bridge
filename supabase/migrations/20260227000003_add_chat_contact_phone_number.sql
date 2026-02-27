-- =============================================================================
-- Migration: add_chat_contact_phone_number
-- Purpose:   Link each individual (non-group) chat to its corresponding contact
--            by storing the contact's phone number directly on the chats row.
--
--            WhatsApp individual chat IDs have the format "<phone>@s.whatsapp.net".
--            The phone number is extracted from this suffix when backfilling.
--
--            Depends on: 20260219000001_tables.sql, 20260219000002_views.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add the nullable column
--    Nullable because group chats have no associated contact phone number,
--    and individual chats added before this migration need a backfill pass.
-- -----------------------------------------------------------------------------

ALTER TABLE wa_bridge.chats
    ADD COLUMN IF NOT EXISTS contact_phone_number TEXT;

-- -----------------------------------------------------------------------------
-- 2. Add foreign key to wa_bridge.contacts(phone_number)
--    ON DELETE SET NULL — if the contact row is deleted the chat is not lost,
--                         but the link is cleared gracefully.
--    ON UPDATE CASCADE  — if a contact's phone_number PK changes (rare but
--                         possible after number porting), the FK follows.
-- -----------------------------------------------------------------------------

ALTER TABLE wa_bridge.chats
    ADD CONSTRAINT chats_contact_phone_number_fkey
        FOREIGN KEY (contact_phone_number)
        REFERENCES wa_bridge.contacts (phone_number)
        ON DELETE SET NULL
        ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 3. Index to support FK lookups and any future joins/filters on this column
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS chats_contact_phone_number_idx
    ON wa_bridge.chats (contact_phone_number);

-- -----------------------------------------------------------------------------
-- 4. Backfill existing individual chats
--    Extract the phone number from chat_id by splitting on '@' and keep only
--    rows that end with '@s.whatsapp.net' (individual chats, not groups).
--    Only update where a matching contact row actually exists — otherwise leave
--    the column NULL so the FK constraint is satisfied.
-- -----------------------------------------------------------------------------

UPDATE wa_bridge.chats AS ch
SET contact_phone_number = split_part(ch.chat_id, '@', 1)
FROM wa_bridge.contacts AS co
WHERE ch.chat_id LIKE '%@s.whatsapp.net'
  AND split_part(ch.chat_id, '@', 1) = co.phone_number
  AND ch.contact_phone_number IS NULL;

-- -----------------------------------------------------------------------------
-- 5. Recreate public.chats view
--    The underlying SELECT * will already pick up the new column, but we
--    recreate it explicitly so the view definition in the catalog is current
--    and any dependent tooling (e.g. PostgREST schema cache) reflects the
--    exact column list.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.chats
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.chats;

-- -----------------------------------------------------------------------------
-- 6. Recreate public.chats_with_preview to expose contact_phone_number
--    DROP + CREATE is required because CREATE OR REPLACE cannot change column
--    order or insert new columns between existing ones.
-- -----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.chats_with_preview;

CREATE VIEW public.chats_with_preview
    WITH (security_invoker = on)
    AS
SELECT
    c.chat_id,
    c.is_group,
    c.name,
    c.created_at,
    c.last_message_at,
    c.contact_phone_number,
    lm.last_message_content,
    lm.last_message_timestamp,
    lm.last_message_type,
    lm.last_message_is_from_me
FROM wa_bridge.chats AS c
LEFT JOIN LATERAL (
    SELECT
        CASE
            WHEN m.message_type = 'text' AND m.content IS NOT NULL
                THEN m.content
            WHEN m.media_type IS NOT NULL
                THEN '[' || m.media_type || ']'
            ELSE
                '[' || m.message_type || ']'
        END                                          AS last_message_content,
        COALESCE(m.timestamp, m.created_at)          AS last_message_timestamp,
        m.message_type                               AS last_message_type,
        m.is_from_me                                 AS last_message_is_from_me
    FROM wa_bridge.messages AS m
    WHERE m.chat_id = c.chat_id
    ORDER BY COALESCE(m.timestamp, m.created_at) DESC NULLS LAST
    LIMIT 1
) AS lm ON true;

-- -----------------------------------------------------------------------------
-- 7. Re-apply grants (CREATE OR REPLACE does not remove existing grants,
--    but we state them explicitly for clarity and idempotency)
-- -----------------------------------------------------------------------------

GRANT SELECT ON public.chats               TO authenticated;
GRANT SELECT ON public.chats_with_preview  TO authenticated;
