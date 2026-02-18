-- Grant the authenticated role access to read wa_bridge tables through the public views.
--
-- Background: public.chats, public.messages, public.contacts are plain (security invoker)
-- views over wa_bridge.chats, wa_bridge.messages, wa_bridge.contacts. Because they are
-- security invoker, the calling role (authenticated) must itself have:
--   1. USAGE on the wa_bridge schema
--   2. SELECT on the underlying tables
--   3. A permissive RLS policy that allows SELECT
-- Without all three the views return no rows (or an error) for authenticated users.

-- 1. Schema access (public schema USAGE needed on PG 15+ where default grants were revoked)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA wa_bridge TO authenticated;

-- 2. Table-level SELECT privilege
GRANT SELECT ON TABLE wa_bridge.chats    TO authenticated;
GRANT SELECT ON TABLE wa_bridge.messages TO authenticated;
GRANT SELECT ON TABLE wa_bridge.contacts TO authenticated;

-- 3. RLS policies — read-only, no row filter (mirrors the wa_bridge_app policies in style)
CREATE POLICY "authenticated_read_chats"
ON wa_bridge.chats
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_read_messages"
ON wa_bridge.messages
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_read_contacts"
ON wa_bridge.contacts
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);
