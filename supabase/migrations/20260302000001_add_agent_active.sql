-- =============================================================================
-- Migration: add_agent_active
-- Purpose:   Add an `agent_active` boolean toggle to wa_bridge.chats so that
--            an AI agent can be activated per-chat by authenticated users.
--
--            When the column transitions from false/null → true a LISTEN/NOTIFY
--            event is fired on the 'agent_activate' channel so the Go bridge (or
--            any other subscriber) can react immediately without polling.
--
--            Depends on: 20260219000001_tables.sql, 20260219000002_views.sql,
--                        20260227000003_add_chat_contact_phone_number.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add the column
--    Defaults to false — the agent is off for all existing and new chats unless
--    explicitly enabled.
-- -----------------------------------------------------------------------------

ALTER TABLE wa_bridge.chats
    ADD COLUMN IF NOT EXISTS agent_active boolean DEFAULT false;

-- -----------------------------------------------------------------------------
-- 2. Column-level GRANT so authenticated users can update ONLY this column
--    This is intentionally narrow — authenticated users should not be able to
--    rewrite arbitrary columns on wa_bridge.chats through the views.
-- -----------------------------------------------------------------------------

GRANT UPDATE (agent_active) ON TABLE wa_bridge.chats TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. RLS policy — allow authenticated users to UPDATE rows on wa_bridge.chats
--    The column-level GRANT above restricts which column they may write; the
--    policy below opens the row-level gate.  USING (true) means all rows are
--    visible as update candidates; WITH CHECK (true) places no restriction on
--    the resulting row state beyond what the column grant already enforces.
-- -----------------------------------------------------------------------------

CREATE POLICY "authenticated_update_agent_active"
    ON wa_bridge.chats
    AS PERMISSIVE FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 4. Trigger function: fire pg_notify when agent_active flips to true
--    The function lives in wa_bridge to keep all schema objects together.
--    It is an AFTER trigger so it operates on the fully-committed NEW row.
--    RETURN NULL is correct for an AFTER trigger (the return value is ignored
--    by the engine, but NULL is the conventional choice).
-- -----------------------------------------------------------------------------

CREATE FUNCTION wa_bridge.notify_agent_activate()
RETURNS trigger AS $$
BEGIN
    IF NEW.agent_active = true AND (OLD.agent_active IS NULL OR OLD.agent_active = false) THEN
        PERFORM pg_notify(
            'agent_activate',
            json_build_object('chat_id', NEW.chat_id)::text
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_agent_activate
    AFTER UPDATE ON wa_bridge.chats
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.notify_agent_activate();

-- -----------------------------------------------------------------------------
-- 5. Recreate public.chats view
--    SELECT * already picks up the new column automatically, but we recreate
--    the view explicitly so the PostgREST schema cache and any dependent
--    tooling see the updated column list without requiring a manual cache flush.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.chats
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.chats;

-- -----------------------------------------------------------------------------
-- 6. Recreate public.chats_with_preview to include agent_active
--    DROP + CREATE is required because CREATE OR REPLACE cannot insert new
--    columns into an existing view definition.
--    agent_active is placed immediately after contact_phone_number to keep the
--    chat-level metadata columns together.
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
    c.agent_active,
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
-- 7. Re-apply grants on the views
--    CREATE OR REPLACE preserves existing grants on public.chats, but we state
--    them explicitly for clarity.  The DROP/CREATE of chats_with_preview wipes
--    its ACL, so the grant below is mandatory for that view.
-- -----------------------------------------------------------------------------

GRANT SELECT ON public.chats               TO authenticated;
GRANT SELECT ON public.chats_with_preview  TO authenticated;
