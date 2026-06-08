#!/usr/bin/env bash
# ABOUTME: Prepares a Birdhouse worktree for sandbox use by installing dependencies and building the frontend.
# ABOUTME: Run this once after creating a worktree before using start-sandbox.sh --worktree.

set -euo pipefail

WORKTREE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
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

if [[ -z "$WORKTREE" ]]; then
  printf 'Usage: %s --worktree <path>\n' "$0" >&2
  exit 1
fi

if [[ ! -d "$WORKTREE" ]]; then
  printf 'Worktree path does not exist: %s\n' "$WORKTREE" >&2
  exit 1
fi

SERVER_DIR="$WORKTREE/projects/birdhouse/server"
FRONTEND_DIR="$WORKTREE/projects/birdhouse/frontend"

if [[ ! -d "$SERVER_DIR" ]]; then
  printf 'Expected server directory at %s\n' "$SERVER_DIR" >&2
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR" ]]; then
  printf 'Expected frontend directory at %s\n' "$FRONTEND_DIR" >&2
  exit 1
fi

printf '==> Installing server dependencies in %s\n' "$SERVER_DIR"
(cd "$SERVER_DIR" && bun install)

printf '==> Building frontend in %s\n' "$FRONTEND_DIR"
(cd "$FRONTEND_DIR" && bun run build)

printf '\n'
printf 'Worktree ready: %s\n' "$WORKTREE"
printf '\n'
printf 'Next steps:\n'
printf '  bash sandboxes/start-sandbox.sh \\\n'
printf '    --sandbox sandbox1 \\\n'
printf '    --opencode-path <opencode-repo-path> \\\n'
printf '    --worktree %s\n' "$WORKTREE"
