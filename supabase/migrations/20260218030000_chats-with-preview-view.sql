-- ---------------------------------------------------------------------------
-- View: public.chats_with_preview
--
-- Joins every chat with its most-recent message so the frontend can fetch
-- a complete chat list (including preview content) in a single query,
-- replacing the heuristic multi-query approach.
--
-- Preview content rules:
--   - text messages  → the raw content
--   - all other types → "[media_type]" when media_type is set,
--                       otherwise "[message_type]"
--
-- Ordering: the "last" message is determined by timestamp DESC
-- (the WhatsApp wall-clock time), with created_at as a tie-breaker for
-- rows where timestamp is NULL.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.chats_with_preview WITH (security_invoker = on) AS
SELECT
    c.chat_id,
    c.is_group,
    c.name,
    c.created_at,
    c.last_message_at,

    -- Derived preview fields from the most-recent message
    lm.last_message_content,
    lm.last_message_timestamp,
    lm.last_message_type,
    lm.last_message_is_from_me

FROM wa_bridge.chats AS c
LEFT JOIN LATERAL (
    SELECT
        -- Human-readable preview: plain text for text messages,
        -- bracketed type label for everything else.
        CASE
            WHEN m.message_type = 'text' AND m.content IS NOT NULL
                THEN m.content
            WHEN m.media_type IS NOT NULL
                THEN '[' || m.media_type || ']'
            ELSE
                '[' || m.message_type || ']'
        END AS last_message_content,

        -- Prefer the WhatsApp-native timestamp; fall back to insert time.
        COALESCE(m.timestamp, m.created_at) AS last_message_timestamp,

        m.message_type  AS last_message_type,
        m.is_from_me    AS last_message_is_from_me

    FROM wa_bridge.messages AS m
    WHERE m.chat_id = c.chat_id
    ORDER BY
        COALESCE(m.timestamp, m.created_at) DESC NULLS LAST
    LIMIT 1
) AS lm ON true;

-- ---------------------------------------------------------------------------
-- Grants – mirror the pattern used for public.chats
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.chats_with_preview TO authenticated;
