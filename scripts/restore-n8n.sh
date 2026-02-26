#!/bin/bash
#
# Imports all n8n workflows from n8n/workflows/ into a running n8n instance.
#
# Uses the n8n CLI inside the Docker container.
# Requires the n8n container to be running.
#
# Usage:
#   ./scripts/restore-n8n.sh
#   ./scripts/restore-n8n.sh --container my-n8n-container
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/n8n"
CONTAINER="${N8N_CONTAINER:-wa_bridge-n8n-1}"
TEMP_DIR="/tmp/n8n-restore"

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

# Check backup directories exist
if [ ! -d "$BACKUP_DIR/workflows" ]; then
  echo "Error: no workflows directory found at $BACKUP_DIR/workflows/"
  echo "Run ./scripts/backup-n8n.sh first."
  exit 1
fi

# Copy files into the container
docker exec --user root "$CONTAINER" sh -c "rm -rf $TEMP_DIR && mkdir -p $TEMP_DIR"
docker cp "$BACKUP_DIR/workflows" "$CONTAINER:$TEMP_DIR/workflows"

echo "Restoring workflows..."
docker exec "$CONTAINER" n8n import:workflow --separate --input="$TEMP_DIR/workflows/"

# Restore credentials if they exist
if [ -d "$BACKUP_DIR/credentials" ] && ls "$BACKUP_DIR/credentials"/*.json &>/dev/null; then
  docker cp "$BACKUP_DIR/credentials" "$CONTAINER:$TEMP_DIR/credentials"
  echo "Restoring credentials..."
  docker exec "$CONTAINER" n8n import:credentials --separate --input="$TEMP_DIR/credentials/"
fi

# Cleanup inside container
docker exec "$CONTAINER" rm -rf "$TEMP_DIR"

echo "Done."
