#!/bin/bash
#
# Exports all n8n workflows and credentials (without secrets) to n8n/
#
# Requires the n8n instance to be running and reachable.
# Uses the n8n REST API: https://docs.n8n.io/api/
#
# Usage:
#   ./scripts/backup-n8n.sh
#   ./scripts/backup-n8n.sh --url http://my-host:5678
#
# Environment:
#   N8N_URL       Base URL of n8n (default: http://localhost:5678)
#   N8N_API_KEY   API key for authentication (required if auth is enabled)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/n8n"

# Load .env from script directory
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

# Defaults
N8N_URL="${N8N_URL:-http://localhost:5678}"

# CLI overrides
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) N8N_URL="$2"; shift 2 ;;
    --api-key) N8N_API_KEY="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Build curl command helper
n8n_curl() {
  if [ -n "${N8N_API_KEY:-}" ]; then
    curl -sf -H "X-N8N-API-KEY: $N8N_API_KEY" "$@"
  else
    curl -sf "$@"
  fi
}

# Verify n8n is reachable
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" ${N8N_API_KEY:+-H "X-N8N-API-KEY: $N8N_API_KEY"} "$N8N_URL/api/v1/workflows?limit=1" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "000" ]; then
  echo "Error: cannot connect to n8n at $N8N_URL"
  echo "Make sure n8n is running."
  exit 1
elif [ "$HTTP_CODE" = "401" ]; then
  echo "Error: n8n returned 401 Unauthorized"
  echo "Set N8N_API_KEY or pass --api-key. Create one in n8n: Settings > API > Create API Key."
  exit 1
elif [ "$HTTP_CODE" != "200" ]; then
  echo "Error: n8n returned HTTP $HTTP_CODE"
  exit 1
fi

mkdir -p "$BACKUP_DIR/workflows" "$BACKUP_DIR/credentials"

# --- Workflows ---
echo "Fetching workflows..."

WORKFLOWS_JSON=$(n8n_curl "$N8N_URL/api/v1/workflows?limit=250")
WORKFLOW_IDS=$(echo "$WORKFLOWS_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for w in data.get('data', []):
    print(w['id'])
")

count=0
for id in $WORKFLOW_IDS; do
  WORKFLOW=$(n8n_curl "$N8N_URL/api/v1/workflows/$id")

  # Use the workflow name (slugified) as the filename
  FILENAME=$(echo "$WORKFLOW" | python3 -c "
import json, sys, re
w = json.load(sys.stdin)
name = w.get('name', 'untitled')
slug = re.sub(r'[^a-zA-Z0-9]+', '-', name).strip('-').lower()
print(f'{slug}.json')
")

  echo "$WORKFLOW" | python3 -m json.tool > "$BACKUP_DIR/workflows/$FILENAME"
  count=$((count + 1))
  echo "  [$count] $FILENAME"
done

echo "Exported $count workflow(s) to n8n/workflows/"

# --- Credentials (metadata only, no secrets) ---
echo "Fetching credentials..."

CREDS_JSON=$(n8n_curl "$N8N_URL/api/v1/credentials?limit=250" 2>/dev/null || echo '{"data":[]}')
CRED_COUNT=$(echo "$CREDS_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(len(data.get('data', [])))
")

if [ "$CRED_COUNT" -gt 0 ]; then
  echo "$CREDS_JSON" | python3 -m json.tool > "$BACKUP_DIR/credentials/credentials.json"
  echo "Exported $CRED_COUNT credential(s) metadata to n8n/credentials/ (no secrets)"
else
  echo "No credentials found (or API key lacks permission)."
fi

echo "Done."
