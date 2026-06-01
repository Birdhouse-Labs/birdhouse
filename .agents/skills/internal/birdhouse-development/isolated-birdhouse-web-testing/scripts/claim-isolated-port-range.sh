#!/usr/bin/env bash
# ABOUTME: Claims a shared isolated Birdhouse port range across worktrees using git-common-dir locks.
# ABOUTME: Reserves a 20-port block so Birdhouse and its OpenCode workspace ports do not collide.

set -euo pipefail

START_PORT=50140
END_PORT=50980
STEP=20
RUN_DIR=""
LABEL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --start-port)
      START_PORT="$2"
      shift 2
      ;;
    --end-port)
      END_PORT="$2"
      shift 2
      ;;
    --run-dir)
      RUN_DIR="$2"
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

GIT_COMMON_DIR=$(git rev-parse --git-common-dir)
LOCK_ROOT="$GIT_COMMON_DIR/isolated-port-locks"
mkdir -p "$LOCK_ROOT"

ports_are_free() {
  local base="$1"
  local port
  for ((port=base; port<base+20; port++)); do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      return 1
    fi
  done
  return 0
}

write_lock_info() {
  local lock_dir="$1"
  local base="$2"
  {
    printf 'Created: %s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')"
    printf 'Base port: %s\n' "$base"
    printf 'OpenCode port base: %s\n' "$((base + 10))"
    printf 'Host PID: %s\n' "$$"
    printf 'Working dir: %s\n' "$PWD"
    if [[ -n "$RUN_DIR" ]]; then
      printf 'Run dir: %s\n' "$RUN_DIR"
    fi
    if [[ -n "$LABEL" ]]; then
      printf 'Label: %s\n' "$LABEL"
    fi
  } >"$lock_dir/lock-info.txt"
}

base_port="$START_PORT"
while [[ "$base_port" -le "$END_PORT" ]]; do
  lock_dir="$LOCK_ROOT/${base_port}.lock"
  if mkdir "$lock_dir" 2>/dev/null; then
    if ports_are_free "$base_port"; then
      write_lock_info "$lock_dir" "$base_port"
      printf 'BASE_PORT=%s\n' "$base_port"
      printf 'OPENCODE_PORT_BASE=%s\n' "$((base_port + 10))"
      printf 'PORT_LOCK_DIR=%s\n' "$lock_dir"
      exit 0
    fi
    rm -rf "$lock_dir"
  fi
  base_port=$((base_port + STEP))
done

printf 'No free isolated Birdhouse port range found between %s and %s.\n' "$START_PORT" "$END_PORT" >&2
exit 1
