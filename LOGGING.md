# Logging

**Complete documentation:** See [`server/docs/LOGGING.md`](server/docs/LOGGING.md) for detailed logging patterns, best practices, and filtering techniques.

## Log File Location

**All server logs are written to:** `~/Library/Logs/Birdhouse/`

**File format:** `birdhouse-YYYY-MM-DD.log` (daily rotation)

**Example:** `~/Library/Logs/Birdhouse/birdhouse-2026-01-03.log`

**Note:** This file contains logs from ALL components (Birdhouse server, OpenCode processes, frontend) in a unified timeline. Use structured metadata to filter.

### Quick Access

```bash
# View today's logs (raw JSON)
tail -f ~/Library/Logs/Birdhouse/birdhouse-$(date +%Y-%m-%d).log

# View last 100 lines
tail -100 ~/Library/Logs/Birdhouse/birdhouse-$(date +%Y-%m-%d).log

# Pretty format with jq (just messages)
tail -f ~/Library/Logs/Birdhouse/birdhouse-$(date +%Y-%m-%d).log | jq -r '.msg'

# Pretty format with jq (full details)
tail -f ~/Library/Logs/Birdhouse/birdhouse-$(date +%Y-%m-%d).log | jq '.'

# Search for specific subsystem
grep '"subsystem":"stream"' ~/Library/Logs/Birdhouse/birdhouse-$(date +%Y-%m-%d).log | jq -r '.msg'

# Filter by log level
grep '"level":"error"' ~/Library/Logs/Birdhouse/birdhouse-$(date +%Y-%m-%d).log | jq -r '.msg'

# Recent logs without request noise
tail -50 ~/Library/Logs/Birdhouse/birdhouse-$(date +%Y-%m-%d).log | grep -v '"msg":"Request completed"'
```

### Log Subsystems

- `api` - HTTP routes, request handling
- `stream` - OpenCode event stream, SSE connections
- `opencode` - OpenCode client operations, stdout/stderr from OpenCode processes
- `server` - Server startup, configuration
- `frontend` - Browser logs relayed via `/api/logs`

**Filtering by source:**
- OpenCode stdout: `grep '"source":"stdout"'`
- OpenCode stderr: `grep '"source":"stderr"'` (includes debug markers like `[OPENCODE-GLOBAL-INIT]`)
- Specific workspace: `grep '"workspaceId":"workspace-123"'`

### Configuration

**Default level:** `debug` (dev), `info` (production)

**Enable verbose streaming logs (trace level):**
```bash
# Enable trace for stream subsystem only
SUBSYSTEM_LEVELS=stream:trace bun run dev

# Or enable trace globally
LOG_LEVEL=trace bun run dev
```

**Per-subsystem levels:**
```bash
# Mix and match levels
SUBSYSTEM_LEVELS=stream:warn,opencode:debug,api:info bun run dev
```

**Quiet noisy subsystems:**
```bash
# Silence a subsystem completely
SUBSYSTEM_LEVELS=api:silent bun run dev
```

**Retention:** Logs older than 7 days are auto-deleted on startup

**Note:** Streaming event logs are at `trace` level (opt-in) to reduce noise. Connection/error logs are at `info`/`error` (always visible).

### Log Format

JSON structured logs with fields:
- `level` - trace|debug|info|warn|error|fatal
- `time` - ISO 8601 timestamp
- `system` - "server" or "frontend"
- `subsystem` - Specific logger name
- `msg` - Log message
- `data` - Additional structured data (optional)

**Location in code:** `server/src/lib/logger.ts:76-108`
