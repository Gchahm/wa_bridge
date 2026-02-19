-- =============================================================================
-- Migration: views
-- Purpose:   Expose wa_bridge tables through public views so that Supabase's
--            auto-generated REST and GraphQL APIs (PostgREST) can serve them,
--            and so that RLS is enforced correctly via security_invoker.
--
--            security_invoker = on means the view runs under the permissions of
--            the calling role, not the view owner. This ensures that RLS
--            policies on the underlying wa_bridge tables are applied to every
--            query that goes through these views.
--
--            Depends on: 20260219000001_tables.sql
-- =============================================================================

-- =============================================================================
-- SIMPLE PASS-THROUGH VIEWS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.chats — direct projection of wa_bridge.chats
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.chats
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.chats;

-- -----------------------------------------------------------------------------
-- public.contacts — direct projection of wa_bridge.contacts
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.contacts
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.contacts;

-- -----------------------------------------------------------------------------
-- public.messages — direct projection of wa_bridge.messages
-- Includes all columns: message_id, chat_id, sender_id, sender_name,
-- message_type, media_type, content, media_path, reply_to_message_id,
-- is_from_me, is_agent, timestamp, created_at.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.messages
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.messages;

-- -----------------------------------------------------------------------------
-- public.outgoing_messages — direct projection of wa_bridge.outgoing_messages
-- Authenticated users can read their queued messages and insert new ones.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.outgoing_messages
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.outgoing_messages;

-- =============================================================================
-- ENRICHED VIEW
-- =============================================================================

-- -----------------------------------------------------------------------------
-- public.chats_with_preview
--
-- Extends chats with a lateral subquery that fetches the most recent message
-- for each chat. Used by the chat list UI to show a preview line and timestamp
-- without a separate client-side query per chat.
--
-- last_message_content logic:
--   - If the message is plain text, return the raw content.
--   - If it has a media_type, return a bracketed label, e.g. "[image]".
--   - Otherwise fall back to a bracketed message_type, e.g. "[sticker]".
--
-- last_message_timestamp prefers the protocol-level timestamp over the
-- database insertion time (created_at) for accurate ordering.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.chats_with_preview
    WITH (security_invoker = on)
    AS
SELECT
    c.chat_id,
    c.is_group,
    c.name,
    c.created_at,
    c.last_message_at,
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

-- =============================================================================
-- VIEW GRANTS
-- =============================================================================

-- Read-only views: authenticated users may SELECT.
GRANT SELECT ON public.chats             TO authenticated;
GRANT SELECT ON public.contacts          TO authenticated;
GRANT SELECT ON public.messages          TO authenticated;
GRANT SELECT ON public.chats_with_preview TO authenticated;

-- outgoing_messages: authenticated users may SELECT (view sent/pending messages)
-- and INSERT (queue new outbound messages). UPDATE and DELETE are intentionally
-- excluded — status transitions are handled exclusively by the bridge process.
GRANT SELECT, INSERT ON public.outgoing_messages TO authenticated;
