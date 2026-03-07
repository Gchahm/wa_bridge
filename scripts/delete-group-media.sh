#!/usr/bin/env bash
# Deletes all media files from the wa-media storage bucket that belong to group chats.
# Group chat folders have chat IDs ending in @g.us
#
# Usage: ./scripts/delete-group-media.sh
#
# Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in scripts/.env or environment.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/.env"
fi

: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_SERVICE_KEY:?SUPABASE_SERVICE_KEY is required}"

BUCKET="wa-media"
API="$SUPABASE_URL/storage/v1"
AUTH="Authorization: Bearer $SUPABASE_SERVICE_KEY"

echo "Listing top-level folders in $BUCKET..."

# List all top-level folders/files in the bucket
folders=$(curl -s -X POST "$API/object/list/$BUCKET" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"prefix":"","limit":1000,"offset":0}')

# Extract group chat folder names (ending with @g.us)
group_folders=$(echo "$folders" | jq -r '.[] | select(.name | endswith("@g.us")) | .name')

if [ -z "$group_folders" ]; then
  echo "No group chat folders found."
  exit 0
fi

count=$(echo "$group_folders" | wc -l | tr -d ' ')
echo "Found $count group chat folder(s):"
echo "$group_folders" | head -10
if [ "$count" -gt 10 ]; then
  echo "... and $((count - 10)) more"
fi

read -rp "Delete all files in these folders? (y/N) " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

deleted=0
errors=0

for folder in $group_folders; do
  echo "Processing $folder..."

  offset=0
  while true; do
    # List files in this folder
    files=$(curl -s -X POST "$API/object/list/$BUCKET" \
      -H "$AUTH" \
      -H "Content-Type: application/json" \
      -d "{\"prefix\":\"$folder/\",\"limit\":100,\"offset\":$offset}")

    # Get file paths
    paths=$(echo "$files" | jq -r --arg f "$folder" '.[] | select(.id != null) | "\($f)/\(.name)"')

    if [ -z "$paths" ]; then
      break
    fi

    # Build JSON array of paths for batch delete
    json_array=$(echo "$paths" | jq -R -s 'split("\n") | map(select(length > 0))')

    result=$(curl -s -w "\n%{http_code}" -X DELETE "$API/object/$BUCKET" \
      -H "$AUTH" \
      -H "Content-Type: application/json" \
      -d "{\"prefixes\":$json_array}")

    http_code=$(echo "$result" | tail -1)
    if [ "$http_code" = "200" ]; then
      batch_count=$(echo "$paths" | wc -l | tr -d ' ')
      deleted=$((deleted + batch_count))
      echo "  Deleted $batch_count file(s)"
    else
      echo "  Error (HTTP $http_code): $(echo "$result" | head -1)"
      errors=$((errors + 1))
    fi

    file_count=$(echo "$files" | jq 'length')
    if [ "$file_count" -lt 100 ]; then
      break
    fi
    offset=$((offset + 100))
  done
done

echo ""
echo "Done. Deleted $deleted file(s) across $count group folder(s). Errors: $errors"
