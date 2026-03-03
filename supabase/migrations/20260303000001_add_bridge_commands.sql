-- =============================================================================
-- Migration: bridge_commands
-- Purpose:   Generic command queue for the frontend to request actions from the
--            Go bridge (e.g. on-demand WhatsApp history sync). Follows the same
--            INSERT -> pg_notify -> LISTEN pattern as outgoing_messages.
--
--            Depends on: 20260219000001_tables.sql (wa_bridge.chats)
-- =============================================================================

-- =============================================================================
-- TABLE
-- =============================================================================

CREATE TABLE "wa_bridge"."bridge_commands" (
    "id"            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "command_type"  text        NOT NULL,
    "chat_id"       text        NOT NULL,
    "payload"       jsonb       NOT NULL DEFAULT '{}',
    "status"        text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    "result"        jsonb,
    "error_message" text,
    "created_at"    timestamptz NOT NULL DEFAULT now(),
    "started_at"    timestamptz,
    "completed_at"  timestamptz,
    CONSTRAINT "fk_bridge_commands_chat"
        FOREIGN KEY (chat_id) REFERENCES wa_bridge.chats (chat_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "wa_bridge"."bridge_commands" ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Go startup drain: efficiently find all pending commands.
CREATE INDEX idx_bridge_commands_pending
    ON wa_bridge.bridge_commands (id)
    WHERE status = 'pending';

-- Dedup check: find active commands for a given chat.
CREATE INDEX idx_bridge_commands_chat_active
    ON wa_bridge.bridge_commands (chat_id, status)
    WHERE status IN ('pending', 'processing');

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

CREATE POLICY "wa_bridge_app_bridge_commands"
    ON "wa_bridge"."bridge_commands"
    AS PERMISSIVE FOR ALL
    TO wa_bridge_app
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_read_bridge_commands"
    ON "wa_bridge"."bridge_commands"
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_bridge_commands"
    ON "wa_bridge"."bridge_commands"
    AS PERMISSIVE FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON TABLE "wa_bridge"."bridge_commands" TO "wa_bridge_app";
GRANT USAGE ON SEQUENCE wa_bridge.bridge_commands_id_seq TO "wa_bridge_app";

GRANT SELECT, INSERT ON TABLE "wa_bridge"."bridge_commands" TO "authenticated";
GRANT USAGE ON SEQUENCE wa_bridge.bridge_commands_id_seq TO "authenticated";

-- =============================================================================
-- NOTIFY TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION wa_bridge.notify_bridge_command()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status = 'pending' THEN
        PERFORM pg_notify(
            'bridge_command',
            json_build_object('id', NEW.id)::text
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_bridge_command
    AFTER INSERT ON wa_bridge.bridge_commands
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.notify_bridge_command();

-- =============================================================================
-- REALTIME BROADCAST TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION wa_bridge.broadcast_bridge_command_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM realtime.broadcast_changes(
        'commands:' || COALESCE(NEW.chat_id, OLD.chat_id),
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

CREATE TRIGGER broadcast_bridge_command_changes_trigger
    AFTER INSERT OR UPDATE ON wa_bridge.bridge_commands
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.broadcast_bridge_command_changes();

-- =============================================================================
-- PUBLIC VIEW
-- =============================================================================

CREATE OR REPLACE VIEW public.bridge_commands
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.bridge_commands;

GRANT SELECT, INSERT ON public.bridge_commands TO authenticated;
