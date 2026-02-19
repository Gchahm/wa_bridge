-- =============================================================================
-- Public views (security_invoker = on)
-- =============================================================================

CREATE OR REPLACE VIEW public.chats
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.chats;

CREATE OR REPLACE VIEW public.contacts
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.contacts;

CREATE OR REPLACE VIEW public.messages
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.messages;

CREATE OR REPLACE VIEW public.outgoing_messages
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.outgoing_messages;

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
-- View grants
-- =============================================================================

GRANT SELECT ON public.chats              TO authenticated;
GRANT SELECT ON public.contacts           TO authenticated;
GRANT SELECT ON public.messages           TO authenticated;
GRANT SELECT ON public.chats_with_preview TO authenticated;

GRANT SELECT, INSERT ON public.outgoing_messages TO authenticated;
