---
name: birdhouse/external-management
description: Use this skill when you need to test Birdhouse, AAPI, or plugin behavior in a separate Birdhouse server that you control via curl. Best for isolated read-mode testing, plugin changes, and real end-to-end agent workflows.
---

# Birdhouse External Management

Use this skill when your built-in Birdhouse tools point at one environment, but you need to test another Birdhouse environment that you control yourself.

This is the right approach when:

- you are changing OpenCode plugin behavior
- you are changing Birdhouse AAPI routes or read modes
- you want a real agent-controlled dev environment on its own ports
- you want to run an agent test suite in isolation
- you want a realistic multi-agent tree without polluting the current Birdhouse environment

## Core Mental Model

Your built-in Birdhouse tools talk to the Birdhouse environment you are currently inside.

When testing another Birdhouse server, treat it as an external HTTP API:

- start or reuse a separate Birdhouse server
- create or reuse a dedicated workspace in that server
- create agents through HTTP
- reply to them through HTTP
- read them through HTTP
- restart workspace OpenCode through HTTP

Agents created inside that separate environment will still get Birdhouse plugin tools if that Birdhouse server injects the Birdhouse system prompt and the OpenCode plugin correctly.

## Fast Path

If you just need a working isolated setup on this machine, use this shape:

```bash
BIRDHOUSE_BASE_PORT=50150
BIRDHOUSE_DATA_DB_PATH=/absolute/path/to/test-data.db
OPENCODE_PATH=/absolute/path/to/opencode
```

That gives you:

- Birdhouse server: `http://127.0.0.1:50150`
- OpenCode workspaces: ports starting at `50160`

If a known-good snapshot tarball already exists, restoring that snapshot is often faster and more reliable than rebuilding the dataset from scratch.

## Isolation Strategy

For most plugin/read-mode work, a unique workspace directory is enough to isolate the agent tree and test artifacts while still letting humans inspect that workspace from other Birdhouse instances.

Example workspace directory:

```bash
/Users/<user>/dev/<repo>/tmp/full-mode-e2e-workspace
```

If you also want a separate central Birdhouse database for that server, set:

```bash
BIRDHOUSE_DATA_DB_PATH=/absolute/path/to/test-data.db
```

## Setup On A Machine That Is Not Ready Yet

Check these prerequisites first:

1. Birdhouse repo exists locally
2. OpenCode repo exists locally
3. Provider keys are available somewhere you can reuse or copy

Recommended OpenCode checkout:

```bash
/Users/<user>/dev/oss/opencode
```

If OpenCode is missing, clone the Birdhouse OpenCode fork first.

## Snapshot-Based Setup

If you already have a known-good isolated dataset snapshot, restore it instead of rebuilding it by hand.

Current example snapshot path:

```bash
/Users/<user>/dev/<repo>/tmp/full-mode-e2e-snapshot.tar.gz
```

Restore it with:

```bash
/absolute/path/to/skills/birdhouse/external-management/restore-external-test-workspace.sh \
  --archive-path "/absolute/path/to/full-mode-e2e-snapshot.tar.gz" \
  --server-port 50150 \
  --trash-existing
```

Then start the external server again and restart the workspace OpenCode instance if needed.

## Start The External Birdhouse Server

Run from `projects/birdhouse/server`:

```bash
BIRDHOUSE_BASE_PORT=50150 \
BIRDHOUSE_DATA_DB_PATH="/absolute/path/to/test-data.db" \
OPENCODE_PATH="/absolute/path/to/opencode" \
bun --env-file=../.env src/index.ts
```

Health check:

```bash
curl -sS "http://127.0.0.1:50150/api/health"
```

If you restart the server after plugin changes, also restart the workspace OpenCode instance later so the workspace picks up the new plugin/runtime behavior.

## Create Or Reuse A Workspace

Create a dedicated workspace:

```bash
curl -sS -X POST "http://127.0.0.1:50150/api/workspaces/create" \
  -H "Content-Type: application/json" \
  -d '{
    "directory": "/absolute/path/to/test-workspace",
    "title": "birdhouse-plugin-test"
  }'
```

