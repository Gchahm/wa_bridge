#!/bin/bash
#
# Imports all n8n workflows from n8n/workflows/ back into a running n8n instance.
#
# Workflows that already exist (matched by ID) are updated; new ones are created.
# Credentials are NOT restored (the backup only contains metadata, no secrets).
#
# Requires the n8n instance to be running and reachable.
# Uses the n8n REST API: https://docs.n8n.io/api/
#
# Usage:
#   ./scripts/restore-n8n.sh
#   ./scripts/restore-n8n.sh --url http://my-host:5678
#   ./scripts/restore-n8n.sh --activate   # activate workflows after import
#
# Environment:
#   N8N_URL       Base URL of n8n (default: http://localhost:5678)
#   N8N_API_KEY   API key for authentication (required if auth is enabled)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/n8n"
ACTIVATE=false

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
    --activate) ACTIVATE=true; shift ;;
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

# Check backup directory exists
if [ ! -d "$BACKUP_DIR/workflows" ]; then
  echo "Error: no workflows directory found at $BACKUP_DIR/workflows/"
  echo "Run ./scripts/backup-n8n.sh first."
  exit 1
fi

# Collect existing workflow IDs for update-vs-create decision
EXISTING_IDS=$(n8n_curl "$N8N_URL/api/v1/workflows?limit=250" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for w in data.get('data', []):
    print(w['id'])
")

# --- Workflows ---
echo "Restoring workflows from $BACKUP_DIR/workflows/ ..."

created=0
updated=0
failed=0

for file in "$BACKUP_DIR/workflows"/*.json; do
  [ -f "$file" ] || continue

  # Extract id and name from the workflow JSON
  read -r WF_ID WF_NAME < <(python3 -c "
import json, sys
w = json.load(open(sys.argv[1]))
print(w.get('id', ''), w.get('name', 'untitled'))
" "$file")

  # Build the payload: strip fields n8n doesn't accept on create/update
  PAYLOAD=$(python3 -c "
import json, sys
w = json.load(open(sys.argv[1]))
# Keep only the fields the API accepts
keep = {'name', 'nodes', 'connections', 'settings', 'staticData', 'tags', 'pinData', 'triggerCount'}
out = {k: v for k, v in w.items() if k in keep}
json.dump(out, sys.stdout)
" "$file")

  if echo "$EXISTING_IDS" | grep -qx "$WF_ID" 2>/dev/null; then
    # Update existing workflow
    RESULT=$(echo "$PAYLOAD" | n8n_curl -X PUT -H "Content-Type: application/json" -d @- "$N8N_URL/api/v1/workflows/$WF_ID" 2>&1) && {
      updated=$((updated + 1))
      echo "  [updated] $WF_NAME (id: $WF_ID)"
    } || {
      failed=$((failed + 1))
      echo "  [FAILED]  $WF_NAME (id: $WF_ID) — update failed"
    }
  else
    # Create new workflow
    # Include the original ID so n8n preserves it if possible
    PAYLOAD_WITH_ID=$(python3 -c "
import json, sys
payload = json.loads(sys.argv[1])
payload['id'] = sys.argv[2]
json.dump(payload, sys.stdout)
" "$PAYLOAD" "$WF_ID")

    RESULT=$(echo "$PAYLOAD_WITH_ID" | n8n_curl -X POST -H "Content-Type: application/json" -d @- "$N8N_URL/api/v1/workflows" 2>&1) && {
      created=$((created + 1))
      echo "  [created] $WF_NAME (id: $WF_ID)"
    } || {
      failed=$((failed + 1))
      echo "  [FAILED]  $WF_NAME (id: $WF_ID) — create failed"
    }
  fi

  # Optionally activate the workflow
  if [ "$ACTIVATE" = true ] && [ "$failed" -eq 0 ] 2>/dev/null; then
    n8n_curl -X PATCH -H "Content-Type: application/json" \
      -d '{"active": true}' \
      "$N8N_URL/api/v1/workflows/$WF_ID" > /dev/null 2>&1 || true
  fi
done

echo ""
echo "Done: $created created, $updated updated, $failed failed."

if [ -f "$BACKUP_DIR/credentials/credentials.json" ]; then
  echo ""
  echo "Note: credentials were not restored (backup contains metadata only, no secrets)."
  echo "Re-create credentials manually in n8n if needed."
fi
