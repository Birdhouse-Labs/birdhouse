---
name: isolated-birdhouse-web-testing
description: Add isolated Birdhouse web testing to an existing worktree-based agent workflow. Teaches agents to delegate browser validation to child agents, capture screenshots and MP4s, and clean up isolated runs when Cody asks.
tags:
  - birdhouse-development
  - testing
  - browser
trigger_phrases:
  - isolated Birdhouse web testing
  - worktree browser testing
  - isolated Birdhouse browser testing
metadata:
  internal: true
---

# Isolated Birdhouse Web Testing

Use this skill when you already have agents doing implementation work on a worktree and you want to add isolated Birdhouse web testing without colliding with other worktrees, agents, or test runs.

This skill is about:

- claiming a safe isolated port range
- starting a disposable Birdhouse instance from the current worktree
- delegating browser testing to child agents instead of doing it yourself
- reusing those browser agents through replies for retest and final demo capture
- preserving a reviewable run directory until Cody explicitly asks for cleanup

This skill is not a general feature-development workflow. It assumes you already know what feature you are testing and already have implementation agents or teammates carrying that work.

## Core Rules

1. Test the current worktree, not the main clone.
2. Give every isolated run a timestamped run directory under the current worktree.
3. Claim a full 20-port block instead of choosing ports by hand.
4. Delegate browser work to child agents. Do not do high-context browser testing in the parent implementation agent.
5. Reuse browser child agents via `agent_reply` for retest and final recording.
6. Keep the whole isolated run intact for review until Cody explicitly says cleanup is okay.

## Port Model

Use `scripts/claim-isolated-port-range.sh` to claim a base port from this sequence:

- `50140`
- `50160`
- `50180`
- ...

Each run owns a full 20-port block:

- Birdhouse server: `BASE_PORT`
- OpenCode workspaces: `BASE_PORT + 10` and above

Example:

```bash
BASE_PORT=50140
OPENCODE_PORT_BASE=50150
```

The script uses the shared git common dir for locking so different worktrees do not race each other.

## Run Directory Model

Use `scripts/start-isolated-birdhouse.sh` to create a timestamped run under:

```bash
<worktree>/tmp/isolated-runs/
```

Each run keeps:

- `workspace/`
- `screenshots/`
- `data.db`
- `server.log`
- `server.pid`
- `run-notes.md`

Treat the run directory as the review package. Do not auto-delete it after a successful test.

## Running from a Worktree

Use a Birdhouse worktree instead of the main clone when:

- testing a feature branch in isolation before merging
- running a rebase against a new OpenCode version (e.g. verifying a `v1.16.2` build)

### Two-worktree pattern

You need two worktrees: one for Birdhouse, one for OpenCode.

**Birdhouse worktree** — a normal git worktree on your feature branch:

```bash
git worktree add worktrees/my-feature -b my-feature origin/main
```

**OpenCode worktree** — typically a checked-out tag or rebase target, e.g.:

```
/tmp/opencode-v1.16.2
```

### Setup steps

1. Create the Birdhouse worktree (if not already done):

   ```bash
   git worktree add worktrees/my-feature -b my-feature origin/main
   ```

2. Prepare it (installs server deps and builds the frontend dist):

   ```bash
   bash sandboxes/setup-worktree.sh --worktree worktrees/my-feature
   ```

3. Start the sandbox pointing at both worktrees:

   ```bash
   bash sandboxes/start-sandbox.sh \
     --sandbox sandbox1 \
     --opencode-path /tmp/opencode-v1.16.2 \
     --worktree /abs/path/to/worktrees/my-feature
   ```

   Use an absolute path for `--worktree`.

**Note on `.env`:** Worktrees do not have a `.env` file, and `start-sandbox.sh` does not need one. All required env vars (`BIRDHOUSE_BASE_PORT`, `OPENCODE_PATH`, `BIRDHOUSE_DATA_DB_PATH`, `FRONTEND_STATIC`) are passed explicitly by the script. Do not copy `.env` from the main clone — it contains machine-specific paths and a hardcoded `OPENCODE_PATH` that will conflict with sandbox configuration.

### OpenCode worktree quick setup

OpenCode needs its own preparation before `start-sandbox.sh` will accept it:

1. `bun install` in the opencode repo root
2. Copy the Birdhouse plugin source:
   ```bash
   cp projects/birdhouse-oc-plugin/src/plugin.ts \
     <opencode-path>/packages/opencode/src/plugin/birdhouse.ts
   ```

For the full rebase workflow and plugin copy steps, see the `opencode-rebase` skill.

### Verifying both sides are running the right code

After the sandbox starts, confirm each side is serving from the expected directory:

**OpenCode** — confirm working directory:

```bash
lsof -p $(lsof -ti tcp:50210) | grep cwd
```

**OpenCode fork identity** — must contain `birdhouseWorkspaceId`:

```bash
curl -s http://127.0.0.1:50210/global/health
```

**Birdhouse server** — confirm working directory:

```bash
lsof -p $(lsof -ti tcp:50200) | grep cwd
```

Adjust ports if you used sandbox2 (`50220`/`50230`) or another block.

**Common failure:** `start-sandbox.sh` checks if a healthy process is already on the port and returns early without restarting. If the `cwd` check shows the main clone instead of your worktree, the old process is still running. Stop it with `bash sandboxes/stop-sandbox.sh --sandbox sandbox1` and start again with `--worktree`.

## Delegation Pattern

Parent or implementation agents should delegate browser testing to child agents. Those browser agents should be long-lived enough to accept retest instructions by reply.

Recommended split:

- parent agent owns the feature context and decides what behavior must be validated
- browser child agent owns the browser session, screenshots, recording, and testing notes

The parent should give the browser child agent:

- exact worktree path
- exact run dir
- exact Birdhouse server port and URL
- exact workspace id or setup URL
- exact behavior to validate
- explicit artifact expectations
- explicit instruction to report findings, not fix code

Then reuse that same browser agent with replies such as:

- `Retest the same path after the frontend fix.`
- `Rerun only steps 3-5 and update the screenshots.`
- `Record the best short demo of the happy path now.`

For concrete prompting guidance, browser execution patterns, and recording flow, read `references/browser-agent-workflow.md`.

## Cleanup Model

There are two cleanup levels:

1. `scripts/stop-isolated-birdhouse.sh`
This stops the isolated server but keeps the run directory and artifacts intact.

2. `scripts/trash-isolated-run.sh`
This closes browser sessions, stops the server, removes the port lock, and deletes the entire run directory.

Only run `trash-isolated-run.sh` when Cody explicitly asks for cleanup.

For exact cleanup expectations, read `references/cleanup.md`.

## Scripts

- `scripts/claim-isolated-port-range.sh`
- `scripts/start-isolated-birdhouse.sh`
- `scripts/stop-isolated-birdhouse.sh`
- `scripts/trash-isolated-run.sh`

## References

- `references/browser-agent-workflow.md`
- `references/cleanup.md`

## Out Of Scope

This skill does not try to teach:

- full feature-development workflow
- backend/frontend/database team structure
- generic `browser-use` documentation
- broad AAPI endpoint reference material
- non-web testing workflows

It only teaches how to add isolated Birdhouse web testing and demo capture to worktree-based agent work.
