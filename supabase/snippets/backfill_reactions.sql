-- =============================================================================
-- One-off cleanup: migrate existing reaction "other" messages into
-- wa_bridge.reactions and delete the old rows from wa_bridge.messages.
--
-- Run after the add_reactions migration has been applied.
-- Safe to re-run (uses ON CONFLICT DO NOTHING for the insert).
-- =============================================================================

-- Step 1: Insert reactions from existing "other" messages
INSERT INTO wa_bridge.reactions (message_id, chat_id, sender_id, emoji, timestamp)
SELECT
    -- Target message ID is in reactionMessage.key.ID
    description::jsonb -> 'reactionMessage' -> 'key' ->> 'ID' AS message_id,
    -- Chat ID from the reaction key (matches the messages row's chat_id)
    description::jsonb -> 'reactionMessage' -> 'key' ->> 'remoteJID' AS chat_id,
    -- The sender of the reaction is stored as sender_id on the messages row
    m.sender_id,
    -- The emoji
    description::jsonb -> 'reactionMessage' ->> 'text' AS emoji,
    -- Convert senderTimestampMS (milliseconds string) to timestamp
    to_timestamp(
        (description::jsonb -> 'reactionMessage' ->> 'senderTimestampMS')::bigint / 1000.0
    ) AS timestamp
FROM wa_bridge.messages m
WHERE m.message_type = 'other'
  AND m.description LIKE '%reactionMessage%'
  -- Only import non-empty reactions (empty text = retraction)
  AND (m.description::jsonb -> 'reactionMessage' ->> 'text') IS NOT NULL
  AND (m.description::jsonb -> 'reactionMessage' ->> 'text') <> ''
  -- Only import if the target message exists (FK constraint)
  AND EXISTS (
      SELECT 1 FROM wa_bridge.messages target
      WHERE target.message_id = (m.description::jsonb -> 'reactionMessage' -> 'key' ->> 'ID')
        AND target.chat_id = (m.description::jsonb -> 'reactionMessage' -> 'key' ->> 'remoteJID')
  )
ON CONFLICT (message_id, chat_id, sender_id) DO NOTHING;

-- Step 2: Delete the old "other" message rows that were reactions
DELETE FROM wa_bridge.messages
WHERE message_type = 'other'
  AND description LIKE '%reactionMessage%';
