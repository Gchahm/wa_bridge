-- Remove old senderKeyDistributionMessage rows stored as message_type = 'other'.
-- These are internal Signal protocol key rotation events with no user-visible
-- content. The Go handler now skips them before insertion.

-- First delete reactions referencing these messages (FK constraint)
DELETE FROM wa_bridge.reactions
WHERE (message_id, chat_id) IN (
  SELECT message_id, chat_id FROM wa_bridge.messages
  WHERE message_type = 'other'
    AND description LIKE '%senderKeyDistributionMessage%'
);

DELETE FROM wa_bridge.messages
WHERE message_type = 'other'
  AND description LIKE '%senderKeyDistributionMessage%';
