-- =============================================================================
-- Tables, RLS, grants, triggers, storage
-- =============================================================================

-- -----------------------------------------------------------------------------
-- wa_bridge.chats
-- -----------------------------------------------------------------------------

CREATE TABLE "wa_bridge"."chats" (
    "chat_id"         text                        NOT NULL,
    "is_group"        boolean                     NOT NULL DEFAULT false,
    "name"            character varying,
    "created_at"      timestamp without time zone          DEFAULT now(),
    "last_message_at" timestamp without time zone
);

ALTER TABLE "wa_bridge"."chats" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX chats_pkey ON wa_bridge.chats USING btree (chat_id);
ALTER TABLE "wa_bridge"."chats"
    ADD CONSTRAINT "chats_pkey" PRIMARY KEY USING INDEX "chats_pkey";

-- -----------------------------------------------------------------------------
-- wa_bridge.contacts
-- -----------------------------------------------------------------------------

CREATE TABLE "wa_bridge"."contacts" (
    "phone_number"  text                        NOT NULL,
    "push_name"     character varying,
    "first_seen_at" timestamp without time zone          DEFAULT now(),
    "last_seen_at"  timestamp without time zone          DEFAULT now()
);

ALTER TABLE "wa_bridge"."contacts" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX contacts_pkey ON wa_bridge.contacts USING btree (phone_number);
ALTER TABLE "wa_bridge"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY USING INDEX "contacts_pkey";

-- -----------------------------------------------------------------------------
-- wa_bridge.messages
-- -----------------------------------------------------------------------------

CREATE TABLE "wa_bridge"."messages" (
    "message_id"            text                        NOT NULL,
    "chat_id"               text                        NOT NULL,
    "sender_id"             text,
    "sender_name"           character varying,
    "message_type"          character varying           NOT NULL DEFAULT 'text',
    "media_type"            character varying,
    "content"               text,
    "media_path"            text,
    "description"           text,
    "reply_to_message_id"   text,
    "is_from_me"            boolean                     NOT NULL DEFAULT false,
    "is_agent"              boolean                     NOT NULL DEFAULT false,
    "timestamp"             timestamp without time zone,
    "created_at"            timestamp without time zone          DEFAULT now()
);

ALTER TABLE "wa_bridge"."messages" ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX messages_pkey ON wa_bridge.messages USING btree (message_id, chat_id);
ALTER TABLE "wa_bridge"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY USING INDEX "messages_pkey";

ALTER TABLE "wa_bridge"."messages"
    ADD CONSTRAINT "fk_messages_chat"
    FOREIGN KEY (chat_id) REFERENCES wa_bridge.chats (chat_id) NOT VALID;
ALTER TABLE "wa_bridge"."messages" VALIDATE CONSTRAINT "fk_messages_chat";

ALTER TABLE "wa_bridge"."messages"
    ADD CONSTRAINT "fk_messages_sender"
    FOREIGN KEY (sender_id) REFERENCES wa_bridge.contacts (phone_number) NOT VALID;
ALTER TABLE "wa_bridge"."messages" VALIDATE CONSTRAINT "fk_messages_sender";

CREATE INDEX idx_messages_chat_id ON wa_bridge.messages (chat_id);

-- -----------------------------------------------------------------------------
-- wa_bridge.outgoing_messages
-- -----------------------------------------------------------------------------

CREATE TABLE "wa_bridge"."outgoing_messages" (
    "id"              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "chat_id"         text        NOT NULL,
    "content"         text        NOT NULL,
    "status"          text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
    "error_message"   text,
    "sent_message_id" text,
    "created_at"      timestamptz NOT NULL DEFAULT now(),
    "sent_at"         timestamptz,
    CONSTRAINT "fk_outgoing_messages_chat"
        FOREIGN KEY (chat_id) REFERENCES wa_bridge.chats (chat_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "wa_bridge"."outgoing_messages" ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_outgoing_messages_status
    ON wa_bridge.outgoing_messages (status)
    WHERE status = 'pending';

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- wa_bridge_app — full access
CREATE POLICY "wa_bridge_app_chats"              ON "wa_bridge"."chats"              AS PERMISSIVE FOR ALL TO wa_bridge_app USING (true) WITH CHECK (true);
CREATE POLICY "wa_bridge_app_contacts"           ON "wa_bridge"."contacts"           AS PERMISSIVE FOR ALL TO wa_bridge_app USING (true) WITH CHECK (true);
CREATE POLICY "wa_bridge_app_messages"           ON "wa_bridge"."messages"           AS PERMISSIVE FOR ALL TO wa_bridge_app USING (true) WITH CHECK (true);
CREATE POLICY "wa_bridge_app_outgoing_messages"  ON "wa_bridge"."outgoing_messages"  AS PERMISSIVE FOR ALL TO wa_bridge_app USING (true) WITH CHECK (true);

-- authenticated — read-only + insert on outgoing_messages
CREATE POLICY "authenticated_read_chats"               ON "wa_bridge"."chats"              AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_contacts"            ON "wa_bridge"."contacts"           AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_messages"            ON "wa_bridge"."messages"           AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_outgoing_messages"   ON "wa_bridge"."outgoing_messages"  AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_outgoing_messages" ON "wa_bridge"."outgoing_messages"  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================================================
-- TABLE-LEVEL GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON TABLE "wa_bridge"."chats"              TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE ON TABLE "wa_bridge"."contacts"           TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE ON TABLE "wa_bridge"."messages"           TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE ON TABLE "wa_bridge"."outgoing_messages"  TO "wa_bridge_app";
GRANT USAGE ON SEQUENCE wa_bridge.outgoing_messages_id_seq             TO "wa_bridge_app";

GRANT SELECT         ON TABLE "wa_bridge"."chats"              TO "authenticated";
GRANT SELECT         ON TABLE "wa_bridge"."contacts"           TO "authenticated";
GRANT SELECT         ON TABLE "wa_bridge"."messages"           TO "authenticated";
GRANT SELECT, INSERT ON TABLE "wa_bridge"."outgoing_messages"  TO "authenticated";
GRANT USAGE ON SEQUENCE wa_bridge.outgoing_messages_id_seq     TO "authenticated";

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- NOTIFY trigger for outgoing_messages
CREATE OR REPLACE FUNCTION wa_bridge.notify_outgoing_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.status = 'pending' THEN
        PERFORM pg_notify('new_outgoing_message', json_build_object('id', NEW.id)::text);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_outgoing_message
    AFTER INSERT ON wa_bridge.outgoing_messages
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.notify_outgoing_message();

-- Realtime broadcast triggers
CREATE OR REPLACE FUNCTION wa_bridge.broadcast_chat_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM realtime.broadcast_changes('chats', TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
    RETURN NULL;
END;
$$;

CREATE TRIGGER broadcast_chat_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON wa_bridge.chats
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.broadcast_chat_changes();

CREATE OR REPLACE FUNCTION wa_bridge.broadcast_message_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM realtime.broadcast_changes('chat:' || COALESCE(NEW.chat_id, OLD.chat_id), TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
    RETURN NULL;
END;
$$;

CREATE TRIGGER broadcast_message_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON wa_bridge.messages
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.broadcast_message_changes();

-- Realtime RLS
CREATE POLICY "authenticated_receive_broadcasts"
    ON realtime.messages FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- STORAGE
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
    VALUES ('wa-media', 'wa-media', false)
    ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_users_read_wa_media"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'wa-media');
