# Feature Planner Memory

## Key Architecture Notes
- See `architecture.md` for service wiring, DB schema, and LISTEN/NOTIFY pattern details
- See `patterns.md` for Go service patterns, migration conventions, and frontend conventions

## Critical File Paths
- Go service entry: `whatsapp-api/main.go`
- Go config: `whatsapp-api/internal/config/config.go`
- Go store: `whatsapp-api/internal/store/store.go`
- Go outbox (LISTEN/NOTIFY reference impl): `whatsapp-api/internal/outbox/outbox.go`
- Go commands listener (LISTEN/NOTIFY + claim pattern): `whatsapp-api/internal/commands/commands.go`
- Go media (Supabase Storage download/upload): `whatsapp-api/internal/media/media.go`
- Go Dockerfile: `whatsapp-api/Dockerfile` (CGO_ENABLED=0, alpine)
- docker-compose: `docker-compose.yml` (all services use `network_mode: host`)
- Latest migration: `supabase/migrations/20260307000001_add_message_edit_history.sql`
- Go messaging handler: `whatsapp-api/internal/messaging/handler.go` — media_type values: 'audio', 'image', 'video', 'document', 'sticker'
- `store.UpdateDescription(messageID, chatID, description)` already exists for writing transcriptions

## DB Schema Highlights
- `wa_bridge.messages`: (message_id, chat_id, PK); columns: media_type, media_path, description, content
- Audio messages: message_type='media', media_type='audio', media_path='{chat_id}/{message_id}.ogg'
- `description` column holds transcriptions (text) or raw proto JSON for unknown types
- Storage bucket: `wa-media`, path pattern: `{chat_id}/{message_id}.{ext}`

## LISTEN/NOTIFY Pattern
- `pq.NewListener` on a channel name
- Drain pending on startup via direct DB query
- On reconnect (nil notification) re-drain pending
- Claim row atomically with UPDATE ... WHERE status='pending' RETURNING ... (skips sql.ErrNoRows)
- See `commands.go` for full reference including stale-recovery on startup
