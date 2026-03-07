# BUG-003 — POST /messages/description returning HTTP 400 repeatedly

**Severity**: Warning (n8n integration broken)
**Service**: whatsapp (wa-bridge HTTP component)
**Detected**: 2026-03-06T09:06–09:38Z

## Description

The internal HTTP endpoint `POST /messages/description` is returning `400 Bad Request` on every call from n8n (client IP `127.0.0.1`). This is happening repeatedly — 4 times in the last hour — suggesting a systematic misconfiguration in the n8n workflow rather than a transient issue.

## Log Evidence

```json
{"level":"warn","component":"http","status_code":400,"method":"POST","path":"/messages/description","latency":0.13,"client_ip":"127.0.0.1","time":"2026-03-06T09:06:05Z"}
{"level":"warn","component":"http","status_code":400,"method":"POST","path":"/messages/description","latency":0.13,"client_ip":"127.0.0.1","time":"2026-03-06T09:14:27Z"}
{"level":"warn","component":"http","status_code":400,"method":"POST","path":"/messages/description","latency":0.13,"client_ip":"127.0.0.1","time":"2026-03-06T09:32:42Z"}
{"level":"warn","component":"http","status_code":400,"method":"POST","path":"/messages/description","latency":0.13,"client_ip":"127.0.0.1","time":"2026-03-06T09:38:07Z"}
```

## Impact

- The n8n AI automation workflow is failing to add AI-generated descriptions to messages.
- Affected messages likely have no description populated.

## Root Cause (suspected)

The 400 status and consistent ~130ms latency (fast fail) suggests request body validation is rejecting the payload. Possible causes:
- n8n is sending a malformed JSON body (wrong field names or types).
- A required field has become mandatory after a recent Go handler change that n8n's workflow hasn't been updated to match.
- The endpoint expects a `message_id` that no longer exists (e.g. message was deleted before description was applied).

## Fix

1. Add structured error logging to the `/messages/description` handler in `whatsapp-api/internal/server/` to log the validation error message alongside the 400 response.
2. Inspect the n8n workflow sending this request and compare the payload to the handler's expected schema.
3. Update whichever side is out of sync (handler or n8n workflow).
