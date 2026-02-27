# Unhandled WhatsApp Message Types

Status snapshot from the database as of 2026-02-27.
Total messages with `message_type = 'other'`: **115** (53 pre-dating description logging, 62 with payload data).

## Summary by type

| Proto field | Count | Priority | Notes |
|---|---|---|---|
| `reactionMessage` | 28 | High | Emoji reactions to existing messages. Contains the target message key and the emoji text. An empty `text` means the reaction was removed. |
| `senderKeyDistributionMessage` | 26 | Skip | Internal Signal protocol key distribution for group encryption. Not user-visible content — should be silently ignored, not stored as "other". |
| `albumMessage` | 3 | Medium | Groups multiple images/videos into a single album. Contains `expectedImageCount` / `expectedVideoCount` and optional `contextInfo` with reply context. The actual media arrives as separate `ImageMessage`/`VideoMessage` events. |
| `protocolMessage` (MESSAGE_EDIT) | 2 | High | Edits to a previously sent message. Contains the original message key and the new `editedMessage` content plus a `timestampMS`. |
| `stickerMessage` | 1 | Medium | WebP sticker with download URL, media key, and optional `isAnimated`/`isLottie` flags. Structurally similar to image media. |
| `contactMessage` | 1 | Low | Single shared contact with `displayName` and embedded vCard. |
| `contactsArrayMessage` | 1 | Low | Multiple shared contacts in a single message. Same vCard format as `contactMessage`. |
| *(no description — pre-logging)* | 53 | — | Messages saved before the description-logging change. Cannot be classified retroactively. |

## Detailed analysis

### `reactionMessage` (High priority)

Reactions are by far the most frequent unhandled type. Payload structure:

```json
{
  "reactionMessage": {
    "key": {
      "remoteJID": "<chat>",
      "fromMe": false,
      "ID": "<target_message_id>",
      "participant": "<sender_lid>"
    },
    "text": "👍",
    "senderTimestampMS": "1772209731325"
  }
}
```

- `key.ID` — the message being reacted to
- `text` — the emoji; empty string means the reaction was **removed**
- `key.participant` — present in groups, identifies who sent the reaction

**Considerations:**
- Reactions are updates to existing messages, not standalone content.
- Could be modeled as a separate `reactions` table or as a JSONB column on `messages`.
- Reaction removal (empty `text`) must be handled.
- Multiple users can react to the same message.

### `protocolMessage` — MESSAGE_EDIT (High priority)

Message edits from the sender. Payload structure:

```json
{
  "protocolMessage": {
    "key": {
      "remoteJID": "<chat>",
      "fromMe": true,
      "ID": "<original_message_id>"
    },
    "type": "MESSAGE_EDIT",
    "editedMessage": {
      "conversation": "The corrected text..."
    },
    "timestampMS": "1772203681664"
  }
}
```

**Considerations:**
- Should update the `content` column of the original message.
- May want to preserve edit history (e.g. `edited_at` timestamp, or a `content_history` JSONB column).
- Other `protocolMessage` subtypes (e.g. `REVOKE` for delete-for-everyone) may appear in the future and should be handled separately.

### `stickerMessage` (Medium priority)

Stickers are downloadable media (WebP images). Payload structure:

```json
{
  "stickerMessage": {
    "URL": "https://mmg.whatsapp.net/...",
    "mimetype": "image/webp",
    "fileLength": "28934",
    "mediaKey": "...",
    "isAnimated": false,
    "isLottie": false
  }
}
```

**Considerations:**
- Can be treated as media with `media_type = 'sticker'`.
- The whatsmeow `StickerMessage` implements the downloadable interface, so existing media download/upload logic should work with minor additions to `media.FromMessage`.

### `albumMessage` (Medium priority)

Groups multiple media items. Payload:

```json
{
  "albumMessage": {
    "expectedImageCount": 3,
    "expectedVideoCount": 0,
    "contextInfo": { "stanzaID": "...", "participant": "..." }
  }
}
```

**Considerations:**
- The album message itself contains no media — individual images/videos arrive as separate events.
- Could be silently ignored (images are already handled individually) or used to group media in the UI.
- Contains reply context (`contextInfo`) when the album is sent as a reply.

### `senderKeyDistributionMessage` (Skip — should not be stored)

Internal Signal protocol message for group encryption key distribution. Contains binary key material, not user-visible content.

**Action:** Add a case in `buildPayload` to detect and skip these entirely (don't insert into `messages` at all).

### `contactMessage` / `contactsArrayMessage` (Low priority)

Shared contacts with vCard data.

```json
{
  "contactMessage": {
    "displayName": "John Doe",
    "vcard": "BEGIN:VCARD\n..."
  }
}
```

`contactsArrayMessage` has a `contacts` array with the same structure plus a `displayName` for the group.

**Considerations:**
- Could be stored as `message_type = 'contact'` with the display name(s) in `content`.
- vCard parsing is optional — the display name is sufficient for the chat UI.
