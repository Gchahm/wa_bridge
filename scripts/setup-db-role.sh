#!/bin/bash
#
# Sets the password for the wa_bridge_app database role.
# The role itself is created by the Supabase migration.
#
# Usage:
#   cp scripts/.env.example scripts/.env
#   # Edit scripts/.env with your admin credentials and password
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

echo "Setting wa_bridge_app password..."

psql "$DATABASE_URL" -c "ALTER ROLE wa_bridge_app PASSWORD '${WA_BRIDGE_APP_PASSWORD}';"

echo "Done."
