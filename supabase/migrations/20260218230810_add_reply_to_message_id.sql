ALTER TABLE wa_bridge.messages
  ADD COLUMN reply_to_message_id text;

CREATE OR REPLACE VIEW public.messages WITH (security_invoker = on) AS
  SELECT * FROM wa_bridge.messages;
