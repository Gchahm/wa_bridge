# Describer Service Setup

Media description service that runs on your Mac, watches for new WhatsApp media messages, and generates descriptions using local ML models (no API costs).

**Supported media types:**
- **Audio** — Transcribed via MLX Whisper (Metal GPU accelerated)
- **PDF documents** — Text extracted via pdfplumber
- **Images** — Planned (llava/moondream2 via llama.cpp)

## Prerequisites

- macOS with Apple Silicon (for Metal GPU acceleration)
- [uv](https://docs.astral.sh/uv/) installed (`brew install uv`)
- Supabase project URL and service role key

## Initial Setup

```bash
cd describer

# Create .env from example
cp .env.example .env
# Edit .env with your credentials
```

Fill in `.env`:
- `SUPABASE_URL` — Your Supabase project URL
- `SUPABASE_SERVICE_KEY` — Your Supabase service role key

Optional settings:
- `WHISPER_MODEL` — MLX Whisper model (default: `mlx-community/whisper-base-mlx`). Use `mlx-community/whisper-small-mlx` for better accuracy.
- `WHISPER_LANGUAGE` — Language code (default: `pt`)
- `CONCURRENCY` — Number of parallel workers (default: `2`)

## Apply the Database Migration

The service uses Supabase Realtime `postgres_changes` to react to new messages. This requires the `wa_bridge.messages` table to be in the Realtime publication:

```bash
# From the repo root
supabase db push
# Or apply manually:
# psql $DATABASE_URL -f supabase/migrations/20260310000001_enable_realtime_messages.sql
```

## Install Dependencies

```bash
cd describer
uv sync
```

The first run will also download the Whisper model (~150MB for base) automatically.

## Run Manually (Test)

```bash
cd describer
uv run python main.py
```

You should see:
```
2026-03-10 12:00:00 INFO     Starting describer (processors: audio, document, concurrency: 2)
2026-03-10 12:00:00 INFO     Listening for media messages via Supabase Realtime
```

## Run as Background Service (launchd)

The app loads `.env` automatically, so the launchd plist is straightforward.

```bash
cat > ~/Library/LaunchAgents/com.wabridge.describer.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.wabridge.describer</string>

    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/uv</string>
        <string>run</string>
        <string>python</string>
        <string>main.py</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/Users/gchahm/dev/gchahm/wa_bridge/describer</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>

    <key>StandardOutPath</key>
    <string>/tmp/wa-describer.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/wa-describer.err</string>

    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
EOF
```

### Manage the Service

```bash
# Load (start on login)
launchctl load ~/Library/LaunchAgents/com.wabridge.describer.plist

# Start now
launchctl start com.wabridge.describer

# Stop
launchctl stop com.wabridge.describer

# Unload (remove from login)
launchctl unload ~/Library/LaunchAgents/com.wabridge.describer.plist

# Check status
launchctl list | grep describer

# View logs
tail -f /tmp/wa-describer.log
tail -f /tmp/wa-describer.err
```

## How It Works

1. The Go bridge saves a media message to `wa_bridge.messages` and uploads the file to Supabase Storage
2. Supabase Realtime `postgres_changes` pushes the INSERT/UPDATE to this service via WebSocket
3. The service atomically claims the row (`description = '__processing__'`) to prevent duplicate work
4. Downloads the file from Supabase Storage
5. Processes it (transcription for audio, text extraction for PDFs) using local ML models
6. Writes the result back to `wa_bridge.messages.description`
7. The frontend receives the update via Supabase Realtime broadcast

On startup, the service also resets any stale `__processing__` rows from a previous crash, so restarting always catches up.

## Troubleshooting

**"No module named mlx_whisper"** — Make sure you're running with `uv run` which manages the virtual environment.

**Slow first transcription** — The Whisper model is downloaded on first use (~150MB for base). Subsequent runs use the cached model.

**Connection errors** — Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct.

**Stale `__processing__` rows** — The service resets these on startup. Just restart it.
