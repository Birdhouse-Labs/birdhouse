# Testing Patterns

Bun test runner. Mocked dependencies. Fast, reliable tests.

## Checklist for Test Authors & Reviewers

When writing or reviewing tests, check:

- [ ] **Stream singleton**: Does handler emit SSE events? Use `getWorkspaceStream()` or `getOpenCodeStream()`, not `new OpenCodeStream()` (enforced by linter)
- [ ] **Workspace context**: Does handler use `c.get("workspace")` or `c.get("opencodeBase")`? Use `createTestApp()` or `withWorkspaceContext()`. Tests will fail with clear 500 error if missing.
- [ ] **Strong assertions**: Use specific values (`toBe("agent_123")`) not weak checks (`toBeDefined()`)
- [ ] **Test data**: Use factories (`createRootAgent()`) to reduce boilerplate
- [ ] **Cleanup**: Call `cleanup()` on SSE event spies after test completes

## Quick Start

```typescript
import { test, expect } from 'bun:test';
import { withDeps } from '../src/dependencies';

test('my feature', async () => {
  await withDeps(undefined, async () => {
    // Auto test deps - getSession returns mocks
    const result = await myFunction();
    expect(result).toBeDefined();
  });
});
```

## Testing Routes

```typescript
import { createSessionRoutes } from '../src/routes/sessions';

const app = createSessionRoutes();
const res = await app.request('/ses_123');

expect(res.status).toBe(200);
const data = await res.json();
expect(data.id).toBe('ses_123');
```

**See:** `tests/routes/sessions.test.ts` - 5 complete examples

## Test Data Factories

Reduce boilerplate when creating test agents.

```typescript
// Before (15 lines of boilerplate per agent)
const root = agentsDB.insertAgent({
  session_id: "ses_test",
  parent_id: null,
  tree_id: "agent_123",
  level: 0,
  title: "Root Agent",
  project_id: "test-project",
  directory: "/test",
  model: "anthropic/claude-sonnet-4",
  cloned_from: null,
  cloned_at: null,
  archived_at: null,
  created_at: Date.now(),
  updated_at: Date.now(),
  id: "agent_123",
});

// After (1 line with overrides)
const root = createRootAgent(agentsDB, { title: "Root Agent" });

// Create tree with children
const { root, children } = createAgentTree(agentsDB, {
  rootTitle: "Feature Development",
  childTitles: ["Research API", "Implement endpoints"]
});

// Child inherits parent context
const child = createChildAgent(agentsDB, root.id, { 
  title: "Research task" 
});
```

**See:** `src/test-utils/agent-factories.ts`, `src/routes/agents.test.ts`

## Workspace Context for Routes

Route tests need workspace context middleware.

```typescript
import { withWorkspaceContext } from '../test-utils';

const agentsDB = createAgentsDB(':memory:');

const deps = createTestDeps();
deps.agentsDB = agentsDB;

await withDeps(deps, async () => {
  const app = withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
  const res = await app.request('/');
  
  expect(res.status).toBe(200);
});
```

**See:** `src/test-utils/workspace-context.ts`, `src/routes/agents.test.ts`

## Dependency Patterns

Three ways to use deps - pick based on test needs.

```typescript
// Pattern 1: Auto test deps (simple tests)
await withDeps(undefined, async () => {
  // All deps return sensible mocks
  const result = await myFunction();
  expect(result).toBeDefined();
});

// Pattern 2: Custom implementation (verify calls)
const deps = createTestDeps({
  getSession: async (id) => {
    expect(id).toBe('expected_id');
    return mockSession;
  }
});

await withDeps(deps, async () => {
  await myFunction();
});

// Pattern 3: Shared deps with custom DB
const agentsDB = createAgentsDB(':memory:');
const deps = createTestDeps();
deps.agentsDB = agentsDB;

await withDeps(deps, async () => {
  // Multiple tests can share this agentsDB
});
```

**See:** `src/dependencies.test.ts`

## Strong Assertions

Be specific. Weak assertions hide problems.

