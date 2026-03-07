# BUG-004 — Status notification received with unexpected nil content

**Severity**: Warning (unhandled edge case)
**Service**: whatsapp (wa-bridge client component)
**Detected**: 2026-03-06T09:04Z and 09:25Z

## Description

The bridge client is receiving WhatsApp "set status" notifications that contain `<nil>` content, triggering an unhandled edge case warning. Each event fires the warning twice (two log lines per occurrence), suggesting the handler processes the notification twice or the event fires on two listeners.

## Log Evidence

```json
{"level":"warn","component":"client","time":"2026-03-06T09:04:32Z","message":"Set status notification has unexpected content (<nil>)"}
{"level":"warn","component":"client","time":"2026-03-06T09:04:32Z","message":"Set status notification has unexpected content (<nil>)"}
{"level":"warn","component":"client","time":"2026-03-06T09:25:53Z","message":"Set status notification has unexpected content (<nil>)"}
{"level":"warn","component":"client","time":"2026-03-06T09:25:53Z","message":"Set status notification has unexpected content (<nil>)"}
```

## Impact

- Low severity: no crash, the notification is simply dropped.
- Log noise makes real errors harder to spot.
- The status update (e.g. user changing their WhatsApp status text) is not persisted.

## Root Cause (suspected)

The whatsmeow library sends a `SetStatusNotification` event where the content/body field can be nil in some cases (e.g. user clearing their status). The bridge handler doesn't guard against this nil case before trying to access the content.

The double-firing may indicate the event handler is registered twice (e.g. during reconnection).

## Fix

1. In the status notification handler in `whatsapp-api/internal/messaging/` or `waclient/`, add a nil check on the content field before processing — return early gracefully rather than warning.
2. Investigate whether the event handler is being registered on each reconnect without deregistering the previous one (would explain duplicate log lines).
3. If storing status updates is desired, handle the nil case as "status cleared".
