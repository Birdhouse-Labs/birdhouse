#!/usr/bin/env bash
# ABOUTME: Restores an archived isolated Birdhouse test workspace snapshot from a tar.gz package.
# ABOUTME: Optionally stops the Birdhouse server and trashes any current conflicting state before restore.

set -euo pipefail

ARCHIVE_PATH=""
SERVER_PORT=""
TRASH_EXISTING=false
TRASH_DIR="${HOME}/.Trash"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
STAGING_DIR=""

usage() {
  cat <<'EOF'
Usage:
  restore-external-test-workspace.sh \
    --archive-path <archive_path> \
    [--server-port <port>] \
    [--trash-existing]

Restores a snapshot created by archive-external-test-workspace.sh.
If --trash-existing is provided, conflicting current state is moved to ~/.Trash first.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --archive-path)
      ARCHIVE_PATH="$2"
      shift 2
      ;;
    --server-port)
      SERVER_PORT="$2"
      shift 2
      ;;
    --trash-existing)
      TRASH_EXISTING=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$ARCHIVE_PATH" ]]; then
  usage >&2
  exit 1
fi

stop_server_on_port() {
  local port="$1"
  local pids

  pids="$(lsof -t -i:"${port}" 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    echo "no server found on port ${port}"
    return 0
  fi

  echo "stopping server on port ${port}: ${pids}"
  kill ${pids}

  for _ in 1 2 3 4 5; do
    sleep 1
    if ! lsof -t -i:"${port}" >/dev/null 2>&1; then
      echo "server on port ${port} stopped cleanly"
      return 0
    fi
  done

  pids="$(lsof -t -i:"${port}" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "forcing server stop on port ${port}: ${pids}"
    kill -9 ${pids}
  fi
}

move_to_trash_if_exists() {
  local source_path="$1"

  if [[ ! -e "$source_path" ]]; then
    return 0
  fi

  local base_name
  base_name="$(basename "$source_path")"
  local target_path="${TRASH_DIR}/${base_name}.${TIMESTAMP}"

  echo "trash existing: $source_path -> $target_path"
  mv "$source_path" "$target_path"
}

copy_if_exists() {
  local source_path="$1"
  local target_path="$2"

  if [[ ! -e "$source_path" ]]; then
    return 0
  fi

  mkdir -p "$(dirname "$target_path")"
  cp -R "$source_path" "$target_path"
}

cleanup() {
  if [[ -n "$STAGING_DIR" && -d "$STAGING_DIR" ]]; then
    rm -rf "$STAGING_DIR"
  fi
}

trap cleanup EXIT

if [[ -n "$SERVER_PORT" ]]; then
  stop_server_on_port "$SERVER_PORT"
fi

STAGING_DIR="$(mktemp -d)"
tar -xzf "$ARCHIVE_PATH" -C "$STAGING_DIR"

# shellcheck disable=SC1091
source "${STAGING_DIR}/manifest.env"

if [[ "$TRASH_EXISTING" == true ]]; then
  move_to_trash_if_exists "$WORKSPACE_DIR"
  move_to_trash_if_exists "$DATA_DB_PATH"
  move_to_trash_if_exists "${DATA_DB_PATH}-shm"
  move_to_trash_if_exists "${DATA_DB_PATH}-wal"
  move_to_trash_if_exists "${BIRDHOUSE_ROOT}/workspaces/${WORKSPACE_ID}"
fi

copy_if_exists "${STAGING_DIR}/workspace-dir" "$WORKSPACE_DIR"
copy_if_exists "${STAGING_DIR}/data-db" "$DATA_DB_PATH"
copy_if_exists "${STAGING_DIR}/data-db-shm" "${DATA_DB_PATH}-shm"
copy_if_exists "${STAGING_DIR}/data-db-wal" "${DATA_DB_PATH}-wal"
copy_if_exists "${STAGING_DIR}/app-support-workspace" "${BIRDHOUSE_ROOT}/workspaces/${WORKSPACE_ID}"

echo "Restored snapshot from: $ARCHIVE_PATH"
echo "Workspace ID: $WORKSPACE_ID"
echo "Workspace dir: $WORKSPACE_DIR"
