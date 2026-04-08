---
name: logging
description: Complete guide to Birdhouse logging for agents. Covers where to find logs (dev vs prod, Birdhouse vs OpenCode), how to write logs correctly (subsystems, levels, structured data), and how to tune log verbosity. Load this skill whenever reading, writing, or debugging logs.
tags:
  - birdhouse-development
trigger_phrases:
  - find logs
  - read logs
  - search logs
  - where are the logs
  - birdhouse logs
  - opencode logs
  - log subsystem
  - how to log
  - logging best practices
  - logging
metadata:
  internal: true
---

# Birdhouse Logging

## Where logs live

There are two separate log concerns: **Birdhouse server logs** and **OpenCode process logs**. Where each ends up depends on whether you are running in dev or prod.

| | Birdhouse logs | OpenCode logs |
|---|---|---|
| **Dev** (`OPENCODE_PATH` set) | `~/Library/Logs/Birdhouse/birdhouse-dev-YYYY-MM-DD.log` | `~/Library/Application Support/Birdhouse/workspaces/<id>/engine/logs/opencode.log` |
| **Prod** (installed CLI binary) | `~/Library/Logs/Birdhouse/birdhouse-YYYY-MM-DD.log` | captured inside the Birdhouse log via `subsystem: "opencode"` |

**How to tell which mode you're in:** dev uses `OPENCODE_PATH` and runs OpenCode from source. Prod uses a compiled binary launched by the `birdhouse` CLI.

---

## Reading Birdhouse logs

Logs are newline-delimited JSON. Always pipe through `jq` for readability.

```bash
# Today's dev logs (raw)
tail -f ~/Library/Logs/Birdhouse/birdhouse-dev-$(date +%Y-%m-%d).log

# Today's prod logs (raw)
tail -f ~/Library/Logs/Birdhouse/birdhouse-$(date +%Y-%m-%d).log

# Just messages
tail -f ~/Library/Logs/Birdhouse/birdhouse-dev-$(date +%Y-%m-%d).log | jq -r '.msg'

# Filter to a specific workspace
grep '"workspaceId":"ws_abc123"' ~/Library/Logs/Birdhouse/birdhouse-dev-$(date +%Y-%m-%d).log | jq '.'

# Filter to a specific subsystem
grep '"subsystem":"server"' ~/Library/Logs/Birdhouse/birdhouse-dev-$(date +%Y-%m-%d).log | jq -r '.msg'

# Errors only
grep '"level":"error"' ~/Library/Logs/Birdhouse/birdhouse-dev-$(date +%Y-%m-%d).log | jq '.'

# Strip noisy request-completed lines
tail -50 ~/Library/Logs/Birdhouse/birdhouse-dev-$(date +%Y-%m-%d).log | grep -v '"msg":"Request completed"'
```

Log files rotate daily and are deleted after 7 days.

---

## Reading OpenCode logs

### Dev mode

OpenCode runs detached (survives `bun --watch` restarts). Its logs go to a per-workspace file:

```bash
# Tail OpenCode logs for a specific workspace
tail -f ~/Library/Application\ Support/Birdhouse/workspaces/<workspace_id>/engine/logs/opencode.log
```

The file is appended across restarts, so it accumulates the full history of that OpenCode process.

### Prod mode

OpenCode stdout/stderr is captured by the Birdhouse server and written into the unified Birdhouse log. Filter by subsystem:

```bash
# All OpenCode process output (prod only)
grep '"subsystem":"opencode"' ~/Library/Logs/Birdhouse/birdhouse-$(date +%Y-%m-%d).log | jq '.'

# OpenCode stdout specifically
grep '"source":"stdout"' ~/Library/Logs/Birdhouse/birdhouse-$(date +%Y-%m-%d).log | jq -r '.msg'

# OpenCode stderr (includes debug markers like [OPENCODE-GLOBAL-INIT])
grep '"source":"stderr"' ~/Library/Logs/Birdhouse/birdhouse-$(date +%Y-%m-%d).log | jq -r '.msg'
```

---

## Log subsystems

Every log entry has a `subsystem` field. Use it to filter noise.

| Subsystem | What it covers |
|---|---|
| `server` | Server startup, workspace management, OpenCode lifecycle |
| `api` | HTTP routes, request handling |
| `stream` | OpenCode event stream, SSE connections |
| `opencode` | OpenCode client operations; stdout/stderr from OpenCode processes (prod only) |
| `frontend` | Browser logs relayed via `/api/logs` |

---

## Writing logs in server code

Import and use the pre-configured subsystem loggers from `logger.ts`. Never create your own pino instance.

```typescript
import { log } from "./lib/logger";

// Structured data goes in the first argument, message in the second
log.server.info({ workspaceId, port }, "OpenCode instance spawned");
log.api.warn({ path, status }, "Unexpected response from OpenCode");
log.stream.debug({ sessionId, eventType }, "SSE event received");
```

**Pick the right subsystem:**
- `log.server` — anything in the OpenCode manager, workspace lifecycle, startup
- `log.api` — HTTP route handlers
- `log.stream` — SSE / event streaming code
- `log.opencode` — OpenCode client calls (not process logs — those are automatic)

**Use `deps.log` in feature code**, not the global `log` directly. Feature functions receive deps and should use `deps.log` so they're testable:

```typescript
// In a feature function
deps.log.server.info({ agentId }, "Agent created");
```

---

## Log levels

| Level | When to use |
|---|---|
| `trace` | Very high-frequency events (every SSE event, every poll tick). Off by default. |
| `debug` | Detailed flow information useful when debugging. On in dev, off in prod. |
| `info` | Normal lifecycle events (spawned, started, completed, connected). |
| `warn` | Something unexpected happened but we recovered (process died, retrying). |
| `error` | Something failed that shouldn't have. |
| `fatal` | Unrecoverable — used before `process.exit`. |

Default level: `debug` in dev, `info` in prod.

---

## Tuning log verbosity

```bash
# Silence a noisy subsystem
SUBSYSTEM_LEVELS=api:silent bun run dev

# Crank up a specific subsystem
SUBSYSTEM_LEVELS=stream:trace bun run dev

# Mix and match
SUBSYSTEM_LEVELS=stream:warn,server:debug,api:silent bun run dev

# Global override
LOG_LEVEL=trace bun run dev
```

---

## Log format reference

Every entry is a JSON object:

```json
{
  "level": "info",
  "time": "2026-03-23T14:02:32.443Z",
  "system": "server",
  "subsystem": "server",
  "workspaceId": "ws_abc123",
  "msg": "OpenCode instance spawned and ready"
}
```

Fields:
- `level` — trace | debug | info | warn | error | fatal
- `time` — ISO 8601
- `system` — always `"server"` for server logs, `"frontend"` for browser-relayed logs
- `subsystem` — see table above
- `msg` — the message string
- any additional structured fields passed in the first argument
