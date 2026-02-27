-- =============================================================================
-- Migration: add_unlinked_contacts_view
-- Purpose:   Expose contacts that have no matching customer record. Used by
--            the dashboard to prompt the user to create customer records for
--            active WhatsApp contacts.
--
--            Depends on: 20260219000001_tables.sql, 20260227000000_add_customers.sql
-- =============================================================================

CREATE OR REPLACE VIEW public.unlinked_contacts
    WITH (security_invoker = on)
    AS
SELECT c.phone_number, c.push_name, c.last_seen_at
FROM wa_bridge.contacts c
LEFT JOIN wa_bridge.customers cu ON cu.phone_number = c.phone_number
WHERE cu.id IS NULL
ORDER BY c.last_seen_at DESC NULLS LAST;

GRANT SELECT ON public.unlinked_contacts TO authenticated;
