CREATE TABLE wa_bridge.messages (
    message_id text NOT NULL,
    chat_id text NOT NULL,
    sender_id text,
    sender_name character varying,
    message_type character varying NOT NULL DEFAULT 'text',
    media_type character varying,
    content text,
    media_path text,
    is_from_me boolean NOT NULL DEFAULT false,
    is_agent boolean NOT NULL DEFAULT false,
    reply_to_message_id text,
    timestamp timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT messages_pkey PRIMARY KEY (message_id, chat_id),
    CONSTRAINT fk_messages_chat FOREIGN KEY (chat_id) REFERENCES wa_bridge.chats(chat_id),
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES wa_bridge.contacts(phone_number)
);

ALTER TABLE wa_bridge.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_users_messages" ON wa_bridge.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON wa_bridge.messages TO authenticated;
