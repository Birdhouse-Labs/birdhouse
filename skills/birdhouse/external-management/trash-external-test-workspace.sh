#!/usr/bin/env bash
# ABOUTME: Moves an isolated Birdhouse test workspace and related data into the macOS Trash.
# ABOUTME: Optionally stops the Birdhouse server on a given port before cleanup.

set -euo pipefail

WORKSPACE_ID=""
WORKSPACE_DIR=""
DATA_DB_PATH=""
BIRDHOUSE_ROOT="${HOME}/Library/Application Support/Birdhouse"
SERVER_PORT=""
TRASH_DIR="${HOME}/.Trash"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

usage() {
  cat <<'EOF'
Usage:
  trash-external-test-workspace.sh \
    --workspace-id <workspace_id> \
    --workspace-dir <workspace_dir> \
    --data-db-path <data_db_path> \
    [--server-port <port>] \
    [--birdhouse-root <path>]

Moves the isolated workspace directory, custom data DB, DB sidecars, and
Birdhouse app-support workspace folder into ~/.Trash.
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

if [[ -z "$WORKSPACE_ID" || -z "$WORKSPACE_DIR" || -z "$DATA_DB_PATH" ]]; then
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

move_to_trash() {
  local source_path="$1"

  if [[ ! -e "$source_path" ]]; then
    echo "skip: $source_path"
    return 0
  fi

  local base_name
  base_name="$(basename "$source_path")"
  local target_path="${TRASH_DIR}/${base_name}.${TIMESTAMP}"

  echo "trash: $source_path -> $target_path"
  mv "$source_path" "$target_path"
}

if [[ -n "$SERVER_PORT" ]]; then
  stop_server_on_port "$SERVER_PORT"
fi

move_to_trash "$WORKSPACE_DIR"
move_to_trash "$DATA_DB_PATH"
move_to_trash "${DATA_DB_PATH}-shm"
move_to_trash "${DATA_DB_PATH}-wal"
move_to_trash "${BIRDHOUSE_ROOT}/workspaces/${WORKSPACE_ID}"

echo "Done. All requested paths were moved to ~/.Trash when present."
