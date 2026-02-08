CREATE TABLE wa_bridge.chats (
    chat_id text NOT NULL,
    is_group boolean NOT NULL DEFAULT false,
    name character varying,
    created_at timestamp without time zone DEFAULT now(),
    last_message_at timestamp without time zone,
    CONSTRAINT chats_pkey PRIMARY KEY (chat_id)
);

ALTER TABLE wa_bridge.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_users_chats" ON wa_bridge.chats FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON wa_bridge.chats TO authenticated;
