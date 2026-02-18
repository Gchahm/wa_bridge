# WhatsApp Bridge - Go App Architect Memory

## Project: whatsapp-api

Module name: `whatsapp-bridge` (go.mod, Go 1.24)
Location: `/Users/gchahm/dev/gchahm/wa_bridge/whatsapp-api/`

### Package structure (post-refactor)

```
whatsapp-api/
  main.go                          # Thin wiring only
  internal/
    config/config.go               # Env loading; Config.StorageConfigured()
    store/store.go                 # All SQL (contacts, chats, messages, outbox)
    waclient/waclient.go           # Client creation, QRStore, Connect()
    messaging/handler.go           # Event handler, payload parsing, media+webhook dispatch
    media/media.go                 # Download helpers, MimeToExt, UploadToSupabase
    webhook/webhook.go             # SendText, SendVoice (multipart audio)
    server/server.go               # HTTP routes: /send /health /connect /qr /qr.png
    outbox/outbox.go               # LISTEN/NOTIFY outbox loop (pq.NewListener)
```

### Key design decisions

- `store.MessagePayload` is the shared message type (imported by messaging and webhook).
- No interfaces introduced — all dependencies passed as concrete types.
- `waclient.QRStore` uses `sync.RWMutex` internally; consumers get/set via methods.
- `ctx` cancellation propagates from `main` to `outbox.Listen` and `waclient.Connect`.
- HTML for /connect and /qr page lives as package-level constants in `server/server.go`.

### Dependencies

- `github.com/lib/pq` — Postgres driver + LISTEN/NOTIFY
- `github.com/mdp/qrterminal/v3` — QR in terminal
- `github.com/skip2/go-qrcode` — QR PNG generation
- `go.mau.fi/whatsmeow` — WhatsApp client
- `google.golang.org/protobuf` — proto message construction

### Database schema (wa_bridge schema)

Tables: `contacts`, `chats`, `messages`, `outgoing_messages`
Outbox channel name: `new_outgoing_message`
Outbox statuses: `pending` -> `sending` -> `sent` | `failed`
