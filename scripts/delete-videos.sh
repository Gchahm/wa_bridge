#!/usr/bin/env bash
# Deletes all video files (.mp4, .3gp) from the wa-media storage bucket.
#
# Usage: ./scripts/delete-videos.sh
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

# List all top-level folders in the bucket
folders=$(curl -s -X POST "$API/object/list/$BUCKET" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"prefix":"","limit":1000,"offset":0}')

folder_names=$(echo "$folders" | jq -r '.[] | select(.id == null) | .name')

if [ -z "$folder_names" ]; then
  echo "No folders found."
  exit 0
fi

# Collect all video paths across all folders
echo "Scanning for video files (.mp4, .3gp)..."
all_video_paths=""

for folder in $folder_names; do
  offset=0
  while true; do
    files=$(curl -s -X POST "$API/object/list/$BUCKET" \
      -H "$AUTH" \
      -H "Content-Type: application/json" \
      -d "{\"prefix\":\"$folder/\",\"limit\":100,\"offset\":$offset}")

    videos=$(echo "$files" | jq -r --arg f "$folder" \
      '.[] | select(.id != null) | select(.name | test("\\.(mp4|3gp)$")) | "\($f)/\(.name)"')

    if [ -n "$videos" ]; then
      if [ -z "$all_video_paths" ]; then
        all_video_paths="$videos"
      else
        all_video_paths="$all_video_paths
$videos"
      fi
    fi

    file_count=$(echo "$files" | jq 'length')
    if [ "$file_count" -lt 100 ]; then
      break
    fi
    offset=$((offset + 100))
  done
done

if [ -z "$all_video_paths" ]; then
  echo "No video files found."
  exit 0
fi

total_videos=$(echo "$all_video_paths" | wc -l | tr -d ' ')
echo "Found $total_videos video file(s)."
echo "$all_video_paths" | head -5
if [ "$total_videos" -gt 5 ]; then
  echo "... and $((total_videos - 5)) more"
fi

read -rp "Delete all video files? (y/N) " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

deleted=0
errors=0

# Delete in batches of 100
while [ -n "$all_video_paths" ]; do
  batch=$(echo "$all_video_paths" | head -100)
  remaining=$(echo "$all_video_paths" | tail -n +101)
  all_video_paths="$remaining"

  json_array=$(echo "$batch" | jq -R -s 'split("\n") | map(select(length > 0))')

  result=$(curl -s -w "\n%{http_code}" -X DELETE "$API/object/$BUCKET" \
    -H "$AUTH" \
    -H "Content-Type: application/json" \
    -d "{\"prefixes\":$json_array}")

  http_code=$(echo "$result" | tail -1)
  if [ "$http_code" = "200" ]; then
    batch_count=$(echo "$batch" | wc -l | tr -d ' ')
    deleted=$((deleted + batch_count))
    echo "Deleted $deleted / $total_videos"
  else
    echo "Error (HTTP $http_code): $(echo "$result" | head -1)"
    errors=$((errors + 1))
  fi
done

echo ""
echo "Done. Deleted $deleted video file(s). Errors: $errors"
