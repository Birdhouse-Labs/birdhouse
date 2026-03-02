# Frontend Logging

Browser logger that relays all logs to the server for a unified log stream.

## Quick Start

```typescript
import { log } from './lib/logger';

// Use pre-configured subsystem loggers
log.ui.info('Button clicked', { buttonId: 'submit' });
log.api.error('Request failed', { status: 500, endpoint: '/api/sessions' });
```

## How It Works

1. **Console**: All logs write to browser console immediately
2. **Server Relay**: All logs POST to `/api/logs` (fire-and-forget)
3. **Unified Stream**: Server writes frontend logs to same log files as server logs

This means agents can read ONE log file to see the full picture:
```
10:32:14 INFO  [frontend:ui]     User clicked Submit
10:32:14 DEBUG [frontend:api]    POST /api/sessions
10:32:14 INFO  [server:routes]   Received request
10:32:14 ERROR [server:opencode] Connection timeout
10:32:14 ERROR [frontend:api]    Request failed
```

## Subsystems

| Logger | Usage |
|--------|-------|
| `log.ui` | UI interactions, component lifecycle |
| `log.api` | API calls, fetch requests |
| `log.theme` | Theme changes, dark mode |
| `log.session` | Session management |

## Log Levels

```typescript
log.ui.debug('Verbose debugging info');
log.ui.info('Normal operation');
log.ui.warn('Something unexpected');
log.ui.error('Something failed');
```

## Adding Data

```typescript
// Message only
log.ui.info('Component mounted');

// With structured data
log.api.info('Request sent', { 
  method: 'POST',
  endpoint: '/api/sessions',
  body: { title: 'New Session' }
});
```

## Error Handling

Pass Error objects as the third argument to `warn()` or `error()`. The error is automatically serialized with name, message, and stack trace:

```typescript
try {
  await fetchData();
} catch (err) {
  // Error object is serialized with full stack trace
  log.api.error('Request failed', { endpoint: '/api/data' }, err);
}
```

Output in log file:
```json
{
  "level": "error",
  "system": "frontend",
  "subsystem": "api",
  "msg": "Request failed",
  "data": { "endpoint": "/api/data" },
  "error": {
    "name": "TypeError",
    "message": "Failed to fetch",
    "stack": "TypeError: Failed to fetch\n    at fetchData (app.ts:42)..."
  }
}
```

## Custom Subsystems

```typescript
import { createLogger } from './lib/logger';

const myLogger = createLogger('myfeature');
myLogger.info('Feature initialized');
```

## Configuration

Set `VITE_SERVER_URL` to change the server endpoint:
```bash
VITE_SERVER_URL=http://localhost:3000 bun run dev
```

Default: `http://localhost:50121`

## Server Down?

If the server is unavailable, logs still appear in the browser console. The server relay silently fails without blocking or throwing errors.
