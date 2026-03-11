#!/bin/bash
export SEATS_AERO_API_KEY=$(security find-generic-password \
  -a "openclaw" \
  -s "seats-aero" \
  -w openclaw.keychain-db)
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
exec node "$SCRIPT_DIR/../../../flight-search-mcp/dist/index.js" "$@"
