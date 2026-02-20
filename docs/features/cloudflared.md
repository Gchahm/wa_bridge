# Cloudflare Tunnel for Supabase Log Drains

Expose local Loki to Supabase's log drain without a public IP.
Cloudflare Tunnel runs as a daemon on the Pi and makes an **outbound** connection to Cloudflare — no open ports needed.

## Prerequisites

- A domain with DNS managed by Cloudflare (free plan works)
- Supabase project on Team or Enterprise plan (log drains requirement)

## 1. Install cloudflared

```bash
# Debian/Ubuntu (Raspberry Pi)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# macOS (for testing locally)
brew install cloudflared
```

## 2. Authenticate

```bash
cloudflared tunnel login
# Opens browser to authorize with your Cloudflare account
```

## 3. Create a tunnel

```bash
cloudflared tunnel create wa-bridge
# Note the tunnel UUID printed — you'll need it below
```

## 4. Configure the tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /home/<user>/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: loki.yourdomain.com
    service: http://localhost:3100
  - service: http_status:404
```

## 5. Create DNS record

```bash
cloudflared tunnel route dns wa-bridge loki.yourdomain.com
```

## 6. Run the tunnel

```bash
# Test it
cloudflared tunnel run wa-bridge

# Install as systemd service (runs on boot)
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

## 7. Configure Supabase Log Drain

1. Go to **Project Settings > Log Drains** in the Supabase dashboard
2. Add a new **Loki** destination
3. Set URL to `https://loki.yourdomain.com/loki/api/v1/push`
4. Add any custom headers if needed (e.g., for basic auth — see below)

## Optional: Basic auth

To prevent unauthorized writes to Loki, add basic auth via cloudflared's access policies or put a reverse proxy (nginx/caddy) in front of Loki on the Pi:

```yaml
# Example: caddy as reverse proxy with basic auth
# Caddyfile
loki.yourdomain.com {
    basicauth {
        supabase $2a$14$... # caddy hash-password
    }
    reverse_proxy localhost:3100
}
```

Then in Supabase log drain headers, add:
```
Authorization: Basic <base64 of user:password>
```

## Verify

After setup, check Grafana at `http://localhost:3200` → Explore → Loki.
Query Supabase logs:

```
{source="supabase"}
```
