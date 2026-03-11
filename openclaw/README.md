# OpenClaw Setup

## 1. Symlink into ~/.openclaw

```bash
ln -s "$(pwd)/skills" ~/.openclaw/skills
ln -s "$(pwd)/flight-search-mcp" ~/.openclaw/flight-search-mcp
```

## 2. Create the openclaw keychain and store the API key

Create a password-free keychain (accessible without unlocking, works over SSH):

```bash
security create-keychain -p "" ~/Library/Keychains/openclaw.keychain-db
```

Store the Seats.aero API key:

```bash
security add-generic-password \
  -a "openclaw" \
  -s "seats-aero" \
  -U \
  -w "<YOUR_SEATS_AERO_API_KEY>" \
  ~/Library/Keychains/openclaw.keychain-db
```

Verify it was stored correctly:

```bash
security find-generic-password -a "openclaw" -s "seats-aero" -w ~/Library/Keychains/openclaw.keychain-db
```
