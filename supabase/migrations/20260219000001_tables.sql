-- =============================================================================
-- Migration: tables
-- Purpose:   Create all wa_bridge tables with their constraints, indexes,
--            RLS policies, grants, triggers, storage bucket, and realtime
--            broadcast configuration.
--
--            Depends on: 20260219000000_roles-and-schemas.sql
-- =============================================================================

-- =============================================================================
-- TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- wa_bridge.chats
--
-- One row per WhatsApp chat (individual or group).
-- chat_id is the JID string supplied by the WhatsApp protocol, e.g.
-- "447911123456@s.whatsapp.net" or "12345678901234567890@g.us".
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
--
-- One row per unique sender phone number observed across all messages.
-- phone_number stores the bare JID (digits only, no @s.whatsapp.net suffix).
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
--
-- Every inbound and outbound WhatsApp message.
-- Composite PK on (message_id, chat_id) because message IDs are only unique
-- within a chat in the WhatsApp protocol.
--
-- media_path        — relative path inside the wa-media storage bucket.
-- reply_to_message_id — the message_id this message is quoting (if any).
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

-- Every message must belong to a known chat.
ALTER TABLE "wa_bridge"."messages"
    ADD CONSTRAINT "fk_messages_chat"
    FOREIGN KEY (chat_id) REFERENCES wa_bridge.chats (chat_id)
    NOT VALID;
ALTER TABLE "wa_bridge"."messages" VALIDATE CONSTRAINT "fk_messages_chat";

-- sender_id is nullable (null = outbound / from-me messages with no contact
-- record). When present it references the contacts table.
ALTER TABLE "wa_bridge"."messages"
    ADD CONSTRAINT "fk_messages_sender"
    FOREIGN KEY (sender_id) REFERENCES wa_bridge.contacts (phone_number)
    NOT VALID;
ALTER TABLE "wa_bridge"."messages" VALIDATE CONSTRAINT "fk_messages_sender";

-- Supporting index for queries that filter by chat.
CREATE INDEX idx_messages_chat_id ON wa_bridge.messages (chat_id);

-- -----------------------------------------------------------------------------
-- wa_bridge.outgoing_messages
--
-- Queue for messages that the bridge should send on behalf of authenticated
-- users. The bridge polls this table via LISTEN/NOTIFY and updates status
-- as it processes each row.
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

-- Partial index: only index rows that are still pending so the bridge can
-- efficiently poll for work without scanning the full table.
CREATE INDEX idx_outgoing_messages_status
    ON wa_bridge.outgoing_messages (status)
    WHERE status = 'pending';

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- wa_bridge_app — full access to all tables (the bridge process owns the data)
-- -----------------------------------------------------------------------------

CREATE POLICY "wa_bridge_app_chats"
    ON "wa_bridge"."chats"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

CREATE POLICY "wa_bridge_app_contacts"
    ON "wa_bridge"."contacts"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

CREATE POLICY "wa_bridge_app_messages"
    ON "wa_bridge"."messages"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

CREATE POLICY "wa_bridge_app_outgoing_messages"
    ON "wa_bridge"."outgoing_messages"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- authenticated — read-only on chats, contacts, messages;
--                read + insert on outgoing_messages (users can send messages)
-- -----------------------------------------------------------------------------

CREATE POLICY "authenticated_read_chats"
    ON "wa_bridge"."chats"
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_read_contacts"
    ON "wa_bridge"."contacts"
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_read_messages"
    ON "wa_bridge"."messages"
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_read_outgoing_messages"
    ON "wa_bridge"."outgoing_messages"
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_outgoing_messages"
    ON "wa_bridge"."outgoing_messages"
    AS PERMISSIVE FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- =============================================================================
-- TABLE-LEVEL GRANTS
-- =============================================================================

-- Bridge application needs DML on everything.
GRANT SELECT, INSERT, UPDATE ON TABLE "wa_bridge"."chats"              TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE ON TABLE "wa_bridge"."contacts"           TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE ON TABLE "wa_bridge"."messages"           TO "wa_bridge_app";
GRANT SELECT, INSERT, UPDATE ON TABLE "wa_bridge"."outgoing_messages"  TO "wa_bridge_app";

-- The identity sequence for outgoing_messages must also be accessible.
GRANT USAGE ON SEQUENCE wa_bridge.outgoing_messages_id_seq TO "wa_bridge_app";

-- Authenticated users read everything; can only insert into outgoing_messages.
GRANT SELECT         ON TABLE "wa_bridge"."chats"             TO "authenticated";
GRANT SELECT         ON TABLE "wa_bridge"."contacts"          TO "authenticated";
GRANT SELECT         ON TABLE "wa_bridge"."messages"          TO "authenticated";
GRANT SELECT, INSERT ON TABLE "wa_bridge"."outgoing_messages" TO "authenticated";

GRANT USAGE ON SEQUENCE wa_bridge.outgoing_messages_id_seq TO "authenticated";

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- NOTIFY trigger for outgoing_messages
--
-- Fires pg_notify('new_outgoing_message', ...) whenever a new pending row is
-- inserted. The bridge process listens on this channel to avoid polling.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION wa_bridge.notify_outgoing_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status = 'pending' THEN
        PERFORM pg_notify(
            'new_outgoing_message',
            json_build_object('id', NEW.id)::text
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_outgoing_message
    AFTER INSERT ON wa_bridge.outgoing_messages
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.notify_outgoing_message();

-- -----------------------------------------------------------------------------
-- Realtime broadcast triggers
--
-- These broadcast row-level changes through Supabase Realtime so that the
-- frontend can subscribe to live updates without polling.
--
-- Chats changes are broadcast on the 'chats' topic.
-- Message changes are broadcast on a per-chat topic 'chat:<chat_id>' so
-- clients only receive traffic for the conversation they have open.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION wa_bridge.broadcast_chat_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM realtime.broadcast_changes(
        'chats',        -- topic
        TG_OP,          -- event  (INSERT / UPDATE / DELETE)
        TG_OP,          -- operation
        TG_TABLE_NAME,
        TG_TABLE_SCHEMA,
        NEW,
        OLD
    );
    RETURN NULL;
END;
$$;

CREATE TRIGGER broadcast_chat_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON wa_bridge.chats
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.broadcast_chat_changes();

CREATE OR REPLACE FUNCTION wa_bridge.broadcast_message_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM realtime.broadcast_changes(
        'chat:' || COALESCE(NEW.chat_id, OLD.chat_id),
        TG_OP,
        TG_OP,
        TG_TABLE_NAME,
        TG_TABLE_SCHEMA,
        NEW,
        OLD
    );
    RETURN NULL;
END;
$$;

CREATE TRIGGER broadcast_message_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON wa_bridge.messages
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.broadcast_message_changes();

-- =============================================================================
-- REALTIME — allow authenticated users to receive broadcasts
-- =============================================================================

-- Grant authenticated users the ability to read from realtime.messages so
-- the Supabase Realtime server can authorize their channel subscriptions.
CREATE POLICY "authenticated_receive_broadcasts"
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (true);

-- =============================================================================
-- STORAGE
-- =============================================================================

-- Private bucket for media attachments (images, audio, video, documents).
-- Public = false means files are not accessible via a plain URL; clients must
-- use a signed URL or the authenticated download endpoint.
INSERT INTO storage.buckets (id, name, public)
    VALUES ('wa-media', 'wa-media', false)
    ON CONFLICT (id) DO NOTHING;

-- Authenticated users can download media files from the bucket.
CREATE POLICY "auth_users_read_wa_media"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'wa-media');
