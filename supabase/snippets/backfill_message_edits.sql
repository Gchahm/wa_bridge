-- Backfill message edits from existing "other" rows that captured MESSAGE_EDIT
-- protocol messages as raw JSON in the description column.
--
-- This script:
-- 1. Parses the stored protobuf JSON to extract target message ID, new content, and timestamp
-- 2. Applies the edit to the target message (updating content, setting edited_at, appending to edit_history)
-- 3. Deletes the old "other" rows after successful backfill

BEGIN;

-- Apply edits to original messages
WITH edits AS (
  SELECT
    m.message_id AS edit_row_id,
    m.chat_id AS edit_row_chat_id,
    (m.description::jsonb -> 'protocolMessage' -> 'key' ->> 'ID') AS target_message_id,
    COALESCE(
      m.description::jsonb -> 'protocolMessage' -> 'key' ->> 'remoteJID',
      m.chat_id
    ) AS target_chat_id,
    COALESCE(
      m.description::jsonb -> 'protocolMessage' -> 'editedMessage' ->> 'conversation',
      m.description::jsonb -> 'protocolMessage' -> 'editedMessage' -> 'extendedTextMessage' ->> 'text',
      m.description::jsonb -> 'protocolMessage' -> 'editedMessage' -> 'imageMessage' ->> 'caption',
      m.description::jsonb -> 'protocolMessage' -> 'editedMessage' -> 'videoMessage' ->> 'caption',
      m.description::jsonb -> 'protocolMessage' -> 'editedMessage' -> 'documentMessage' ->> 'caption',
      ''
    ) AS new_content,
    to_timestamp(
      (m.description::jsonb -> 'protocolMessage' ->> 'timestampMS')::bigint / 1000.0
    ) AS edited_at
  FROM wa_bridge.messages m
  WHERE m.message_type = 'other'
    AND m.description LIKE '%MESSAGE_EDIT%'
    AND m.description LIKE '%protocolMessage%'
)
UPDATE wa_bridge.messages t
SET
  edit_history = COALESCE(t.edit_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'content', t.content,
    'edited_at', COALESCE(t.edited_at, t.timestamp)
  )),
  content = e.new_content,
  edited_at = e.edited_at
FROM edits e
WHERE t.message_id = e.target_message_id
  AND t.chat_id = e.target_chat_id;

-- Delete the old "other" rows that were just backfilled
DELETE FROM wa_bridge.messages
WHERE message_type = 'other'
  AND description LIKE '%MESSAGE_EDIT%'
  AND description LIKE '%protocolMessage%';

COMMIT;
