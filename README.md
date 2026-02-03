# n8n + WhatsApp Integration

A Docker-based setup for running n8n with WhatsApp integration. Receive and send WhatsApp messages through n8n workflows.

## Prerequisites

- Docker and Docker Compose installed
- A WhatsApp account to link

## Quick Start

1. **Clone and configure**

   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

2. **Build and start the containers**

   ```bash
   docker compose up --build
   ```

3. **Link WhatsApp**

   Open http://localhost:8080/connect in your browser to see the QR code:
   - Open WhatsApp on your phone
   - Go to Settings → Linked Devices → Link a Device
   - Scan the QR code displayed on the web page
   - The page will automatically update when connected

4. **Access n8n**

   Open http://localhost:5678 in your browser.

   Default credentials (change in `.env`):
   - Username: `admin`
   - Password: `admin`

## Services

| Service | Port | Description |
|---------|------|-------------|
| n8n | 5678 | Workflow automation platform |
| whatsapp | 8080 | WhatsApp bridge API |

### WhatsApp API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/connect` | GET | Web page to scan QR code and link WhatsApp |
| `/health` | GET | Health check with connection status |
| `/send` | POST | Send a WhatsApp message |
| `/qr` | GET | Get current QR code status (JSON) |
| `/qr.png` | GET | Get QR code as PNG image |

## Receiving Messages in n8n

1. Create a new workflow in n8n
2. Add a **Webhook** trigger node
3. Set the path to `whatsapp`
4. Messages will arrive with this structure:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "message_id": "ABC123",
  "chat_id": "5511999999999@s.whatsapp.net",
  "sender_id": "5511999999999@s.whatsapp.net",
  "sender_name": "John Doe",
  "message_type": "text",
  "text": "Hello!",
  "is_group": false,
  "reply_to": "5511999999999"
}
```

The `reply_to` field contains the number/group ID ready to use with `/send`:
- For individual chats: the sender's phone number
- For group chats: the group ID

## Sending Messages from n8n

Use an **HTTP Request** node with these settings:

- **Method**: POST
- **URL**: `http://whatsapp:8080/send`
- **Body Content Type**: JSON
- **Body**:

```json
{
  "number": "{{ $json.reply_to }}",
  "text": "Hello from n8n!",
  "is_group": {{ $json.is_group }}
}
```

Or with a hardcoded number:

```json
{
  "number": "5511999999999",
  "text": "Hello from n8n!",
  "is_group": false
}
```

### Phone Number Format

- Use only numbers, no `+` or spaces
- Include country code (e.g., `5511999999999` for Brazil)
- For groups, use the group ID and set `is_group: true`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `N8N_USER` | admin | n8n login username |
| `N8N_PASSWORD` | admin | n8n login password |
| `WHATSAPP_WEBHOOK_URL` | http://n8n:5678/webhook/whatsapp | Where incoming messages are sent |

## Data Persistence

Data is stored in Docker volumes:

- `n8n-data` - n8n workflows and credentials
- `whatsapp-data` - WhatsApp session (so you don't need to re-scan QR code)

To backup:

```bash
docker compose down
docker run --rm -v n8n_n8n-data:/data -v $(pwd):/backup alpine tar czf /backup/n8n-backup.tar.gz /data
docker run --rm -v n8n_whatsapp-data:/data -v $(pwd):/backup alpine tar czf /backup/whatsapp-backup.tar.gz /data
```

## Running in Background

```bash
docker compose up -d
```

View logs:

```bash
docker compose logs -f whatsapp
docker compose logs -f n8n
```

## Stopping

```bash
docker compose down
```

## Re-linking WhatsApp

If you need to re-link your WhatsApp account:

```bash
docker compose down
docker volume rm n8n_whatsapp-data
docker compose up
```

Then scan the new QR code.

## Troubleshooting

**QR code not showing**

Make sure you're running with `-it` flags or `tty: true` in compose (already configured).

**Messages not arriving in n8n**

1. Check the webhook URL in your n8n workflow matches the path `whatsapp`
2. Verify the workflow is active (toggle in n8n)
3. Check whatsapp container logs: `docker compose logs whatsapp`

**Can't send messages**

1. Verify WhatsApp is connected: `curl http://localhost:8080/health`
2. Check the phone number format (numbers only, with country code)
