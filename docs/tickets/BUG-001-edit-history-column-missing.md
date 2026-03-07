# BUG-001 — Missing `edit_history` column breaks message edit handling

**Severity**: Error (data loss risk)
**Service**: whatsapp (wa-bridge messaging component)
**Detected**: 2026-03-06T09:30:35Z

## Description

The Go bridge crashes when attempting to apply a WhatsApp message edit. The database query references a column `edit_history` that does not exist in the `wa_bridge.messages` table (or whichever table is targeted).

## Log Evidence

```json
{
  "level": "error",
  "service": "wa-bridge",
  "component": "messaging",
  "error": "pq: column \"edit_history\" does not exist",
  "target_message_id": "3A4EF6D3D2AD726B6067",
  "time": "2026-03-06T09:30:35Z",
  "message": "failed to apply message edit"
}
```

## Impact

- Edited WhatsApp messages are silently dropped — the edit is not persisted to the database.
- The original message content remains stale in storage.

## Root Cause (suspected)

Code in `whatsapp-api/internal/messaging/` references `edit_history` in a SQL query, but no migration has been run to add this column.

## Fix

1. Add a migration to `supabase/migrations/` to create the `edit_history` column (or the appropriate table/column for tracking edits).
2. Alternatively, if edit history tracking is not yet needed, update the Go messaging handler to store only the updated message body without the `edit_history` field.

## Steps to Reproduce

1. Send a WhatsApp message from a device connected to the bridge.
2. Edit that message on WhatsApp.
3. Observe the error in bridge logs.
