#!/usr/bin/env bash
# ABOUTME: Stops a named persistent Birdhouse sandbox, preserving its data.db and workspace.
# ABOUTME: Data is intentionally kept so the next run tests migrations against existing state.

set -euo pipefail

SANDBOX=""
WORKTREE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sandbox)
      SANDBOX="$2"
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

if [[ -z "$SANDBOX" ]]; then
  printf 'Usage: %s --sandbox <name>\n' "$0" >&2
  exit 1
fi

SANDBOX_DIR="$WORKTREE/sandboxes/$SANDBOX"
SERVER_PID_FILE="$SANDBOX_DIR/server.pid"

if [[ ! -f "$SERVER_PID_FILE" ]]; then
  printf 'No PID file found for sandbox %s. Already stopped?\n' "$SANDBOX"
  exit 0
fi

pid=$(cat "$SERVER_PID_FILE")
if kill -0 "$pid" 2>/dev/null; then
  kill "$pid"
  for _ in $(seq 1 50); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.1
  done
  printf 'Stopped sandbox %s (PID %s). Data preserved at %s\n' "$SANDBOX" "$pid" "$SANDBOX_DIR"
else
  printf 'Sandbox %s (PID %s) was not running.\n' "$SANDBOX" "$pid"
fi

rm -f "$SERVER_PID_FILE"
