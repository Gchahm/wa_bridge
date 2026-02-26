#!/bin/bash
#
# Exports all n8n workflows and credentials (without secrets) to n8n/
#
# Uses the n8n CLI inside the Docker container.
# Requires the n8n container to be running.
#
# Usage:
#   ./scripts/backup-n8n.sh
#   ./scripts/backup-n8n.sh --container my-n8n-container
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/n8n"
CONTAINER="${N8N_CONTAINER:-wa_bridge-n8n-1}"
TEMP_DIR="/tmp/n8n-backup"

# CLI overrides
while [[ $# -gt 0 ]]; do
  case "$1" in
    --container) CONTAINER="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Verify container is running
if ! docker inspect "$CONTAINER" &>/dev/null; then
  echo "Error: container '$CONTAINER' not found. Is n8n running?"
  exit 1
fi

# Export inside the container, then copy out
echo "Exporting workflows..."
docker exec "$CONTAINER" sh -c "rm -rf $TEMP_DIR && mkdir -p $TEMP_DIR/workflows $TEMP_DIR/credentials"
docker exec "$CONTAINER" n8n export:workflow --backup --output="$TEMP_DIR/workflows/"
docker exec "$CONTAINER" n8n export:credentials --backup --output="$TEMP_DIR/credentials/" 2>/dev/null || true

# Copy from container to host
mkdir -p "$BACKUP_DIR"
rm -rf "$BACKUP_DIR/workflows" "$BACKUP_DIR/credentials"
docker cp "$CONTAINER:$TEMP_DIR/workflows" "$BACKUP_DIR/workflows"
docker cp "$CONTAINER:$TEMP_DIR/credentials" "$BACKUP_DIR/credentials" 2>/dev/null || mkdir -p "$BACKUP_DIR/credentials"

# Cleanup inside container
docker exec "$CONTAINER" rm -rf "$TEMP_DIR"

WF_COUNT=$(find "$BACKUP_DIR/workflows" -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
CR_COUNT=$(find "$BACKUP_DIR/credentials" -name '*.json' 2>/dev/null | wc -l | tr -d ' ')

echo "Exported $WF_COUNT workflow(s) to n8n/workflows/"
echo "Exported $CR_COUNT credential(s) to n8n/credentials/"
echo "Done."
