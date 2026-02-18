-- Messages for Maria Silva (active conversation)
INSERT INTO wa_bridge.messages (message_id, chat_id, sender_id, sender_name, message_type, content, is_from_me, is_agent, "timestamp") VALUES
  ('msg_maria_08', '5511999990001@s.whatsapp.net', '5511999990001', 'Maria Silva', 'text', 'oi tenho uma duvida!', false, false, now() - interval '5 minutes')
ON CONFLICT (message_id, chat_id) DO NOTHING;
