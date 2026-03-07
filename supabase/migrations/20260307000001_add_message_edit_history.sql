-- BUG-001: Add missing edit_history and edited_at columns to wa_bridge.messages
-- The Go store.go UpdateMessage query references these columns but they were
-- never included in the original CREATE TABLE.

ALTER TABLE wa_bridge.messages
    ADD COLUMN IF NOT EXISTS edited_at    timestamp without time zone,
    ADD COLUMN IF NOT EXISTS edit_history jsonb;
