# wa-bridge

WhatsApp bridge that stores messages in a Supabase database. Designed as a pluggable extension for any Supabase-based application.

## What it does

- Connects to WhatsApp via linked device (QR code)
- Stores all incoming/outgoing messages in an isolated `wa_bridge` schema (contacts, chats, messages)
- Optionally downloads and stores media files (images, videos, audio, documents) in Supabase Storage
- Optionally forwards messages to webhook URLs (e.g., n8n, custom backend)
- Exposes an HTTP API for sending messages
- Uses a dedicated database role (`wa_bridge_app`) that cannot access your application's tables

## Database schema

All tables live in the `wa_bridge` schema, completely isolated from your app:

| Table | Description |
|-------|-------------|
| `wa_bridge.contacts` | WhatsApp contacts (phone_number, push_name, first/last seen) |
| `wa_bridge.chats` | Individual and group conversations |
| `wa_bridge.messages` | All messages with sender, type, content, timestamps |

## Adding to an existing Supabase project

### 1. Apply the migration

You can use the Supabase CLI to apply the migration from this repo:

```bash
# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

Or run the SQL manually in the Supabase SQL Editor — copy the contents of `supabase/migrations/20260215222446_wa-bridge.sql`.

This creates the `wa_bridge` schema with all tables, indexes, RLS policies, and grants. It does **not** touch your existing tables.

### 2. Create the database role

The bridge uses a dedicated `wa_bridge_app` role with access limited to `wa_bridge` and `whatsapp` schemas only.

```bash
cp scripts/.env.example scripts/.env
# Edit scripts/.env with your admin credentials
./scripts/setup-db-role.sh
```

The script will prompt for the `wa_bridge_app` password (or set `WA_BRIDGE_APP_PASSWORD` in `scripts/.env`).

### 3. Configure environment

```bash
cp .env.example .env
```

Set your Supabase database credentials:

```env
DB_POSTGRESDB_HOST=db.your-project-ref.supabase.co
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=postgres
DB_POSTGRESDB_USER=wa_bridge_app
DB_POSTGRESDB_PASSWORD=your-secure-password
DB_POSTGRESDB_SSL_ENABLED=true
```

### 4. Start the bridge

```bash
docker compose up --build
```

### 5. Link WhatsApp

Open http://localhost:8080/connect and scan the QR code with WhatsApp.

## API endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/connect` | GET | Web page to scan QR code |
| `/health` | GET | Connection status |
| `/send` | POST | Send a message |
| `/qr` | GET | QR code status (JSON) |
| `/qr.png` | GET | QR code as PNG |

### Sending messages

```bash
curl -X POST http://localhost:8080/send \
  -H 'Content-Type: application/json' \
  -d '{"number": "5511999999999", "text": "Hello!", "is_group": false}'
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_POSTGRESDB_HOST` | localhost | Supabase/Postgres host |
| `DB_POSTGRESDB_PORT` | 5432 | Postgres port |
| `DB_POSTGRESDB_DATABASE` | postgres | Database name |
| `DB_POSTGRESDB_USER` | wa_bridge_app | Database role |
| `DB_POSTGRESDB_PASSWORD` | | Database password |
| `DB_POSTGRESDB_SSL_ENABLED` | false | Enable SSL (set to `true` for Supabase hosted) |
| `MESSAGE_WEBHOOK_URL` | | Optional webhook for incoming messages |
| `VOICE_WEBHOOK_URL` | | Optional webhook for audio messages |
| `SUPABASE_URL` | | Supabase project URL (enables media storage) |
| `SUPABASE_SERVICE_KEY` | | Supabase service role key (enables media storage) |

## Integrating with your app

Your app can query `wa_bridge` tables directly — they're just regular Postgres tables in a separate schema:

```sql
-- Get all messages from a chat
SELECT * FROM wa_bridge.messages WHERE chat_id = '5511999999999@s.whatsapp.net';

-- Join with your own tables
SELECT c.name, m.content, m.timestamp
FROM your_app.customers c
JOIN wa_bridge.contacts wc ON wc.phone_number = c.phone
JOIN wa_bridge.messages m ON m.sender_id = wc.phone_number
ORDER BY m.timestamp DESC;
```

To create a foreign key from your tables to WhatsApp contacts:

```sql
ALTER TABLE public.customers
ADD FOREIGN KEY (phone_number)
REFERENCES wa_bridge.contacts(phone_number);
```

To expose `wa_bridge` tables via Supabase REST API, add `wa_bridge` to the exposed schemas in **Project Settings > API > Extra schemas**.

## Media storage

When `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set, the bridge downloads media from WhatsApp and stores it in a private Supabase Storage bucket (`wa-media`). Supported media types: images, videos, audio, and documents.

Files are stored at `wa-media/{chat_id}/{message_id}.{ext}` and the path is saved in `wa_bridge.messages.media_path`.

The message row is inserted first (without `media_path`), then updated asynchronously after upload completes. If a download or upload fails, the message is still saved — only `media_path` will be null.

When media storage is not configured, the bridge works exactly as before (audio is still forwarded to the voice webhook if configured).

## Security

The `wa_bridge_app` role has access **only** to:
- `wa_bridge` schema — SELECT, INSERT, UPDATE on contacts, chats, messages
- `whatsapp` schema — full access (used by whatsmeow for session storage)

It **cannot** read, write, or modify any tables in your application's schemas.
