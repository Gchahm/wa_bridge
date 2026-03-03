#!/bin/bash
#
# Creates a Grafana service account with Viewer role and prints an API token.
# The token can be used by mcp-grafana to query dashboards, Prometheus, and Loki.
#
# Usage:
#   ./scripts/setup-grafana-token.sh
#   ./scripts/setup-grafana-token.sh http://grafana.example.com:3000
#
# Requires: curl, grep, sed
#

set -euo pipefail

GRAFANA_URL="${1:-http://localhost:3200}"
SA_NAME="claude-code"
TOKEN_NAME="mcp"

# When Grafana has auth enabled, pass credentials via GRAFANA_AUTH.
# Examples:
#   GRAFANA_AUTH="admin:admin"           (basic auth)
#   GRAFANA_AUTH="Bearer <api-key>"      (existing API key)
AUTH_HEADER=()
if [ -n "${GRAFANA_AUTH:-}" ]; then
  if [[ "$GRAFANA_AUTH" == Bearer* ]]; then
    AUTH_HEADER=(-H "Authorization: $GRAFANA_AUTH")
  else
    AUTH_HEADER=(--user "$GRAFANA_AUTH")
  fi
fi

# Extract a JSON string value by key. Handles simple flat objects.
# Usage: json_val '{"id":3,"name":"foo"}' "id"  =>  3
json_val() {
  local json="$1" key="$2"
  echo "$json" | grep -o "\"${key}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | sed "s/\"${key}\"[[:space:]]*:[[:space:]]*\"//;s/\"$//" || true
}

json_num() {
  local json="$1" key="$2"
  echo "$json" | grep -o "\"${key}\"[[:space:]]*:[[:space:]]*[0-9]*" | sed "s/\"${key}\"[[:space:]]*:[[:space:]]*//" || true
}

grafana_api() {
  local method="$1" path="$2"
  shift 2
  curl -sf -X "$method" "${GRAFANA_URL}${path}" \
    -H 'Content-Type: application/json' \
    "${AUTH_HEADER[@]+"${AUTH_HEADER[@]}"}" \
    "$@"
}

# Verify Grafana is reachable
if ! grafana_api GET /api/health >/dev/null 2>&1; then
  echo "Error: cannot reach Grafana at $GRAFANA_URL" >&2
  exit 1
fi

# Check if service account already exists
EXISTING_SA=$(grafana_api GET "/api/serviceaccounts/search?query=${SA_NAME}" 2>/dev/null || echo '{}')

# Look for our service account name in the response and grab its id
SA_ID=""
if echo "$EXISTING_SA" | grep -q "\"name\":\"${SA_NAME}\""; then
  # Extract the id from the object containing our name.
  # The search response is: {"serviceAccounts":[{"id":N,...,"name":"claude-code",...}],...}
  # Grab the chunk containing our SA name then extract the id from it.
  SA_CHUNK=$(echo "$EXISTING_SA" | grep -o "{[^}]*\"name\":\"${SA_NAME}\"[^}]*}")
  SA_ID=$(json_num "$SA_CHUNK" "id")
fi

if [ -n "$SA_ID" ]; then
  echo "Service account '${SA_NAME}' already exists (id: ${SA_ID})" >&2

  # Check for existing token and delete it so we can create a fresh one
  EXISTING_TOKENS=$(grafana_api GET "/api/serviceaccounts/${SA_ID}/tokens" 2>/dev/null || echo '[]')
  if echo "$EXISTING_TOKENS" | grep -q "\"name\":\"${TOKEN_NAME}\""; then
    TOKEN_CHUNK=$(echo "$EXISTING_TOKENS" | grep -o "{[^}]*\"name\":\"${TOKEN_NAME}\"[^}]*}")
    EXISTING_TOKEN_ID=$(json_num "$TOKEN_CHUNK" "id")
    if [ -n "$EXISTING_TOKEN_ID" ]; then
      echo "Deleting existing '${TOKEN_NAME}' token to generate a new one..." >&2
      grafana_api DELETE "/api/serviceaccounts/${SA_ID}/tokens/${EXISTING_TOKEN_ID}" >/dev/null
    fi
  fi
else
  echo "Creating service account '${SA_NAME}'..." >&2
  SA_RESPONSE=$(grafana_api POST /api/serviceaccounts -d "{\"name\":\"${SA_NAME}\",\"role\":\"Viewer\"}")
  SA_ID=$(json_num "$SA_RESPONSE" "id")

  if [ -z "$SA_ID" ]; then
    echo "Error: failed to create service account" >&2
    echo "$SA_RESPONSE" >&2
    exit 1
  fi
  echo "Created service account (id: ${SA_ID})" >&2
fi

# Generate token
TOKEN_RESPONSE=$(grafana_api POST "/api/serviceaccounts/${SA_ID}/tokens" -d "{\"name\":\"${TOKEN_NAME}\"}")
TOKEN=$(json_val "$TOKEN_RESPONSE" "key")

if [ -z "$TOKEN" ]; then
  echo "Error: failed to create token" >&2
  echo "$TOKEN_RESPONSE" >&2
  exit 1
fi

# Print only the token to stdout (all other messages go to stderr)
echo "$TOKEN"

echo "" >&2
echo "Export it in your shell:" >&2
echo "  export GRAFANA_SERVICE_ACCOUNT_TOKEN=\"${TOKEN}\"" >&2
