#!/bin/bash
#
# Creates the wa_bridge_app database role with restricted access.
# Run this once after applying migrations.
#
# Usage:
#   cp scripts/.env.example scripts/.env
#   # Edit scripts/.env with your admin credentials
#   ./scripts/setup-db-role.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
else
  echo "Error: scripts/.env not found"
  echo "Run: cp scripts/.env.example scripts/.env"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is required in scripts/.env"
  echo "Example: DATABASE_URL=postgresql://postgres:password@host:5432/postgres"
  exit 1
fi

if [ -z "${WA_BRIDGE_APP_PASSWORD:-}" ]; then
  read -rsp "Enter password for wa_bridge_app role: " WA_BRIDGE_APP_PASSWORD
  echo
  if [ -z "$WA_BRIDGE_APP_PASSWORD" ]; then
    echo "Error: password cannot be empty"
    exit 1
  fi
fi

echo "Creating wa_bridge_app role..."

psql "$DATABASE_URL" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wa_bridge_app') THEN
    CREATE ROLE wa_bridge_app LOGIN;
  END IF;
END
\$\$;

ALTER ROLE wa_bridge_app PASSWORD '${WA_BRIDGE_APP_PASSWORD}';
ALTER ROLE wa_bridge_app SET search_path TO whatsapp;

-- wa_bridge schema: read/write contacts, chats, messages
GRANT USAGE ON SCHEMA wa_bridge TO wa_bridge_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA wa_bridge TO wa_bridge_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA wa_bridge GRANT SELECT, INSERT, UPDATE ON TABLES TO wa_bridge_app;

-- whatsapp schema: full access (whatsmeow session storage)
GRANT ALL ON SCHEMA whatsapp TO wa_bridge_app;
GRANT ALL ON ALL TABLES IN SCHEMA whatsapp TO wa_bridge_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA whatsapp GRANT ALL ON TABLES TO wa_bridge_app;
SQL

echo "Done. wa_bridge_app role is ready."
