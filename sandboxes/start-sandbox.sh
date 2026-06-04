#!/usr/bin/env bash
# ABOUTME: Starts a named persistent Birdhouse sandbox with a fixed port and reusable data directory.
# ABOUTME: Unlike isolated-run scripts, the sandbox data.db persists across restarts to test migrations.

set -euo pipefail

SANDBOX=""
OPENCODE_PATH=""
WORKTREE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sandbox)
      SANDBOX="$2"
      shift 2
      ;;
    --opencode-path)
      OPENCODE_PATH="$2"
      shift 2
      ;;
    --worktree)
      WORKTREE="$2"
      shift 2
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$SANDBOX" || -z "$OPENCODE_PATH" ]]; then
  printf 'Usage: %s --sandbox <name> --opencode-path <path> [--worktree <path>]\n' "$0" >&2
  exit 1
fi

SANDBOX_DIR="$WORKTREE/sandboxes/$SANDBOX"
if [[ ! -d "$SANDBOX_DIR" ]]; then
  printf 'Sandbox directory not found: %s\n' "$SANDBOX_DIR" >&2
  exit 1
fi

if [[ ! -d "$OPENCODE_PATH/packages/opencode" ]]; then
  printf 'OPENCODE_PATH does not look like an opencode repo: %s\n' "$OPENCODE_PATH" >&2
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

# Fixed port for sandbox1 = 50120. Add more sandboxes with different ports as needed.
case "$SANDBOX" in
  sandbox1) BASE_PORT=50200 ;;
  sandbox2) BASE_PORT=50220 ;;
  sandbox3) BASE_PORT=50240 ;;
  *)
    printf 'Unknown sandbox name: %s. Add a port mapping in this script for new sandboxes.\n' "$SANDBOX" >&2
    exit 1
    ;;
esac

DATA_DB_PATH="$SANDBOX_DIR/data.db"
SERVER_LOG="$SANDBOX_DIR/server.log"
SERVER_PID_FILE="$SANDBOX_DIR/server.pid"

# Check if already running
if [[ -f "$SERVER_PID_FILE" ]]; then
  existing_pid=$(cat "$SERVER_PID_FILE")
  if kill -0 "$existing_pid" 2>/dev/null; then
    printf 'Sandbox %s is already running (PID %s) at http://127.0.0.1:%s\n' "$SANDBOX" "$existing_pid" "$BASE_PORT"
    printf 'SERVER_URL=http://127.0.0.1:%s\n' "$BASE_PORT"
    printf 'SERVER_PID=%s\n' "$existing_pid"
    exit 0
  fi
fi

mkdir -p "$SANDBOX_DIR/workspace" "$SANDBOX_DIR/screenshots"

cd "$SERVER_DIR"
# Use --env-file so bun loads the same project .env that the dev server uses
# (needed for Hono static/route initialization to work correctly).
# Our explicit env vars are set in the process environment BEFORE bun runs,
# so they take precedence over any conflicting values in .env.
nohup env \
  BIRDHOUSE_BASE_PORT="$BASE_PORT" \
  BIRDHOUSE_DATA_DB_PATH="$DATA_DB_PATH" \
  FRONTEND_STATIC="$FRONTEND_STATIC" \
  OPENCODE_PATH="$OPENCODE_PATH" \
  bun --env-file=../.env src/index.ts >"$SERVER_LOG" 2>&1 &
server_pid=$!
printf '%s\n' "$server_pid" >"$SERVER_PID_FILE"

server_url="http://127.0.0.1:${BASE_PORT}"
printf 'Waiting for sandbox %s to become healthy at %s...\n' "$SANDBOX" "$server_url"
for _ in $(seq 1 60); do
  if curl -sSf "$server_url/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -sSf "$server_url/api/health" >/dev/null 2>&1; then
  kill "$server_pid" >/dev/null 2>&1 || true
  printf 'Sandbox %s did not become healthy. Check log: %s\n' "$SANDBOX" "$SERVER_LOG" >&2
  exit 1
fi

printf 'Sandbox %s running (PID %s)\n' "$SANDBOX" "$server_pid"
printf 'SERVER_URL=http://127.0.0.1:%s\n' "$BASE_PORT"
printf 'SERVER_PID=%s\n' "$server_pid"
printf 'SANDBOX_DIR=%s\n' "$SANDBOX_DIR"
printf 'DATA_DB=%s\n' "$DATA_DB_PATH"
printf 'OPENCODE_PORT=%s\n' "$((BASE_PORT + 10))"
