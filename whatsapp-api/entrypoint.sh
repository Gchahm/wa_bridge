#!/bin/sh
set -e

export PATH="$HOME/.local/bin:$PATH"

if ! command -v claude >/dev/null 2>&1; then
    echo "[wa-bridge] Installing Claude Code CLI..."
    npm install -g @anthropic-ai/claude-code
fi

exec "$@"
