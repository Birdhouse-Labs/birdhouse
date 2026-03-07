#!/usr/bin/env bash
# ABOUTME: Creates a tar.gz snapshot of an isolated Birdhouse test workspace and related data.
# ABOUTME: Captures the workspace directory, custom data DB, DB sidecars, and app-support workspace folder.

set -euo pipefail

WORKSPACE_ID=""
WORKSPACE_DIR=""
DATA_DB_PATH=""
ARCHIVE_PATH=""
BIRDHOUSE_ROOT="${HOME}/Library/Application Support/Birdhouse"
SERVER_PORT=""
STAGING_DIR=""

usage() {
  cat <<'EOF'
Usage:
  archive-external-test-workspace.sh \
    --workspace-id <workspace_id> \
    --workspace-dir <workspace_dir> \
    --data-db-path <data_db_path> \
    --archive-path <archive_path> \
    [--server-port <port>] \
    [--birdhouse-root <path>]

Creates a restorable tar.gz snapshot for an isolated Birdhouse test environment.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace-id)
      WORKSPACE_ID="$2"
      shift 2
      ;;
    --workspace-dir)
      WORKSPACE_DIR="$2"
      shift 2
      ;;
    --data-db-path)
      DATA_DB_PATH="$2"
      shift 2
      ;;
    --archive-path)
      ARCHIVE_PATH="$2"
      shift 2
      ;;
    --server-port)
      SERVER_PORT="$2"
      shift 2
      ;;
    --birdhouse-root)
      BIRDHOUSE_ROOT="$2"
      shift 2
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

if [[ -z "$WORKSPACE_ID" || -z "$WORKSPACE_DIR" || -z "$DATA_DB_PATH" || -z "$ARCHIVE_PATH" ]]; then
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

copy_if_exists() {
  local source_path="$1"
  local target_path="$2"

  if [[ -e "$source_path" ]]; then
    mkdir -p "$(dirname "$target_path")"
    cp -R "$source_path" "$target_path"
  fi
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

cat >"${STAGING_DIR}/manifest.env" <<EOF
WORKSPACE_ID='${WORKSPACE_ID}'
WORKSPACE_DIR='${WORKSPACE_DIR}'
DATA_DB_PATH='${DATA_DB_PATH}'
BIRDHOUSE_ROOT='${BIRDHOUSE_ROOT}'
EOF

copy_if_exists "$WORKSPACE_DIR" "${STAGING_DIR}/workspace-dir"
copy_if_exists "$DATA_DB_PATH" "${STAGING_DIR}/data-db"
copy_if_exists "${DATA_DB_PATH}-shm" "${STAGING_DIR}/data-db-shm"
copy_if_exists "${DATA_DB_PATH}-wal" "${STAGING_DIR}/data-db-wal"
copy_if_exists "${BIRDHOUSE_ROOT}/workspaces/${WORKSPACE_ID}" "${STAGING_DIR}/app-support-workspace"

mkdir -p "$(dirname "$ARCHIVE_PATH")"
tar -czf "$ARCHIVE_PATH" -C "$STAGING_DIR" .

echo "Created archive: $ARCHIVE_PATH"
