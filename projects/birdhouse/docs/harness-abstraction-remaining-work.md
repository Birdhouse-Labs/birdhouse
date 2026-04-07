# Agent Harness Abstraction — Remaining Work

## What We Did

We introduced an "Agent Harness" abstraction layer so Birdhouse can support multiple agent harnesses (OpenCode, Pi, and potentially others). The goal is a clean boundary where Birdhouse-owned types and interfaces isolate us from any specific harness's SDK, wire format, or runtime model.

### Branch: `feat/agent-harness-abstraction`

### What was built

- **`server/src/harness/`** — The abstraction layer:
  - `agent-harness.ts` — Core `AgentHarness` interface with required methods + optional capability groups (revert, skills, generate, questions)
  - `types.ts` — Birdhouse-owned types: `BirdhouseSession`, `BirdhouseMessage`, `BirdhousePart`, etc.
  - `harness-events.ts` — Standardized event types for harness → Birdhouse communication
  - `harness-lifecycle.ts` — Start/stop/health interfaces for harness runtimes
  - `tool-registrar.ts` — Interface for registering Birdhouse tools with different harnesses
  - `opencode-adapter.ts` — OpenCode implementation of `AgentHarness`
  - `opencode-event-adapter.ts` — Maps OpenCode SSE events → standardized `HarnessEvent`
  - `opencode-type-mappers.ts` — Pure mapping functions between OpenCode and Birdhouse types
  - `test-harness.ts` — Stateful in-memory test harness with seeding helpers
  - `index.ts` — Barrel export

- **`server/src/lib/birdhouse-event-bus.ts`** — Workspace-scoped event bus for Birdhouse synthetic events, separate from harness events

- **`harness_type` column** on agents table (defaults to `"opencode"`)

- **All server consumers** (`deps.opencode` → `deps.harness`) wired through the new interface

### Design Principles

- Birdhouse owns its types at the boundary — no `@opencode-ai/sdk` imports outside the adapter
- Optional capabilities use explicit runtime checks: `harness.capabilities.revert?.revertSession(...)`
- Two event sources merge into one SSE stream: harness events + Birdhouse synthetic events
- Frontend SSE contract is unchanged

### Key Files to Read

- `server/src/harness/agent-harness.ts` — The core interface
- `server/src/harness/types.ts` — All Birdhouse-owned data types
- `server/src/harness/opencode-adapter.ts` — How OpenCode implements the interface
- `server/src/dependencies.ts` — How the harness is wired into the DI system
- `server/src/routes/events.ts` — How events from both sources merge into SSE
- `server/src/lib/birdhouse-event-bus.ts` — The Birdhouse synthetic event bus

---

## Remaining Work

### Critical

#### Agent harness resolution is still hard-wired to OpenCode

Files: `server/src/middleware/workspace.ts`, `server/src/middleware/aapi.ts`, `server/src/lib/context-deps.ts`, `server/src/dependencies.ts`, `server/src/types/context.ts`, `server/src/routes/events.ts`, `server/src/routes/workspaces.ts`

Problem: Birdhouse now has an `AgentHarness` interface, but the implementation is not resolved through a small, obvious set of extension points yet. Request-time composition still builds `OpenCodeAgentHarness` directly, and event streaming still assumes the OpenCode-backed harness path. That means adding a second harness would still require tracing through middleware, deps wiring, and stream setup instead of implementing a clearly named harness integration path.

Fix: Introduce one clear harness resolution/composition point at the server boundary. New harness work should be concentrated in a small number of obvious files: harness registration, harness construction, and harness event stream construction. The goal is not to hide every OpenCode-specific infrastructure detail, but to make the places that change for a new harness easy to find and limited in number.

### High

#### Harness events are not typed strongly enough to protect the frontend contract

Files: `server/src/harness/harness-events.ts`, `server/src/harness/opencode-event-adapter.ts`, `server/src/routes/events.ts`

