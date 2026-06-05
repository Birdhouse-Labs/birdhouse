#!/usr/bin/env bash
# ABOUTME: Starts a detached isolated Birdhouse server for the current worktree and writes review notes.
# ABOUTME: Creates a timestamped run directory with logs, workspace area, screenshots area, and server metadata.

set -euo pipefail

WORKTREE=""
BASE_PORT=""
OPENCODE_PATH=""
PORT_LOCK_DIR=""
LABEL="isolated-run"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --worktree)
      WORKTREE="$2"
      shift 2
      ;;
    --base-port)
      BASE_PORT="$2"
      shift 2
      ;;
    --opencode-path)
      OPENCODE_PATH="$2"
      shift 2
      ;;
    --port-lock-dir)
      PORT_LOCK_DIR="$2"
      shift 2
      ;;
    --label)
      LABEL="$2"
      shift 2
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$WORKTREE" ]]; then
  WORKTREE=$(git rev-parse --show-toplevel)
fi

if [[ -z "$BASE_PORT" || -z "$OPENCODE_PATH" ]]; then
  printf 'Usage: %s --base-port <port> --opencode-path <path> [--worktree <path>] [--port-lock-dir <path>] [--label <name>]\n' "$0" >&2
  exit 1
fi

FRONTEND_STATIC="$WORKTREE/projects/birdhouse/frontend/dist"
SERVER_DIR="$WORKTREE/projects/birdhouse/server"
if [[ ! -d "$SERVER_DIR" ]]; then
  printf 'Expected Birdhouse server directory at %s\n' "$SERVER_DIR" >&2
  exit 1
fi

if [[ ! -d "$FRONTEND_STATIC" ]]; then
  printf 'Expected built frontend at %s. Run bun run build in projects/birdhouse/frontend first.\n' "$FRONTEND_STATIC" >&2
  exit 1
fi

timestamp=$(date +"%Y-%m-%d-%H-%M-%S")
slug=$(printf '%s' "$LABEL" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-')
slug=${slug#-}
slug=${slug%-}
if [[ -z "$slug" ]]; then
  slug="isolated-run"
fi

RUN_ROOT="$WORKTREE/tmp/isolated-runs"
RUN_DIR="$RUN_ROOT/${timestamp}-${slug}"
WORKSPACE_DIR="$RUN_DIR/workspace"
SCREENSHOT_DIR="$RUN_DIR/screenshots"
DATA_DB_PATH="$RUN_DIR/data.db"
SERVER_LOG="$RUN_DIR/server.log"
SERVER_PID_FILE="$RUN_DIR/server.pid"
PORT_LOCK_FILE="$RUN_DIR/port-lock-dir.txt"
RUN_NOTES="$RUN_DIR/run-notes.md"

mkdir -p "$WORKSPACE_DIR" "$SCREENSHOT_DIR"

if [[ -n "$PORT_LOCK_DIR" ]]; then
  printf '%s\n' "$PORT_LOCK_DIR" >"$PORT_LOCK_FILE"
fi

cd "$SERVER_DIR"
nohup env \
  BIRDHOUSE_BASE_PORT="$BASE_PORT" \
  BIRDHOUSE_DATA_DB_PATH="$DATA_DB_PATH" \
  FRONTEND_STATIC="$FRONTEND_STATIC" \
  OPENCODE_PATH="$OPENCODE_PATH" \
  bun --env-file=../.env src/index.ts >"$SERVER_LOG" 2>&1 &
server_pid=$!
printf '%s\n' "$server_pid" >"$SERVER_PID_FILE"

server_url="http://127.0.0.1:${BASE_PORT}"
for _ in $(seq 1 60); do
  if curl -sSf "$server_url/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! kill -0 "$server_pid" >/dev/null 2>&1 || ! curl -sSf "$server_url/api/health" >/dev/null 2>&1; then
  kill "$server_pid" >/dev/null 2>&1 || true
  printf 'Isolated Birdhouse server did not become healthy at %s\n' "$server_url" >&2
  exit 1
fi

cat >"$RUN_NOTES" <<EOF
# Isolated Run

## Identity
- Created: $(date '+%Y-%m-%d %H:%M:%S %z')
- Worktree: $WORKTREE
- Label: $LABEL

## Ports
- Birdhouse: $BASE_PORT
- OpenCode port base: $((BASE_PORT + 10))
EOF

if [[ -n "$PORT_LOCK_DIR" ]]; then
  cat >>"$RUN_NOTES" <<EOF
- Port lock: $PORT_LOCK_DIR
EOF
fi

cat >>"$RUN_NOTES" <<EOF

## Runtime
- Run dir: $RUN_DIR
- Workspace dir: $WORKSPACE_DIR
- Server URL: $server_url
- Server PID: $server_pid

## Artifacts
- Screenshots: $SCREENSHOT_DIR
- Log: $SERVER_LOG

## Status
- State: running

## Cleanup
- Use stop-isolated-birdhouse.sh to stop the server and preserve artifacts.
- Use trash-isolated-run.sh only when Cody explicitly says cleanup is okay.
EOF

printf 'RUN_DIR=%s\n' "$RUN_DIR"
printf 'WORKSPACE_DIR=%s\n' "$WORKSPACE_DIR"
printf 'SCREENSHOT_DIR=%s\n' "$SCREENSHOT_DIR"
printf 'SERVER_URL=%s\n' "$server_url"
printf 'SERVER_PID=%s\n' "$server_pid"
printf 'RUN_NOTES=%s\n' "$RUN_NOTES"
