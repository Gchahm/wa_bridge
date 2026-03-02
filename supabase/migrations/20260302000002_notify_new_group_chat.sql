-- Notify the Go bridge when a new group chat row is created so it can
-- resolve the group name via the WhatsApp API exactly once.

CREATE OR REPLACE FUNCTION wa_bridge.notify_new_group_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.is_group THEN
        PERFORM pg_notify(
            'new_group_chat',
            json_build_object('chat_id', NEW.chat_id)::text
        );
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_notify_new_group_chat
    AFTER INSERT ON wa_bridge.chats
    FOR EACH ROW EXECUTE FUNCTION wa_bridge.notify_new_group_chat();