```typescript
// ❌ Weak - what's actually in result?
expect(result).toBeDefined();
expect(result.id).toBeTruthy();

// ✅ Specific - failures show exact mismatch
expect(result.id).toBe('agent_123');
expect(result.level).toBe(1);
expect(result.tree_id).toBe(parentAgent.tree_id);

// ❌ Weak - passes even if structure changes
expect(agent.children.length > 0).toBe(true);

// ✅ Specific - documents expected state
expect(agent.children).toHaveLength(2);
expect(agent.children[0].title).toBe("Child 1");
```

## Testing SSE Streams

```typescript
const stream = getOpenCodeStream();  // Test instance

// Emit events programmatically
stream.emit('session.created', { info: { id: 'ses_1', title: 'Test' } });

// Control timing
await new Promise(r => setTimeout(r, 10));
stream.emit('session.created', { info: { id: 'ses_2', title: 'Test' } });
```

**See:** `tests/routes/events.test.ts` - SSE testing patterns

## Override Specific Deps

```typescript
const deps = createTestDeps({
  opencode: {
    getSession: async (id) => {
      expect(id).toBe('expected_id');
      return { id, title: 'Custom Mock', ... };
    }
  }
});

await withDeps(deps, async () => {
  // Uses custom mock
});
```

**See:** `tests/routes/sessions.test.ts:40-60`

## Verify Deps Called Correctly

```typescript
const calledWith: string[] = [];

const deps = createTestDeps({
  opencode: {
    getSession: async (id) => {
      calledWith.push(id);  // Track calls
      return mockSession;
    }
  }
});

await withDeps(deps, async () => {
  await myFunction('ses_1');
  await myFunction('ses_2');
});

expect(calledWith).toEqual(['ses_1', 'ses_2']);
```

**See:** `tests/routes/sessions.test.ts:90-110`

## Common Pitfall: Stream Instance Mismatch

**Problem**: Handlers that create `new OpenCodeStream()` instead of using the singleton prevent test spies from capturing SSE events.

```typescript
// ❌ Wrong - creates new instance, test spies won't see events
const stream = new OpenCodeStream(opencodeBase, workspaceDir);
stream.emitCustomEvent("birdhouse.agent.created", { agentId });

// ✅ Correct - uses singleton, test spies work
const stream = getWorkspaceStream(opencodeBase, workspaceDir);
stream.emitCustomEvent("birdhouse.agent.created", { agentId });
```

**Why it matters**: 
- `captureStreamEvents()` spy watches the singleton
- If handlers emit on a different instance, tests see 0 events (even though events were emitted)
- This is a **silent failure** - tests pass but assertions fail

**How it's prevented**:
- Custom linter (`bun run lint:custom`) checks for `new OpenCodeStream()` in handlers
- Runs automatically as part of `bun run lint`
- Add `// lint-ignore` comment if you legitimately need a new instance (e.g., factory functions)

**About workspace context**:
Handlers that need workspace context (`c.get("workspace")`, `c.get("opencodeBase")`) should use `createTestApp()` or `withWorkspaceContext()` in tests. If you forget, tests fail immediately with a clear 500 error - no linter needed.

## Commands

```bash
bun test                    # All tests
bun test --watch            # Watch mode
bun test session            # Pattern match
bun test --ignore-pattern="*.integration.test.ts"  # Skip integration
```

## File Naming

- `*.test.ts` - Unit tests (fast, mocked)
- `*.integration.test.ts` - Integration tests (real API, slower)

Integration tests validate implementation, then rely on unit tests for regression.

## Examples

Every pattern demonstrated in:
- `src/test-utils/agent-factories.ts` - Test data factories
- `src/test-utils/workspace-context.ts` - Workspace middleware
- `src/dependencies.test.ts` - DI system
- `tests/helpers-integration.test.ts` - Helpers (onWithDeps, setTimeout)
- `src/routes/agents.test.ts` - Route testing with factories
- `tests/routes/sessions.test.ts` - Route testing
- `tests/routes/events.test.ts` - SSE testing

Read the tests!
