# BUG-002 — Slow WhatsApp node handling (5–10s) for group and status messages

**Severity**: Warning (performance degradation)
**Service**: whatsapp (wa-bridge client component)
**Detected**: 2026-03-06T09:03–09:54Z

## Description

The whatsmeow client is consistently taking 5–10 seconds to handle individual message nodes, far above acceptable latency. This affects group chat messages (type `text` and `media`) and `status@broadcast` media messages.

## Log Evidence

Occurrences in the last hour (7 total):

| Time | Duration | Chat | Type |
|------|----------|------|------|
| 09:03:37 | **9.33s** | `120363313430220000@g.us` | text |
| 09:04:11 | 5.44s | `status@broadcast` | media (video) |
| 09:21:51 | 5.81s | `353838413224-1533588508@g.us` | media |
| 09:24:08 | 5.54s | `353838413224-1533588508@g.us` | text |
| 09:28:58 | 6.29s | `353838413224-1533588508@g.us` | text |
| 09:48:48 | 5.69s | `353838413224-1533588508@g.us` | text |
| 09:54:33 | **7.99s** | `status@broadcast` | media (url) |

## Impact

- Message delivery to the database is delayed by 5–10s per message.
- Under high volume, this could cause a processing backlog, causing even longer delays.
- Group `353838413224-1533588508@g.us` is particularly affected (5 of 7 occurrences).

## Root Cause (suspected)

Likely causes:
- **Media download** blocking the node handler — media messages require fetching from WhatsApp CDN; if this is done synchronously it blocks the handler.
- **Database writes** taking too long — slow Postgres inserts (e.g. RPi I/O under load).
- **LID-to-JID resolution** adding latency for `addressing_mode=lid` messages (all 5 group hits use LID mode).

## Fix

1. Profile the `Node handling` code path in `whatsapp-api/internal/messaging/` to identify the bottleneck.
2. If media download is the culprit, move it to an async goroutine so the node handler returns immediately.
3. If LID resolution is slow, investigate caching resolved JIDs.
4. Consider adding a per-message timeout/deadline to prevent indefinite blocking.
