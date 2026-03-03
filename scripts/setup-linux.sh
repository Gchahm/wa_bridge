#!/bin/bash
#
# Sets up a fresh Linux (Debian/Ubuntu) machine with all dependencies
# needed to run the wa_bridge stack.
#
# Installs:
#   - Docker Engine + Docker Compose plugin
#   - Grafana Loki Docker log driver (ARM64)
#   - PostgreSQL client (psql)
#   - Python 3 (for n8n Code nodes)
#   - Git
#   - uv + uvx (Python package runner)
#
# Usage:
#   sudo ./scripts/setup-linux.sh
#

set -euo pipefail

# --- Helpers ---

info()  { echo -e "\n\033[1;34m[*]\033[0m $1"; }
ok()    { echo -e "\033[1;32m[+]\033[0m $1"; }
warn()  { echo -e "\033[1;33m[!]\033[0m $1"; }
fail()  { echo -e "\033[1;31m[-]\033[0m $1"; exit 1; }

check_root() {
  if [ "$(id -u)" -ne 0 ]; then
    fail "This script must be run as root (use sudo)."
  fi
}

# --- Docker ---

install_docker() {
  if command -v docker &>/dev/null; then
    ok "Docker already installed: $(docker --version)"
    return
  fi

  info "Installing Docker..."
  apt-get update
  apt-get install -y ca-certificates curl gnupg

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  ok "Docker installed: $(docker --version)"
}

setup_docker_user() {
  local target_user="${SUDO_USER:-}"
  if [ -z "$target_user" ]; then
    return
  fi

  if id -nG "$target_user" | grep -qw docker; then
    ok "User '$target_user' already in docker group."
    return
  fi

  info "Adding user '$target_user' to the docker group..."
  usermod -aG docker "$target_user"
  ok "User '$target_user' added to docker group (log out and back in to apply)."
}

# --- Loki Docker driver ---

LOKI_PLUGIN_IMAGE="grafana/loki-docker-driver:3.5.11-arm64"
LOKI_ALIAS="loki"

install_loki_driver() {
  if docker plugin ls --format '{{.Name}}' 2>/dev/null | grep -q "^${LOKI_ALIAS}:"; then
    ok "Loki Docker driver already installed."
    return
  fi

  info "Installing Loki Docker log driver plugin..."
  docker plugin install "$LOKI_PLUGIN_IMAGE" --alias "$LOKI_ALIAS" --grant-all-permissions
  ok "Loki Docker driver installed."
}

# --- PostgreSQL client ---

install_psql() {
  if command -v psql &>/dev/null; then
    ok "psql already installed: $(psql --version)"
    return
  fi

  info "Installing PostgreSQL client (psql)..."
  apt-get update
  apt-get install -y postgresql-client
  ok "psql installed: $(psql --version)"
}

# --- Python 3 ---

install_python() {
  if command -v python3 &>/dev/null; then
    ok "Python 3 already installed: $(python3 --version)"
    return
  fi

  info "Installing Python 3..."
  apt-get update
  apt-get install -y python3
  ok "Python 3 installed: $(python3 --version)"
}

# --- Git ---

install_git() {
  if command -v git &>/dev/null; then
    ok "Git already installed: $(git --version)"
    return
  fi

  info "Installing Git..."
  apt-get update
  apt-get install -y git
  ok "Git installed: $(git --version)"
}

# --- uv (provides uvx) ---

install_uv() {
  if command -v uvx &>/dev/null; then
    ok "uv already installed: $(uv --version)"
    return
  fi

  info "Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR=/usr/local/bin sh
  ok "uv installed: $(uv --version)"
}

# --- Main ---

main() {
  check_root

  info "Starting wa_bridge Linux setup..."

  install_docker
  setup_docker_user
  install_loki_driver
  install_psql
  install_python
  install_git
  install_uv

  echo ""
  ok "All dependencies installed."
  echo ""
  echo "  docker           $(docker --version 2>/dev/null || echo 'N/A')"
  echo "  docker compose   $(docker compose version 2>/dev/null || echo 'N/A')"
  echo "  loki driver      $(docker plugin ls 2>/dev/null | grep "$LOKI_ALIAS" || echo 'N/A')"
  echo "  psql             $(psql --version 2>/dev/null || echo 'N/A')"
  echo "  python3          $(python3 --version 2>/dev/null || echo 'N/A')"
  echo "  git              $(git --version 2>/dev/null || echo 'N/A')"
  echo "  uv               $(uv --version 2>/dev/null || echo 'N/A')"
  echo "  uvx              $(uvx --version 2>/dev/null || echo 'N/A')"
  echo ""
}

main
