---
name: agent-search
description: Search message content across Birdhouse agents to find agents by what they did or said. Use when asked to find an agent, search agents, look up what an agent did, or locate a past conversation.
tags:
  - birdhouse
version: 2.0.0
author: Birdhouse Team
---

# Agent Search

Search OpenCode message history to find agents by what they said, ran, or produced. Uses direct SQLite queries against the OpenCode and Birdhouse databases.

## Database Locations

```
# OpenCode message history (one per workspace)
~/Library/Application Support/Birdhouse/workspaces/<workspace_id>/engine/data/opencode/opencode.db

# Birdhouse agent registry (one per workspace)
~/Library/Application Support/Birdhouse/workspaces/<workspace_id>/agents.db

# Workspace list
~/Library/Application Support/Birdhouse/data.db
```

To list all workspace IDs:

```bash
bun -e "
import { Database } from 'bun:sqlite';
import { homedir } from 'node:os';
import { join } from 'node:path';
const db = new Database(join(homedir(), 'Library/Application Support/Birdhouse/data.db'), { readonly: true });
db.query('SELECT workspace_id, title, directory FROM workspaces').all().forEach(r => console.log(JSON.stringify(r)));
"
```

## Schemas

### opencode.db

**`session`** — one row per OpenCode session (= one Birdhouse agent)
| column | type | notes |
|---|---|---|
| `id` | TEXT PK | e.g. `ses_abc123` |
| `title` | TEXT | session title |
| `project_id` | TEXT | links to OpenCode project |
| `workspace_id` | TEXT | matches Birdhouse workspace_id |
| `time_created` | INTEGER | Unix ms |
| `time_updated` | INTEGER | Unix ms |

**`message`** — one row per message turn
| column | type | notes |
|---|---|---|
| `id` | TEXT PK | e.g. `msg_abc123` |
| `session_id` | TEXT | FK → session.id |
| `time_created` | INTEGER | Unix ms |
| `data` | TEXT | JSON — see below |

`message.data` JSON fields: `role` (`"user"` or `"assistant"`), `modelID`, `providerID`, `tokens`, `cost`, `finish`

**`part`** — one row per content chunk within a message
| column | type | notes |
|---|---|---|
| `id` | TEXT PK | |
| `message_id` | TEXT | FK → message.id |
| `session_id` | TEXT | FK → session.id |
| `time_created` | INTEGER | Unix ms |
| `data` | TEXT | JSON — see below |

`part.data` varies by `type`:
- `text` — `{ type, text }`
- `tool` — `{ type, tool, callID, state: { status, input, output, title } }`
- `reasoning` — `{ type, text }`

### agents.db

**`agents`** — Birdhouse's record of each agent
| column | type | notes |
|---|---|---|
| `id` | TEXT PK | e.g. `agent_abc123` — use for `birdhouse:agent/` links |
| `session_id` | TEXT | FK → opencode.db session.id |
| `title` | TEXT | agent title shown in UI |
| `parent_id` | TEXT | parent agent id |
| `tree_id` | TEXT | root of this agent's tree |
| `model` | TEXT | model used |
| `created_at` | INTEGER | Unix ms |

## Sample Queries

All queries run against `opencode.db` unless noted. Replace `WORKSPACE_ID` with the target workspace.

### Full-text search across all messages

```sql
SELECT DISTINCT
  s.id        AS session_id,
  s.title     AS session_title,
  m.id        AS message_id,
  json_extract(m.data, '$.role') AS role
FROM part p
JOIN message m ON m.id = p.message_id
JOIN session s ON s.id = p.session_id
WHERE
  json_extract(p.data, '$.text') LIKE '%your search term%'
ORDER BY m.time_created DESC
LIMIT 20;
```

### Search only tool calls (by tool name or output)

```sql
SELECT DISTINCT
  s.id        AS session_id,
  s.title     AS session_title,
  json_extract(p.data, '$.tool')                AS tool_name,
  json_extract(p.data, '$.state.input.command') AS command,
  json_extract(p.data, '$.state.output')        AS output
FROM part p
JOIN message m ON m.id = p.message_id
JOIN session s ON s.id = p.session_id
WHERE json_extract(p.data, '$.type') = 'tool'
  AND (
    json_extract(p.data, '$.state.input.command') LIKE '%gh pr create%'
    OR json_extract(p.data, '$.state.output')      LIKE '%gh pr create%'
  )
ORDER BY m.time_created DESC
LIMIT 20;
```

### Search only user messages

```sql
SELECT
  s.id    AS session_id,
  s.title AS session_title,
  p.data  AS part_data
FROM part p
JOIN message m ON m.id = p.message_id
JOIN session s ON s.id = p.session_id
WHERE json_extract(m.data, '$.role') = 'user'
  AND json_extract(p.data, '$.type') = 'text'
  AND json_extract(p.data, '$.text') LIKE '%your search term%'
ORDER BY m.time_created DESC
LIMIT 20;
```

### Search only assistant messages

Same as above but with `'$.role') = 'assistant'`.

### Resolve a session to a Birdhouse agent ID

Run against `agents.db`:

```sql
SELECT id, title FROM agents WHERE session_id = 'ses_abc123';
```

Then link as: `[Agent Title](birdhouse:agent/AGENT_ID)`

## Running Queries

```bash
bun -e "
import { Database } from 'bun:sqlite';
import { homedir } from 'node:os';
import { join } from 'node:path';
const db = new Database(
  join(homedir(), 'Library/Application Support/Birdhouse/workspaces/WORKSPACE_ID/engine/data/opencode/opencode.db'),
  { readonly: true }
);
const rows = db.query(\`YOUR SQL HERE\`).all();
console.log(JSON.stringify(rows, null, 2));
"
```

## Gotchas

- **Session not in agents.db** — Some OpenCode sessions were run outside Birdhouse and have no agent ID. The resolve query returns `null`.
- **Old workspaces may have no `part` table** — Very old DBs predate this schema. Wrap queries in try/catch when iterating all workspaces.
- **Tool input shape varies by tool** — `state.input.command` is specific to the `bash` tool. Other tools use different input fields. Inspect `state.input` directly for other tools.
- **Workspace links** — `birdhouse:agent/` links only resolve when that workspace is active in Birdhouse. Always tell the user which workspace the agent is in.
