---
name: prod-opencode-instance-inspection
description: Inspect running production Birdhouse OpenCode instances correctly by mapping workspaces to directories and querying per-directory tool/config state.
tags:
  - birdhouse
  - opencode
  - production
  - debugging
trigger_phrases:
  - inspect prod opencode instances
  - debug production workspace opencode
  - check running opencode workspaces
  - verify workspace plugin tools
metadata:
  internal: true
---

# Prod OpenCode Instance Inspection

Use this skill when you need to inspect Birdhouse production workspaces and verify what each running OpenCode instance is actually exposing.

## Goal

Find:

- the production Birdhouse server
- the active workspaces
- each workspace directory
- the running OpenCode port and pid for each workspace
- the workspace health response
- the tools and config for the correct workspace directory

## Critical Rule

When querying a raw OpenCode port, always include the workspace directory in the request.

Why:

- OpenCode server routes default to `process.cwd()` when no directory is provided.
- Birdhouse-launched OpenCode processes can belong to workspace `X` while still resolving config for the server's current working directory if you omit `directory`.
- This can produce false positives, especially when the Birdhouse repo has a local `.opencode/opencode.json` that injects extra plugins.

## Step 1: Verify Birdhouse server is running

```bash
curl -sf http://127.0.0.1:50100/api/health
```

If this fails, confirm the Birdhouse launcher and server processes:

```bash
ps -ax -o pid=,command= | rg "$HOME/.birdhouse/dist/(birdhouse|server|opencode)"
```

## Step 2: Find production workspaces and their OpenCode ports

Birdhouse stores workspace metadata in:

- `~/Library/Application Support/Birdhouse/data.db`

Query active workspaces:

```bash
sqlite3 "$HOME/Library/Application Support/Birdhouse/data.db" \
  "select workspace_id,directory,opencode_port,opencode_pid from workspaces where opencode_port is not null order by opencode_port;"
```

This gives you:

- workspace id
- workspace directory
- running OpenCode port
- running OpenCode pid

## Step 3: Check which processes are actually running

```bash
ps -ax -o pid=,command= | rg "$HOME/.birdhouse/dist/opencode/.*/opencode serve --port"
```

Match the pids and ports from SQLite against the running process list.

## Step 4: Verify the health endpoint for one workspace

Health confirms the OpenCode process belongs to the expected Birdhouse workspace id.

Example:

```bash
curl -sf http://127.0.0.1:50112/global/health
```

Expected shape:

```json
{
  "healthy": true,
  "version": "...",
  "birdhouseWorkspaceId": "ws_..."
}
```

Important:

- `birdhouseWorkspaceId` proves which Birdhouse workspace owns the process.
- It does not prove which directory will be used to resolve config for your next request.

## Step 5: Query tools correctly for a specific workspace

Always pass the real workspace directory as a query parameter.

Example for workspace directory `$HOME/Documents/Family` on port `50112`:

```bash
curl -sf "http://127.0.0.1:50112/experimental/tool/ids?directory=%2FUsers%2Fyour-user%2FDocuments%2FFamily"
```

Use URL-encoded directory paths.

One portable way to build the encoded directory argument is:

```bash
DIR="$HOME/Documents/Family"
ENCODED_DIR=$(python3 -c 'import os,sys,urllib.parse; print(urllib.parse.quote(os.path.abspath(sys.argv[1])))' "$DIR")
curl -sf "http://127.0.0.1:50112/experimental/tool/ids?directory=$ENCODED_DIR"
```

Do not do this unless you intentionally want the server default directory behavior:

```bash
curl -sf http://127.0.0.1:50112/experimental/tool/ids
```

That can report tools for the wrong config context.

## Step 6: Query resolved config correctly for a specific workspace

```bash
curl -sf "http://127.0.0.1:50112/config?directory=%2FUsers%2Fyour-user%2FDocuments%2FFamily"
```

Check:

- `plugin`
- `enabled_providers`
- `provider`
- `mcp`

This is the authoritative per-directory resolved config for that workspace request.

## Step 7: Compare a workspace inside and outside the Birdhouse repo tree

This is useful when debugging project config inheritance.

For a workspace under the Birdhouse repo tree:

```bash
curl -sf "http://127.0.0.1:50114/config?directory=%2FUsers%2Fyour-user%2Fdev%2Fbirdhouse-workspace%2Ftmp"
```

For a workspace outside that tree:

```bash
curl -sf "http://127.0.0.1:50112/config?directory=%2FUsers%2Fyour-user%2FDocuments%2FFamily"
```

This helps you detect whether `.opencode/opencode.json` is being discovered by directory crawling.

## Step 8: Inspect model-specific tool definitions

Raw tool ids show what exists in the registry.
Model-specific tool definitions show what the LLM can actually use.

Example:

```bash
curl -sf "http://127.0.0.1:50112/experimental/tool?provider=anthropic&model=claude-sonnet-4-6&directory=%2FUsers%2Fyour-user%2FDocuments%2FFamily"
```

Use a real provider/model pair from:

```bash
curl -sf "http://127.0.0.1:50112/config/providers?directory=%2FUsers%2Fyour-user%2FDocuments%2FFamily"
```

## Common Pitfall

If:

- `/global/health` shows the expected workspace id
- but `/experimental/tool/ids` shows unexpected tools

then you probably forgot the `directory` query parameter.

## Minimal Debug Workflow

1. Get workspace id, directory, port, pid from `data.db`.
2. Confirm the OpenCode process is alive on that port.
3. Confirm `/global/health` reports the expected `birdhouseWorkspaceId`.
4. Query `/experimental/tool/ids?directory=...` with the exact workspace directory.
5. Query `/config?directory=...` with the exact workspace directory.
6. If needed, query `/experimental/tool?provider=...&model=...&directory=...` to inspect model-filtered tools.

## Example Commands

```bash
sqlite3 "$HOME/Library/Application Support/Birdhouse/data.db" \
  "select workspace_id,directory,opencode_port,opencode_pid from workspaces where workspace_id='ws_ea459370dc05d2c3';"

curl -sf http://127.0.0.1:50112/global/health

curl -sf "http://127.0.0.1:50112/experimental/tool/ids?directory=%2FUsers%2Fyour-user%2FDocuments%2FFamily"

curl -sf "http://127.0.0.1:50112/config?directory=%2FUsers%2Fyour-user%2FDocuments%2FFamily"
```
