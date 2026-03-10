-- Enable Supabase Realtime postgres_changes on wa_bridge.messages.
-- Used by the describer service to react to new media messages without polling.
ALTER PUBLICATION supabase_realtime ADD TABLE wa_bridge.messages;
