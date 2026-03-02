# Dependency Injection

AsyncLocalStorage-based DI for testability. Auto test/live switching.

## Core API

```typescript
useDeps()                          // Get dependencies (throws if unavailable)
withDeps(deps, fn)                 // Run function with deps context
onWithDeps(emitter, event, handler) // EventEmitter with preserved deps
setTimeoutWithDeps(fn, delay)      // setTimeout with preserved deps
```

## Pattern: Destructure at Top

```typescript
async function myHandler() {
  // ALWAYS destructure at top of function
  const { 
    opencode: { getSession, createSession },
    log: { api }
  } = useDeps();
  
  // Use below
  const session = await getSession('ses_123');
  api.info({ sessionId: session.id }, 'Session loaded');
}
```

**Examples:** `src/routes/sessions.ts:13`, `src/routes/events.ts:20`

## Auto Test/Live Switching

Tests use mocks automatically. Production uses real implementations.

```typescript
// Test - auto uses mocks
await withDeps(undefined, async () => {
  // Has test deps
});

// Override specific dep
const deps = createTestDeps({
  opencode: {
    getSession: async () => ({ id: 'custom', ... })
  }
});

await withDeps(deps, async () => {
  // Uses custom mock
});
```

**Examples:** `tests/routes/sessions.test.ts:40-60`, `tests/routes/events.test.ts:70-95`

## Event Handlers Need onWithDeps()

Event handlers run outside HTTP request context. Use helper to preserve deps:

```typescript
const stream = getOpenCodeStream();

const cleanup = onWithDeps(stream, 'session.created', async (event) => {
  const { opencode: { getSession } } = useDeps();  // ✅ Works!
  await getSession(event.id);
});

// Later: cleanup() to unsubscribe
```

**Example:** `src/routes/events.ts:17-42`

## Available Dependencies

See `src/dependencies.ts` for Deps interface:

```typescript
interface Deps {
  opencode: {
    getSession(id): Promise<Session>
    createSession(title?): Promise<Session>
    sendMessage(id, text, opts?): Promise<Message>
    getMessages(id, limit?): Promise<Message[]>
  }
  log: {
    api: SubsystemLogger
    stream: SubsystemLogger
    opencode: SubsystemLogger
    server: SubsystemLogger
  }
}
```

**Extend:** Add to Deps interface, update live/test implementations.

**Logging:** See [LOGGING.md](./LOGGING.md) for logging patterns and test assertions.

## Implementation Files

- Core: `src/dependencies.ts`
- Helpers: Search for `withCurrentDeps`, `onWithDeps`, `setTimeoutWithDeps`
- Live impl: Search for `liveDeps`
- Test impl: Search for `createTestOpenCodeClient` in `src/lib/opencode-client.ts`

## Tests

- Unit tests: `tests/dependencies.test.ts`
- Integration: `tests/helpers-integration.test.ts`
- Route examples: `tests/routes/*.test.ts`

Read the tests - they show every pattern!
