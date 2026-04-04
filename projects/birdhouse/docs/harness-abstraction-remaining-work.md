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

<!-- The sections below were populated by an audit of the full codebase -->

#### Frontend workspace log source labels still expose OpenCode runtime concepts

- **Files:**
  - `frontend/src/types/workspace.ts:88`
  - `frontend/src/components/LogViewer.tsx:22`
  - `frontend/src/components/LogViewer.test.tsx:36-82`
- **Problem:** Workspace details, health, config, and composer surfaces now use harness-generic names, but recent log filtering still exposes an `"opencode"` source label in the frontend.
- **Fix:** Decide whether recent logs should use a generic `"harness"` source label or keep `"opencode"` while only the OpenCode runtime exists.
- **Priority:** `Future / Frontend`

### Informational / expected items

#### `opencode-manager.ts` is correctly scoped as an OpenCode-only runtime concern

- **Files:** `server/src/lib/opencode-manager.ts:1-320`, `server/src/lib/opencode-manager.ts:665-712`
- **Problem:** None. This file is intentionally responsible for OpenCode process lifecycle, health checks, session probing, and spawn environment construction.
- **Fix:** No action needed. Keep it as the runtime manager for the OpenCode-backed harness until there is a parallel manager for another harness.
- **Priority:** `no action needed`

#### `routes/files.ts` is still an intentional OpenCode passthrough

- **Files:** `server/src/routes/files.ts:1-69`
- **Problem:** None for this branch. The file-search route still forwards directly to OpenCode file APIs by design.
- **Fix:** No action needed unless file operations become part of a future generalized harness contract.
- **Priority:** `no action needed`

#### Harness adapter tests are expected to construct OpenCode client/stream fixtures directly

- **Files:**
  - `server/src/harness/opencode-adapter.test.ts:7-13`, `server/src/harness/opencode-adapter.test.ts:66-226`
  - `server/src/harness/opencode-event-adapter.test.ts:5-6`, `server/src/harness/opencode-event-adapter.test.ts:37-84`
- **Problem:** None. These tests are validating the OpenCode adapter boundary itself, so direct OpenCode fixtures are appropriate there.
- **Fix:** No action needed. Keep these tests close to the adapter implementation and continue using OpenCode-native types here.
- **Priority:** `no action needed`

#### Dependency wiring files intentionally assemble the OpenCode-backed harness

- **Files:**
  - `server/src/dependencies.ts:20`, `server/src/dependencies.ts:277-292`
  - `server/src/lib/context-deps.ts:6`, `server/src/lib/context-deps.ts:41-51`
- **Problem:** None. These files are the composition layer that turns OpenCode runtime pieces into the harness abstraction.
- **Fix:** No action needed. The important boundary is that downstream feature code consumes `Deps.harness`, not that the wiring layer avoids OpenCode references.
- **Priority:** `no action needed`
