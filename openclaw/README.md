# OpenClaw Setup

## 1. Symlink into ~/.openclaw

```bash
ln -s "$(pwd)/skills" ~/.openclaw/skills
ln -s "$(pwd)/flight-search-mcp" ~/.openclaw/flight-search-mcp
```

## 2. Store the Seats.aero API key

The flight search MCP wrapper reads the API key from the macOS Keychain.

If you're connecting via SSH, unlock the keychain first:

```bash
security unlock-keychain ~/Library/Keychains/login.keychain-db
```

Then add the key:

```bash
security add-generic-password \
  -a "openclaw" \
  -s "seats-aero" \
  -U \
  -w "<YOUR_SEATS_AERO_API_KEY>"
```

To verify it was stored correctly:

```bash
security find-generic-password -a "openclaw" -s "seats-aero" -w
```
