-- Reclassify old stickerMessage rows from message_type = 'other' to proper
-- media/sticker type. Media URLs have expired so we can't backfill media_path,
-- but the messages will display as [sticker] instead of [other].

UPDATE wa_bridge.messages
SET message_type = 'media',
    media_type = 'sticker',
    description = NULL
WHERE message_type = 'other'
  AND description LIKE '%stickerMessage%';