Problem: `HarnessEvent.properties` is still `Record<string, unknown>`. The frontend and SSE route depend on specific event payload shapes, but the abstraction does not encode those shapes. A Pi adapter could emit structurally different payloads and still type-check, causing silent runtime breakage instead of compile-time failures.

Fix: Define a typed, Birdhouse-owned event payload contract for the harness events that are forwarded to the frontend. Make adapters map their native events into those typed payloads, and add tests that lock the SSE payload shapes Birdhouse depends on.

#### Shared server code still imports OpenCode-owned types outside `harness/`

Files: `server/src/lib/skills.ts`, `server/src/lib/agents-db.ts`

Problem: Shared code outside the adapter layer still depends on OpenCode-specific types. `lib/skills.ts` accepts `OpenCodeSkill`, and `lib/agents-db.ts` uses `SessionStatus` from `opencode-client`. These are exactly the kinds of type leaks the abstraction was supposed to remove.

Fix: Change shared code to accept and return Birdhouse-owned types instead. `lib/skills.ts` should consume `BirdhouseSkill`, and `lib/agents-db.ts` should use `BirdhouseSessionStatus` for agent status fields.

#### `harness_type` is persisted but not used to resolve the active harness implementation

Files: `server/src/features/api/create.ts`, `server/src/features/aapi/create.ts`, `server/src/domain/agent-lifecycle.ts`

Problem: Agents now record `harness_type`, but the runtime does not use that value to select the corresponding harness implementation. New agents store `deps.harness.kind`, clones preserve the source harness type, and then the rest of the system ignores the field because there is still only one live harness. This becomes real friction as soon as mixed-harness data exists.

Fix: Once the runtime registry exists, thread `harness_type` into harness resolution for agent operations, cloning, and event streaming so persisted agent metadata and live runtime selection stay aligned.

#### `sendMessage` behavior is not specified clearly enough for multi-harness implementations

Files: `server/src/harness/agent-harness.ts`, `server/src/harness/opencode-adapter.ts`

Problem: The contract does not say what `sendMessage(...)` must return when the underlying harness does not produce an immediate assistant message. The OpenCode adapter currently manufactures a placeholder assistant message when `response.data` is absent. That behavior is OpenCode-specific and is not encoded in the interface, so another harness could reasonably choose a different behavior and break callers.

Fix: Specify the expected `sendMessage` semantics in the interface. Either require a real assistant message, allow `null`/`void` for async sends, or make placeholder responses an explicit Birdhouse-level concept.

### Medium

#### Test coverage still validates too much OpenCode behavior instead of the harness contract

Files: `server/src/dependencies.ts`, `server/src/routes/agents.recent.test.ts`, `server/src/lib/model-validator.test.ts`, `server/src/lib/agent-messaging.test.ts`

Problem: Non-adapter tests still use OpenCode-native fixtures or real OpenCode event adaptation. That does not block plugging in Pi, but it reduces confidence that the abstraction itself is what the tests are protecting.

Fix: Use `createTestHarnessEventStream()` in `createTestDeps`, and convert non-adapter tests to construct Birdhouse-owned messages, providers, and skills directly. Keep OpenCode-native fixtures only in adapter-specific tests.

### Low

#### Lifecycle and tool-registration abstractions are defined but not wired into runtime composition

Files: `server/src/harness/harness-lifecycle.ts`, `server/src/harness/tool-registrar.ts`, `server/src/harness/index.ts`

Problem: The lifecycle and tool-registration interfaces exist as scaffolding, but production code does not use them yet. This is awkward, but it is not a blocker for trying a second harness if the composition layer can instantiate that harness directly.

Fix: Either wire these abstractions into the runtime/composition layer when the second harness lands, or remove them until there is a concrete use. If they stay, they should eventually become the path for harness startup, health, and tool exposure.

#### File search routes are still a direct OpenCode passthrough

Files: `server/src/routes/files.ts`

Problem: File operations are still implemented by constructing an OpenCode client directly outside the harness boundary. This is fine if file APIs remain intentionally OpenCode-specific, but it means the abstraction is not yet the single boundary for all harness-mediated functionality.

