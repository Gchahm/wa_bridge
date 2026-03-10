# Architecture Reference

## Service Communication Pattern
- Frontend → Go bridge: INSERT into table → pg_notify → Go LISTEN → claim row → execute → UPDATE row
- Go bridge → Frontend: Go writes to wa_bridge tables → Supabase Realtime broadcast triggers
- No direct HTTP between frontend and Go bridge

## docker-compose.yml
- All services use `network_mode: host`
- Services: whatsapp (Go bridge), n8n, prometheus, loki, grafana
- Volumes: wa_local (whatsapp session), n8n_data, loki_data, prometheus_data, grafana_data
- All services log to Loki via Docker log driver

## Go Service Startup Sequence (main.go)
1. Load config → connect DB → create whatsmeow client
2. Register event handler (messaging.RegisterHandler)
3. Start HTTP server (QR + health)
4. Connect whatsmeow
5. Launch goroutines: outbox.Listen, messaging.ListenGroupChats, agentHandler.Listen, cmdListener.Listen
6. Block on OS signal

## Database Roles
- `wa_bridge_app`: owns wa_bridge schema, full access
- `authenticated`: Supabase auth users, read + limited insert on public views
- `n8n_app`: read access to wa_bridge tables

## Supabase Storage Access
- Bucket: `wa-media` (private)
- Upload: POST to `{SUPABASE_URL}/storage/v1/object/{bucket}/{path}` with `Authorization: Bearer {SERVICE_KEY}`
- Download (service role): GET to same URL pattern with service key header
- Path pattern for audio: `{chat_id}/{message_id}.ogg`

## LISTEN/NOTIFY Channels
- `new_outgoing_message`: outgoing WhatsApp text messages
- `bridge_command`: generic frontend→bridge commands (history_sync etc.)
- `new_group_chat`: group chat name resolution

## Migration Naming Convention
- Format: `YYYYMMDDHHMMSS_description.sql` or `YYYYMMDD000001_description.sql`
- Always include: table creation, RLS enable, indexes, RLS policies, grants, notify trigger, realtime broadcast trigger, public view
