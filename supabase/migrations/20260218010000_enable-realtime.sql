-- Enable Supabase Realtime via Broadcast for wa_bridge tables.
-- Uses the recommended trigger-based approach with realtime.broadcast_changes().

-- 1. RLS on realtime.messages so authenticated users can receive broadcasts
CREATE POLICY "authenticated_receive_broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

-- 2. Trigger function for chat changes — broadcasts to a single "chats" topic
CREATE OR REPLACE FUNCTION wa_bridge.broadcast_chat_changes()
RETURNS trigger
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'chats',              -- topic
    TG_OP,                -- event (INSERT, UPDATE, DELETE)
    TG_OP,                -- operation
    TG_TABLE_NAME,        -- table
    TG_TABLE_SCHEMA,      -- schema
    NEW,                  -- new record
    OLD                   -- old record
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger on wa_bridge.chats
CREATE TRIGGER broadcast_chat_changes_trigger
AFTER INSERT OR UPDATE OR DELETE
ON wa_bridge.chats
FOR EACH ROW
EXECUTE FUNCTION wa_bridge.broadcast_chat_changes();

-- 4. Trigger function for message changes — broadcasts to per-chat topic
CREATE OR REPLACE FUNCTION wa_bridge.broadcast_message_changes()
RETURNS trigger
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'chat:' || COALESCE(NEW.chat_id, OLD.chat_id),  -- topic per chat
    TG_OP,                                            -- event
    TG_OP,                                            -- operation
    TG_TABLE_NAME,                                    -- table
    TG_TABLE_SCHEMA,                                  -- schema
    NEW,                                              -- new record
    OLD                                               -- old record
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger on wa_bridge.messages
CREATE TRIGGER broadcast_message_changes_trigger
AFTER INSERT OR UPDATE OR DELETE
ON wa_bridge.messages
FOR EACH ROW
EXECUTE FUNCTION wa_bridge.broadcast_message_changes();
