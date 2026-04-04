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

### Frontend OpenCode type dependencies (Future / Frontend)

#### Core frontend message model still exposes OpenCode message info

- **Files:**
  - `frontend/src/types/messages.ts:4`
  - `frontend/src/types/messages.ts:156-157`
  - `frontend/src/contexts/StreamingContext.tsx:4`
  - `frontend/src/components/ui/MessageBubble.tsx:4`
- **Problem:** Core UI message state still carries `opencodeMessage` and imports SDK message types directly, so the frontend is still coupled to OpenCode-native message metadata.
- **Fix:** Introduce a Birdhouse-owned frontend message metadata shape and migrate consumers away from `opencodeMessage`. The UI should depend on server/frontend-owned contracts rather than the OpenCode SDK client types.
- **Priority:** `Future / Frontend`

#### Frontend adapters and streaming domain logic still model OpenCode parts directly

- **Files:**
  - `frontend/src/adapters/message-adapter.ts:4-5`
  - `frontend/src/adapters/part-adapters/text-adapter.ts:4`
  - `frontend/src/adapters/part-adapters/tool-adapter.ts:4`
  - `frontend/src/adapters/part-adapters/file-adapter.ts:4`
  - `frontend/src/adapters/part-adapters/reasoning-adapter.ts:4`
  - `frontend/src/domain/message-updates.ts:9-18`
  - `frontend/src/domain/message-updates.ts:41-58`
  - `frontend/src/domain/message-updates.ts:156-157`
  - `frontend/src/domain/message-queue.ts:19-28`
  - `frontend/src/domain/message-queue.ts:48`
- **Problem:** The adapter layer and streaming update logic still treat OpenCode part shapes and OpenCode message ID semantics as the native frontend model.
- **Fix:** Define Birdhouse-owned frontend part/update types and make the adapters convert from server event payloads into those types. Message queue logic should rely on Birdhouse message semantics, not OpenCode ID ordering assumptions.
- **Priority:** `Future / Frontend`

#### Frontend workspace and config types still expose OpenCode runtime/config concepts

- **Files:**
  - `frontend/src/types/workspace.ts:13-15`
  - `frontend/src/types/workspace.ts:55-60`
  - `frontend/src/types/workspace.ts:88`
  - `frontend/src/workspace-config/types/config-types.ts:31-36`
  - `frontend/src/workspace-config/types/api-types.ts:31-36`
  - `frontend/src/services/workspaces-api.ts:288-323`
  - `frontend/src/utils/composerAttachments.ts:2`
  - `frontend/src/types/composer-attachments.ts:2`
- **Problem:** The frontend still exposes `opencode_running`, `opencode_base`, log source `"opencode"`, and OpenCode-specific config terminology in user-facing types and comments.
- **Fix:** If Birdhouse is going to support multiple harness runtimes, these should be generalized to runtime- or harness-oriented names. If OpenCode remains the only workspace runtime, keep the backend fields but isolate the naming to workspace runtime/admin surfaces.
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
