CREATE TABLE wa_bridge.contacts (
    phone_number text NOT NULL,
    push_name character varying,
    first_seen_at timestamp without time zone DEFAULT now(),
    last_seen_at timestamp without time zone DEFAULT now(),
    CONSTRAINT contacts_pkey PRIMARY KEY (phone_number)
);

ALTER TABLE wa_bridge.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_users_contacts" ON wa_bridge.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON wa_bridge.contacts TO authenticated;
