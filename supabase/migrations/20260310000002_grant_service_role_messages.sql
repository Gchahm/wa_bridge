-- Grant service_role the permissions needed by the describer service.
-- The describer uses the Supabase client with the service_role key, which
-- routes through public.messages (security_invoker = on) and therefore
-- needs grants on BOTH the view and the underlying table.
-- service_role needs:
--   SELECT  — to query pending messages awaiting description
--   UPDATE  — to claim rows and write descriptions
GRANT USAGE ON SCHEMA wa_bridge TO service_role;
GRANT SELECT, UPDATE ON TABLE wa_bridge.messages TO service_role;
GRANT SELECT, UPDATE ON public.messages TO service_role;