This returns a `workspace_id`.

## Seed Provider Keys

You need real provider keys before creating useful agents.

Two common approaches:

### Option A: supply keys during workspace creation

```bash
curl -sS -X POST "http://127.0.0.1:50150/api/workspaces/create" \
  -H "Content-Type: application/json" \
  -d '{
    "directory": "/absolute/path/to/test-workspace",
    "title": "birdhouse-plugin-test",
    "api_keys": {
      "anthropic": "...",
      "openai": "..."
    }
  }'
```

### Option B: update config after workspace creation

```bash
curl -sS -X PUT "http://127.0.0.1:50150/api/workspaces/WORKSPACE_ID/config" \
  -H "Content-Type: application/json" \
  -d '{
    "providers": {
      "anthropic": { "api_key": "..." },
      "openai": { "api_key": "..." }
    }
  }'
```

If another Birdhouse workspace already has working provider config, you can copy that config over instead of retyping it.

## Important Endpoint Choices

Use these endpoints intentionally:

- create fresh root agents through `/api/workspace/:workspaceId/agents`
- use `/aapi/agents/:id/messages` for reads
- use `/aapi/agents/:id/tool-calls/:callId` for drill-down

Why:

- `/api/workspace/:workspaceId/agents` is the cleanest path for creating a fresh root agent from outside Birdhouse
- `/aapi/agents` is best thought of as the agent-facing API and may rely on current session context for some flows like parentage, cloning, or `from_self`

## Useful HTTP Endpoints

Assume:

- `SERVER=http://127.0.0.1:50150`
- `WORKSPACE_ID=<workspace_id>`
- `AGENT_ID=<agent_id>`
- `CALL_ID=<call_id>`

### Create A Root Agent

```bash
curl -sS -X POST "$SERVER/api/workspace/$WORKSPACE_ID/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My agent",
    "prompt": "Do the task",
    "model": "anthropic/claude-sonnet-4-6",
    "wait": true
  }'
```

### Send A Follow-Up Message

```bash
curl -sS -X POST "$SERVER/api/workspace/$WORKSPACE_ID/agents/$AGENT_ID/messages?wait=true" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Do the next step"
  }'
```

### Read Agent Messages

```bash
curl -sS -H "X-Birdhouse-Workspace-ID: $WORKSPACE_ID" \
  "$SERVER/aapi/agents/$AGENT_ID/messages?mode=last"
```

Other modes:

- `mode=latest_turn`
- `mode=full`
- `mode=all`

### Read One Specific Tool Call

```bash
curl -sS -H "X-Birdhouse-Workspace-ID: $WORKSPACE_ID" \
  "$SERVER/aapi/agents/$AGENT_ID/tool-calls/$CALL_ID"
```

### Wait For An Agent

```bash
curl -sS -H "X-Birdhouse-Workspace-ID: $WORKSPACE_ID" \
  "$SERVER/aapi/agents/$AGENT_ID/wait"
```

### Read The Tree

```bash
curl -sS -H "X-Birdhouse-Workspace-ID: $WORKSPACE_ID" \
  "$SERVER/aapi/agents/$AGENT_ID/tree?requesting_agent_id=$AGENT_ID"
```

### Restart A Workspace OpenCode Instance

```bash
curl -sS -X POST "$SERVER/api/workspaces/$WORKSPACE_ID/restart"
```

### Check Workspace Health

```bash
curl -sS "$SERVER/api/workspaces/$WORKSPACE_ID/health"
```

## Raw OpenCode Validation

When validating how Birdhouse filters or reshapes messages, compare Birdhouse output against raw OpenCode session messages.

If your workspace OpenCode port is `50160`, the raw message endpoint looks like:

```bash
curl -sG "http://127.0.0.1:50160/session/SESSION_ID/message" \
  --data-urlencode "directory=/absolute/path/to/test-workspace"
```

Use this when you need to verify that Birdhouse filtering removed or preserved the right information.

## Running The Agent Test Suite

Use the suite entry point:

```bash
projects/birdhouse/agent-test-cases/run-agent-test-suite.md
```

Recommended workflow:

1. Create a root runner agent through HTTP.
2. Give it the path to `run-agent-test-suite.md`.
3. Tell it to follow the file exactly.
4. Allow the temp fixture file used by the read-exchange case.

Example runner prompt:

```text
Read and follow this file exactly:
`/absolute/path/to/projects/birdhouse/agent-test-cases/run-agent-test-suite.md`

Run the suite in your current Birdhouse environment and report the results exactly as the doc asks.

You may create or edit the specific temp fixture file required by the read-exchange test under `tmp/read-exchange-test/note.txt` because that is part of the test itself.
Do not modify unrelated files.
```

If your environment already has a restored snapshot that includes a fixed implementation-tree dataset, the suite can validate that richer artifact immediately.

## Writing A New Agent Test Case

If the existing suite is not enough, add a new test case under:

```bash
projects/birdhouse/agent-test-cases/
```

Recommended structure:

- purpose
- environment requirements
- procedure
- exact prompts or step sequence
- what to report
- what good looks like

When adding a new case:

1. Keep it human-readable markdown
2. Prefer real agent behavior over synthetic one-shot prompts
3. State clearly whether the case depends on fixed dataset agents
4. State clearly whether the case is allowed to write a temp fixture file
5. Update `projects/birdhouse/agent-test-cases/README.md`
6. Update `projects/birdhouse/agent-test-cases/run-agent-test-suite.md` if the runner needs new instructions or classification rules

Good candidates for new cases:

- read-mode edge cases
- multi-agent handoff workflows
- real implementation-tree comprehension
- plugin behavior validation after a server/workspace restart

## Refreshing The Snapshot After Building A Better Dataset

When you create a better isolated workspace tree and want future agents to reuse it, archive it.

Example:

```bash
/absolute/path/to/skills/birdhouse/external-management/archive-external-test-workspace.sh \
  --workspace-id <workspace_id> \
  --workspace-dir "/absolute/path/to/test-workspace" \
  --data-db-path "/absolute/path/to/test-data.db" \
  --archive-path "/absolute/path/to/test-snapshot.tar.gz" \
  --server-port 50150
```

This tar.gz captures:

- the workspace directory
- the custom Birdhouse data DB
- SQLite sidecars
- the app-support workspace folder

If you need to reset before restoring a snapshot, use:

```bash
/absolute/path/to/skills/birdhouse/external-management/trash-external-test-workspace.sh \
  --workspace-id <workspace_id> \
  --workspace-dir "/absolute/path/to/test-workspace" \
  --data-db-path "/absolute/path/to/test-data.db" \
  --server-port 50150
```

Restore the archive later with:

```bash
/absolute/path/to/skills/birdhouse/external-management/restore-external-test-workspace.sh \
  --archive-path "/absolute/path/to/test-snapshot.tar.gz" \
  --server-port 50150 \
  --trash-existing
```

## Plugin Testing Workflow

When working on plugin or read-mode changes:

1. Start the external Birdhouse server.
2. Create or reuse a dedicated workspace.
3. Seed provider keys.
4. Create a real agent through HTTP.
5. Drive it through multiple exchanges with HTTP replies.
6. Inspect it with `last`, `latest_turn`, `full`, and `all`.
7. Use `tool-calls/:callId` drill-down to inspect specific tool behavior.
8. Run the agent test suite if the change affects agent ergonomics or trust.
9. If plugin behavior changes, restart the server and then restart the workspace OpenCode instance.

## Common Pitfalls

- hitting the wrong Birdhouse server port
- forgetting the `X-Birdhouse-Workspace-ID` header for AAPI requests
- restarting the Birdhouse server but not the workspace OpenCode instance
- assuming your built-in Birdhouse tools are pointed at the same environment you are testing
- using `/aapi/agents` for fresh external root-agent creation when `/api/workspace/:workspaceId/agents` is the simpler fit
- forgetting to seed provider keys before creating real agents
- forgetting to verify whether `full` and `agent_read_tool_call` actually exist in the environment you are testing
- rebuilding a valuable implementation-tree dataset by hand when a snapshot tarball already exists
- using a workspace directory that collides with unrelated test data
