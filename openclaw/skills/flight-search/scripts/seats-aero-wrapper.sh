#!/bin/bash
KEYCHAIN=~/Library/Keychains/openclaw.keychain-db
security unlock-keychain -p "" "$KEYCHAIN" 2>/dev/null
export SEATS_AERO_API_KEY=$(security find-generic-password \
  -a "openclaw" \
  -s "seats-aero" \
  -w "$KEYCHAIN")
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
exec node "$SCRIPT_DIR/../../../flight-search-mcp/dist/index.js" "$@"
