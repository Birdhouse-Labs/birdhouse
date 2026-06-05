# sandbox1

Persistent isolated Birdhouse environment for manual testing and rebase smoke tests.

## What this is

A fixed Birdhouse instance with its own `data.db`, workspace directory, and logs.
State accumulates across runs intentionally — this lets rebase smoke tests exercise
data migrations against real existing data, the same way a real user upgrade would.

## How to start

From the birdhouse-workspace root:

```bash
bash sandboxes/start-sandbox.sh --sandbox sandbox1 \
  --opencode-path "$(pwd)/.worktrees/opencode-birdhouse"
```

`--opencode-path` must be absolute. `$(pwd)` from the workspace root avoids hardcoding it.

**During a rebase**, override to the rebase worktree:
```bash
bash sandboxes/start-sandbox.sh --sandbox sandbox1 \
  --opencode-path /tmp/opencode-v<version>
```

Birdhouse will be at: http://127.0.0.1:50200

## How to stop

```bash
bash sandboxes/stop-sandbox.sh --sandbox sandbox1
```

## What's inside

- `data.db` — Birdhouse database (workspaces, agents, sessions). Persists across restarts.
- `workspace/` — The opencode workspace directory used by the default workspace.
- `screenshots/` — Drop screenshots here when capturing smoke test evidence.
- `server.log` — Log from the most recent server run (overwritten each start).
- `server.pid` — PID of the currently running server (if any).

## OpenCode worktree

The opencode fork runs from `.worktrees/opencode-birdhouse` (permanent — not in /tmp).
After a rebase, update that worktree to the new branch and restart the sandbox.

After a reboot, `bun install` does NOT need to be re-run — node_modules persist
because the worktree is not in /tmp.

## Port

Fixed at 50200. Not claimed via the dynamic port script — it's a permanent reservation.

## Verifying the opencode fork

After starting, the workspace auto-spawns opencode on first request. Then:

```bash
curl -s http://127.0.0.1:50210/global/health
```

`birdhouseWorkspaceId` in the response confirms this is the Birdhouse fork.
The opencode port is BASE_PORT + 10 = 50210.

## Data isolation note

`data.db` (workspace list, user profile, API keys) is fully contained here.
Per-workspace opencode data (agents.db, XDG dirs) writes to
`~/Library/Application Support/Birdhouse/workspaces/<workspace_id>/`.
Workspace IDs are unique so this doesn't collide with live Birdhouse data,
but it is not yet fully self-contained. A future `BIRDHOUSE_DATA_ROOT` env
var would fix this.
