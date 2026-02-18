-- Outbox pattern table for frontend-initiated outgoing WhatsApp messages.
--
-- The frontend inserts rows with status='pending'. A Go app listens on the
-- 'new_outgoing_message' channel via LISTEN/NOTIFY and processes each row,
-- updating status to 'sending', then 'sent' or 'failed'.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE wa_bridge.outgoing_messages (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chat_id          text        NOT NULL,
    content          text        NOT NULL,
    status           text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
    error_message    text,
    sent_message_id  text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    sent_at          timestamptz,

    CONSTRAINT fk_outgoing_messages_chat
        FOREIGN KEY (chat_id)
        REFERENCES wa_bridge.chats (chat_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

ALTER TABLE wa_bridge.outgoing_messages ENABLE ROW LEVEL SECURITY;

-- Index to support the Go app polling/updating pending rows efficiently
CREATE INDEX idx_outgoing_messages_status
    ON wa_bridge.outgoing_messages (status)
    WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- NOTIFY trigger
-- ---------------------------------------------------------------------------

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
    FOR EACH ROW
    EXECUTE FUNCTION wa_bridge.notify_outgoing_message();

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

-- wa_bridge_app (Go app): unrestricted access
CREATE POLICY "wa_bridge_app_outgoing_messages"
ON wa_bridge.outgoing_messages
AS PERMISSIVE
FOR ALL
TO wa_bridge_app
USING (true)
WITH CHECK (true);

-- authenticated (frontend users): insert new messages and read their status
CREATE POLICY "authenticated_insert_outgoing_messages"
ON wa_bridge.outgoing_messages
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_read_outgoing_messages"
ON wa_bridge.outgoing_messages
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON wa_bridge.outgoing_messages TO wa_bridge_app;
GRANT SELECT, INSERT         ON wa_bridge.outgoing_messages TO authenticated;

-- ---------------------------------------------------------------------------
-- Public view (exposes the table through the default API schema)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.outgoing_messages AS
    SELECT * FROM wa_bridge.outgoing_messages;

-- authenticated can read and insert through the public view
GRANT SELECT, INSERT ON public.outgoing_messages TO authenticated;
