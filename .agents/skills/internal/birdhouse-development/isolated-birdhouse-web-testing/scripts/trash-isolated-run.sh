#!/usr/bin/env bash
# ABOUTME: Deletes a finished isolated Birdhouse run after closing browser sessions and releasing the port lock.
# ABOUTME: Removes the entire timestamped run directory so temporary databases, logs, videos, and screenshots do not linger.

set -euo pipefail

RUN_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-dir)
      RUN_DIR="$2"
      shift 2
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$RUN_DIR" ]]; then
  printf 'Usage: %s --run-dir <path>\n' "$0" >&2
  exit 1
fi

SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" && pwd)
"$SCRIPT_DIR/stop-isolated-birdhouse.sh" --run-dir "$RUN_DIR"

browser-use close --all >/dev/null 2>&1 || true

PORT_LOCK_FILE="$RUN_DIR/port-lock-dir.txt"
if [[ -f "$PORT_LOCK_FILE" ]]; then
  port_lock_dir=$(tr -d '[:space:]' <"$PORT_LOCK_FILE")
  if [[ -n "$port_lock_dir" && -d "$port_lock_dir" ]]; then
    rm -rf "$port_lock_dir"
    printf 'Released port lock %s\n' "$port_lock_dir"
  fi
fi

rm -rf "$RUN_DIR"
printf 'Deleted isolated run %s\n' "$RUN_DIR"
