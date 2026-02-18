-- Create public views over wa_bridge tables so they're accessible via the default public schema API
-- RLS on the underlying wa_bridge tables is still enforced

CREATE OR REPLACE VIEW public.chats AS SELECT * FROM wa_bridge.chats;
CREATE OR REPLACE VIEW public.messages AS SELECT * FROM wa_bridge.messages;
CREATE OR REPLACE VIEW public.contacts AS SELECT * FROM wa_bridge.contacts;

-- Grant read-only access to authenticated users
GRANT SELECT ON public.chats TO authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT ON public.contacts TO authenticated;
