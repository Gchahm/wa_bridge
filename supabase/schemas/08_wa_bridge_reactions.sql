-- =============================================================================
-- wa_bridge.reactions
-- =============================================================================

CREATE TABLE "wa_bridge"."reactions" (
    "message_id"  text                        NOT NULL,
    "chat_id"     text                        NOT NULL,
    "sender_id"   text                        NOT NULL,
    "emoji"       text                        NOT NULL,
    "timestamp"   timestamp without time zone,
    "created_at"  timestamp without time zone          DEFAULT now(),
    PRIMARY KEY (message_id, chat_id, sender_id)
);

ALTER TABLE "wa_bridge"."reactions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "wa_bridge"."reactions"
    ADD CONSTRAINT "fk_reactions_message"
    FOREIGN KEY (message_id, chat_id) REFERENCES wa_bridge.messages (message_id, chat_id)
    NOT VALID;
ALTER TABLE "wa_bridge"."reactions" VALIDATE CONSTRAINT "fk_reactions_message";

ALTER TABLE "wa_bridge"."reactions"
    ADD CONSTRAINT "fk_reactions_sender"
    FOREIGN KEY (sender_id) REFERENCES wa_bridge.contacts (phone_number)
    NOT VALID;

CREATE INDEX idx_reactions_message_id_chat_id
    ON wa_bridge.reactions (message_id, chat_id);

-- RLS
CREATE POLICY "wa_bridge_app_reactions"
    ON "wa_bridge"."reactions"
    AS PERMISSIVE FOR ALL TO wa_bridge_app USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_reactions"
    ON "wa_bridge"."reactions"
    AS PERMISSIVE FOR SELECT TO authenticated USING (true);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "wa_bridge"."reactions" TO "wa_bridge_app";
GRANT SELECT ON TABLE "wa_bridge"."reactions" TO "authenticated";
GRANT SELECT ON TABLE "wa_bridge"."reactions" TO "n8n_app";

-- Realtime broadcast
CREATE OR REPLACE FUNCTION wa_bridge.broadcast_reaction_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM realtime.broadcast_changes(
        'reactions:' || COALESCE(NEW.chat_id, OLD.chat_id),
        TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
    );
    RETURN NULL;
END;
$$;

CREATE TRIGGER broadcast_reaction_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON wa_bridge.reactions
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.broadcast_reaction_changes();

-- =============================================================================
-- View
-- =============================================================================

CREATE OR REPLACE VIEW public.reactions
    WITH (security_invoker = on)
    AS SELECT * FROM wa_bridge.reactions;

GRANT SELECT ON public.reactions TO authenticated;
