#!/bin/bash
#
# Creates a Grafana service account with Viewer role and prints an API token.
# The token can be used by mcp-grafana to query dashboards, Prometheus, and Loki.
#
# Usage:
#   ./scripts/setup-grafana-token.sh
#   ./scripts/setup-grafana-token.sh http://grafana.example.com:3000
#
# Requires: curl, jq
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

check_deps() {
  for cmd in curl jq; do
    if ! command -v "$cmd" &>/dev/null; then
      echo "Error: $cmd is required but not found" >&2
      exit 1
    fi
  done
}

grafana_api() {
  local method="$1" path="$2"
  shift 2
  curl -sf -X "$method" "${GRAFANA_URL}${path}" \
    -H 'Content-Type: application/json' \
    "${AUTH_HEADER[@]+"${AUTH_HEADER[@]}"}" \
    "$@"
}

check_deps

# Verify Grafana is reachable
if ! grafana_api GET /api/health >/dev/null 2>&1; then
  echo "Error: cannot reach Grafana at $GRAFANA_URL" >&2
  exit 1
fi

# Check if service account already exists
EXISTING_SA=$(grafana_api GET "/api/serviceaccounts/search?query=${SA_NAME}" 2>/dev/null || echo '{}')
SA_ID=$(echo "$EXISTING_SA" | jq -r ".serviceAccounts[]? | select(.name==\"${SA_NAME}\") | .id" 2>/dev/null)

if [ -n "$SA_ID" ]; then
  echo "Service account '${SA_NAME}' already exists (id: ${SA_ID})" >&2

  # Check for existing tokens
  EXISTING_TOKENS=$(grafana_api GET "/api/serviceaccounts/${SA_ID}/tokens" 2>/dev/null || echo '[]')
  EXISTING_TOKEN_ID=$(echo "$EXISTING_TOKENS" | jq -r ".[]? | select(.name==\"${TOKEN_NAME}\") | .id" 2>/dev/null)

  if [ -n "$EXISTING_TOKEN_ID" ]; then
    echo "Deleting existing '${TOKEN_NAME}' token to generate a new one..." >&2
    grafana_api DELETE "/api/serviceaccounts/${SA_ID}/tokens/${EXISTING_TOKEN_ID}" >/dev/null
  fi
else
  echo "Creating service account '${SA_NAME}'..." >&2
  SA_RESPONSE=$(grafana_api POST /api/serviceaccounts -d "{\"name\":\"${SA_NAME}\",\"role\":\"Viewer\"}")
  SA_ID=$(echo "$SA_RESPONSE" | jq -r '.id')

  if [ -z "$SA_ID" ] || [ "$SA_ID" = "null" ]; then
    echo "Error: failed to create service account" >&2
    echo "$SA_RESPONSE" >&2
    exit 1
  fi
  echo "Created service account (id: ${SA_ID})" >&2
fi

# Generate token
TOKEN_RESPONSE=$(grafana_api POST "/api/serviceaccounts/${SA_ID}/tokens" -d "{\"name\":\"${TOKEN_NAME}\"}")
TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.key')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Error: failed to create token" >&2
  echo "$TOKEN_RESPONSE" >&2
  exit 1
fi

# Print only the token to stdout (all other messages go to stderr)
echo "$TOKEN"

echo "" >&2
echo "Export it in your shell:" >&2
echo "  export GRAFANA_SERVICE_ACCOUNT_TOKEN=\"${TOKEN}\"" >&2
