#!/usr/bin/env bash
# ABOUTME: Stops a detached isolated Birdhouse server while preserving the run directory and artifacts.
# ABOUTME: Uses the server PID file from the run directory and reports whether the server was stopped or already down.

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

PID_FILE="$RUN_DIR/server.pid"
if [[ ! -f "$PID_FILE" ]]; then
  printf 'No server.pid found in %s\n' "$RUN_DIR"
  exit 0
fi

server_pid=$(tr -d '[:space:]' <"$PID_FILE")
if [[ -z "$server_pid" ]]; then
  printf 'Empty server PID in %s\n' "$PID_FILE"
  exit 0
fi

if kill -0 "$server_pid" >/dev/null 2>&1; then
  kill "$server_pid" >/dev/null 2>&1 || true
  for _ in $(seq 1 15); do
    if ! kill -0 "$server_pid" >/dev/null 2>&1; then
      printf 'Stopped isolated Birdhouse server PID %s\n' "$server_pid"
      exit 0
    fi
    sleep 1
  done
  kill -9 "$server_pid" >/dev/null 2>&1 || true
  printf 'Force-stopped isolated Birdhouse server PID %s\n' "$server_pid"
else
  printf 'Isolated Birdhouse server PID %s was already stopped\n' "$server_pid"
fi
