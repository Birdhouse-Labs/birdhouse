---
name: agent-search
description: Search message content across Birdhouse agents to find agents by what they did or said. Use when asked to find an agent, search agents, look up what an agent did, or locate a past conversation.
tags:
  - birdhouse
version: 1.0.0
author: Birdhouse Team
---

# Agent Search

Search across OpenCode message content to find agents by what they said, ran, or produced — then resolve results back to clickable Birdhouse agent links.

## Preconditions

- The search script is bundled with this skill at [scripts/search-messages.ts](scripts/search-messages.ts)
- Each Birdhouse workspace stores its OpenCode DB at:
  `~/Library/Application Support/Birdhouse/workspaces/<workspace_id>/engine/data/opencode/opencode.db`
- Agent IDs live in `agents.db`, NOT in `opencode.db`

## Quick Start

```bash
# Search a single workspace
bun scripts/search-messages.ts ws_abc123 "search term" --limit 10

# Search ALL workspaces
bun scripts/search-messages.ts all "search term" --limit 10
```

The script searches:
- **Text parts** — assistant and user message text
- **Tool outputs** — `state.output` (e.g. bash results, file reads, git output)
- **Tool inputs** — `state.input.command` (e.g. the actual command an agent ran)

Each match shows the matched message and the preceding user message for context.

## Resolving a Session to an Agent ID

OpenCode sessions are separate from Birdhouse agents. After finding a match, resolve it:

```bash
bun -e "
import { Database } from 'bun:sqlite';
import { homedir } from 'node:os';
import { join } from 'node:path';
const dbPath = join(homedir(), 'Library/Application Support/Birdhouse/workspaces/WORKSPACE_ID/agents.db');
const db = new Database(dbPath, { readonly: true });
const agent = db.query(\"SELECT id, title FROM agents WHERE session_id = 'SESSION_ID'\").get();
console.log(JSON.stringify(agent));
"
```

Then link to the agent as: `[Agent Title](birdhouse:agent/AGENT_ID)`

## Finding the Right Workspace

If you don't know which workspace to search, use `all`. To identify which workspace a result belongs to:

```bash
bun -e "
import { Database } from 'bun:sqlite';
import { homedir } from 'node:os';
import { join } from 'node:path';
const dbPath = join(homedir(), 'Library/Application Support/Birdhouse/data.db');
const db = new Database(dbPath, { readonly: true });
const ws = db.query(\"SELECT workspace_id, title, directory FROM workspaces WHERE workspace_id = 'WORKSPACE_ID'\").get();
console.log(JSON.stringify(ws));
"
```

## Gotchas

- **Session not in agents.db** — Some OpenCode sessions were run directly (not via Birdhouse) and have no agent ID. If the query returns `null`, the session has no corresponding Birdhouse agent.
- **Old workspaces may have no `part` table** — Very old OpenCode DBs predate this schema. You'll see a `SQLiteError: no such table: part`; the script skips that workspace and continues.
- **Tool inputs vs outputs** — Searching for a command an agent *ran* (e.g. `gh pr create`) requires matching tool inputs. The script covers this via `state.input.command`. Tool results/outputs are separate from inputs.
- **Workspace links** — Agent links only work when that workspace is active in Birdhouse. Always tell the user which workspace the agent is in.

## Example: Finding an Agent by What It Ran

```bash
bun scripts/search-messages.ts all "gh pr create" --limit 5
```

Look for the match that shows `$ gh pr create ...` under a tool call — that's the agent that *ran* the command, not just one that mentioned it in text. The context message above it shows the user instruction that triggered the PR creation.
