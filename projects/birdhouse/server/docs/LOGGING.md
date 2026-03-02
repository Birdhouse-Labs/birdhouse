# Logging

Pino-based structured logging with unified frontend/server/OpenCode logs.

## Philosophy: One Log Stream, Rich Metadata

Birdhouse uses **unified logging** - all components (Birdhouse server, OpenCode processes, frontend) write to a single log file. This follows modern observability practices where correlation is more valuable than separation.

**Why one file?**
- **Timeline correlation**: See the complete sequence of events across all components
- **Workspace tracing**: Follow a single workspace's journey through Birdhouse → OpenCode → storage
- **Simpler debugging**: No context-switching between multiple log files
- **Powerful filtering**: Use structured metadata to slice logs any way you need

**Filtering instead of separation:**
```bash
# Just Birdhouse operations
grep '"subsystem":"server"' birdhouse-*.log

# Just OpenCode output  
grep '"subsystem":"opencode"' birdhouse-*.log

# Just a specific workspace (across ALL components)
grep '"workspaceId":"abc123"' birdhouse-*.log

# Errors from any component
grep '"level":"error"' birdhouse-*.log
```

## Log File Location

```
~/Library/Logs/Birdhouse/birdhouse-YYYY-MM-DD.log
```

- **Always on** - file logging in dev and production
- **Daily rotation** - new file each day
- **7-day retention** - old logs auto-cleaned at startup
- **Unified** - frontend logs relayed to same file via `/api/logs`

```bash
# Tail today's log
tail -f ~/Library/Logs/Birdhouse/birdhouse-$(date +%Y-%m-%d).log

# Search for errors
grep '"level":"error"' ~/Library/Logs/Birdhouse/*.log

# Filter by system
grep '"system":"frontend"' ~/Library/Logs/Birdhouse/*.log

# Filter by subsystem
grep '"subsystem":"opencode"' ~/Library/Logs/Birdhouse/*.log

# Show only OpenCode stderr (debug markers, etc.)
grep '"source":"stderr"' ~/Library/Logs/Birdhouse/*.log | jq -r '.msg'

# Trace a specific workspace across all components
grep '"workspaceId":"workspace-123"' ~/Library/Logs/Birdhouse/*.log

# Hide OpenCode logs (show only Birdhouse)
grep -v '"subsystem":"opencode"' ~/Library/Logs/Birdhouse/birdhouse-$(date +%Y-%m-%d).log
```

## Quick Start

```typescript
import { useDeps } from './dependencies';

const { log } = useDeps();
log.api.info({ userId: 'user-123' }, 'Request received');
log.api.error({ error }, 'Request failed');
```

## Subsystems

| Subsystem | Usage |
|-----------|-------|
| `log.api` | HTTP routes, request handling |
| `log.stream` | SSE streaming, events |
| `log.opencode` | OpenCode client operations (includes stdout/stderr from OpenCode processes) |
| `log.server` | Server startup, configuration |

Frontend uses `system: "frontend"` with subsystems: `ui`, `api`, `theme`, `session`.

### OpenCode Process Logs

OpenCode process output (stdout/stderr) is captured and routed through the `opencode` subsystem with these metadata fields:

- `workspaceId` - Which workspace this OpenCode instance serves
- `opencodePort` - Which port this OpenCode instance runs on
- `source` - Either `"stdout"` or `"stderr"`

This allows correlation between Birdhouse operations and OpenCode behavior in a single timeline.

## Configuration

```bash
# Log level (default: debug in dev, info in prod)
LOG_LEVEL=debug

# Per-subsystem levels
SUBSYSTEM_LEVELS=stream:warn,opencode:debug,api:silent

# Custom log directory
LOG_DIR=/custom/path
```

## Output Format

JSON, one entry per line:

```json
{"level":"info","time":"2024-01-15T09:15:23.000Z","system":"server","subsystem":"api","msg":"Request completed"}
```

## Testing

Test logger captures logs to array (no file I/O):

```typescript
import { clearCapturedLogs, createTestDeps, getCapturedLogs, useDeps, withDeps } from '../src/dependencies';

beforeEach(() => clearCapturedLogs());

test('logs correctly', async () => {
  await withDeps(createTestDeps(), () => {
    useDeps().log.api.info({ userId: '123' }, 'User logged in');
  });

  const logs = getCapturedLogs();
  expect(logs[0]).toMatchObject({ level: 'info', subsystem: 'api', msg: 'User logged in' });
});
```

## Best Practices

### Choosing Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| `trace` | High-volume events (every SSE message, every stream event) | "SSE event sent: message-123" |
| `debug` | Development diagnostics, OpenCode stderr | "Cache hit for session-abc", "[OPENCODE-GLOBAL-INIT]" |
| `info` | Normal operations, important milestones | "OpenCode spawned on port 50102", "Request completed" |
| `warn` | Unexpected but handled situations | "Session not found, creating new", "OpenCode process died" |
| `error` | Failures requiring attention | "Failed to connect to OpenCode", "Request timeout" |
| `fatal` | System-breaking errors | "Database corrupted", "Out of memory" |

### Adding Structured Data

Always include context that helps with filtering and correlation:

```typescript
// ✅ Good - includes correlation keys
log.opencode.info(
  { 
    workspaceId: 'workspace-123',
    sessionId: 'session-abc',
    port: 50102
  },
  'Tool execution started'
);

// ❌ Bad - no way to filter or correlate
log.opencode.info('Tool started');
```

### Common Metadata Fields

Include these fields consistently for best filtering:
- `workspaceId` - Which workspace (enables cross-component tracing)
- `sessionId` - Which agent session
- `agentId` - Which agent in a tree
- `port` / `opencodePort` - Which OpenCode instance
- `requestId` - Which HTTP request (for API logs)

### Controlling Noise in Development

OpenCode generates significant output. Use subsystem levels to tune:

```bash
# Quiet OpenCode, focus on Birdhouse
SUBSYSTEM_LEVELS=opencode:warn bun run dev

# See OpenCode errors but not debug output
SUBSYSTEM_LEVELS=opencode:error bun run dev

# Silence OpenCode completely
SUBSYSTEM_LEVELS=opencode:silent bun run dev

# Debug OpenCode issues specifically
SUBSYSTEM_LEVELS=opencode:debug bun run dev
```

## Files

- `src/lib/logger.ts` - Logger implementation
- `src/lib/opencode-manager.ts` - OpenCode stdout/stderr capture (lines 221-247)
- `src/routes/logs.ts` - Frontend log relay endpoint
- `src/dependencies.ts` - DI integration
