-- =============================================================================
-- Migration: add_customer_to_chats_preview
-- Purpose:   Extend public.chats_with_preview with customer information.
--
--            Adds a LEFT JOIN to public.customers so the chat list can display
--            the linked customer's id and name without a separate client-side
--            query.  Group chats and chats with no linked contact naturally
--            produce NULL for both new columns.
--
--            Depends on: 20260219000002_views.sql,
--                        20260227000000_add_customers.sql,
--                        20260302000001_add_agent_active.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Recreate public.chats_with_preview with customer columns
--
--    DROP + CREATE is required because CREATE OR REPLACE cannot change the
--    column list of an existing view (PostgreSQL rejects it with:
--    "cannot change name of view column").  The DROP wipes the ACL, so the
--    GRANT below is mandatory.
--
--    New columns are appended at the end to avoid breaking any positional
--    references in existing client code that selects by name (which is the
--    project standard — no SELECT *).
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
    lm.last_message_is_from_me,
    -- Customer columns: NULL for group chats or contacts not yet linked to a
    -- customer record.
    cust.id   AS customer_id,
    cust.name AS customer_name
FROM wa_bridge.chats AS c
LEFT JOIN public.customers AS cust
    ON cust.phone_number = c.contact_phone_number
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
-- 2. Re-apply grants
--    The DROP above wiped the ACL on chats_with_preview.  authenticated users
--    need SELECT to reach this view through PostgREST / the Supabase client.
--    security_invoker = on means the underlying RLS policies on wa_bridge.chats,
--    wa_bridge.messages, and public.customers are still evaluated against the
--    calling role — this grant only opens the view itself.
-- -----------------------------------------------------------------------------

GRANT SELECT ON public.chats_with_preview TO authenticated;