Fix: Make an explicit scope decision. Either leave file APIs as OpenCode-only infrastructure and document that clearly, or pull the needed file operations into a harness-owned interface before adding a second harness.

#### Frontend terminology still exposes OpenCode-specific labels in a few places

Files: `frontend/src/types/workspace.ts`, `frontend/src/components/LogViewer.tsx`, `frontend/src/components/LogViewer.test.tsx`

Problem: The main server abstraction is moving toward harness-generic naming, but some frontend surfaces still expose `opencode` as the runtime/source label. This does not block Pi support by itself, but it keeps the product model tied to OpenCode even after the server contract becomes generic.

Fix: Rename user-facing runtime labels to `harness` or another neutral term where appropriate, and keep OpenCode-specific wording only in places that are intentionally OpenCode-only.

### Expected / No Action

#### OpenCode-specific adapter and manager code should stay OpenCode-specific

Files: `server/src/harness/opencode-adapter.ts`, `server/src/harness/opencode-type-mappers.ts`, `server/src/harness/opencode-event-adapter.ts`, `server/src/lib/opencode-manager.ts`

Problem: None. These files are the OpenCode side of the boundary and are expected to use OpenCode-native SDK types and runtime logic.

Fix: No action needed. Keep direct OpenCode dependencies contained here and add parallel Pi-specific files rather than diluting the adapter boundary.

#### Workspace-level OpenCode runtime management is intentionally still OpenCode-specific

Files: `server/src/lib/data-db.ts`, `server/src/lib/startup-warmup.ts`, `server/src/routes/workspaces.ts`, `server/src/middleware/workspace.ts`, `server/src/middleware/aapi.ts`

Problem: None for this phase. Birdhouse still launches and manages an OpenCode runtime per workspace. Health, restart, logs, persisted port/pid fields, and warmup behavior are workspace infrastructure concerns, not evidence that the `AgentHarness` boundary failed.

Fix: No action needed in this phase. Leave OpenCode-specific workspace runtime infrastructure in place unless the product direction changes and workspaces themselves become multi-runtime.

---

## Recommended Composition Shape

The goal of this phase is not to remove every OpenCode-specific detail from workspace infrastructure. The goal is to make adding another **agent harness** require changes in a small, obvious set of files.

### Deps shape

Do **not** put multiple top-level harness dependencies directly on `Deps`.

Prefer a single workspace-scoped resolver/facade such as:

```ts
interface WorkspaceHarnessResolver {
  default(): AgentHarness;
  forKind(kind: string): AgentHarness;
  forAgent(agent: { harness_type: string }): AgentHarness;
  getSessionStatus(): Promise<BirdhouseSessionStatusMap>;
}

interface Deps {
  harnesses: WorkspaceHarnessResolver;
  // ...other deps
}
```

Why this shape:

- A workspace may support more than one harness kind, so `Deps.harness` as a single concrete harness stops fitting once agents can differ by `harness_type`.
- A resolver keeps harness selection logic in one place instead of spreading `if (kind === ...)` checks through feature handlers.
- Aggregate operations such as status lookups can live on the resolver instead of forcing route code to know which harnesses exist.

### How feature code should use it

- Agent-specific operations:
  - load the agent row
  - call `deps.harnesses.forAgent(agent)`
  - use the returned `AgentHarness`
- New-agent creation:
  - determine the desired harness kind for the new agent
  - call `deps.harnesses.forKind(kind)`
  - persist that kind as `harness_type`
- Workspace-wide aggregate operations:
  - use resolver-level methods such as `getSessionStatus()` instead of talking to one harness directly

### Main implementation points for a new harness

If this shape is followed, adding a new harness should mainly mean touching:

1. `server/src/harness/` for the adapter, event adapter, and mappers
2. the harness registry / resolver implementation
3. `server/src/lib/context-deps.ts` only if request-time composition needs to know about the new harness

That is the standard for this abstraction: a new harness should be easy to locate, easy to wire in, and should not require chasing logic across feature handlers.
