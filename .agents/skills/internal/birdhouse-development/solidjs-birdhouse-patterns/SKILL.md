---
name: solidjs-birdhouse-patterns
description: Birdhouse-specific SolidJS conventions and pitfalls. Load this skill when modifying SolidJS code in birdhouse-workspace, especially frontend reactivity, module-level computations, createResource usage, cleanup behavior, or when matching established Birdhouse patterns.
tags:
  - solidjs
  - birdhouse
  - frontend
version: 1.0.0
author: OpenCode
metadata:
  internal: true
---

# SolidJS Birdhouse Patterns

Use this skill for SolidJS work inside Birdhouse. Apply Birdhouse-specific conventions and example patterns from the current codebase instead of re-deriving them from scratch.

## Quick Start

1. Load `solidjs-best-practices` first if it is available, then apply this skill's Birdhouse-specific deltas.
2. Load `references/module-level-and-cleanup.md` for module-level ownership and teardown rules.
3. Load `references/resources-and-derived-state.md` for `createResource`, `createMemo`, and signal usage patterns in this repo.
4. Load `references/reactivity-pitfalls.md` when rendering recursive component trees, registering document-level listeners from effects, or placing slot children relative to context Providers.
5. Match a nearby code example before introducing a new reactive pattern.

## Navigation

- **[references/module-level-and-cleanup.md](./references/module-level-and-cleanup.md)** — Module-level `createRoot`, disposal, and cleanup examples from Birdhouse
- **[references/resources-and-derived-state.md](./references/resources-and-derived-state.md)** — `createResource` error guards, storage usage, memos, and prop/signal choices
- **[references/reactivity-pitfalls.md](./references/reactivity-pitfalls.md)** — Recursive component boundaries, stale document listeners, slot placement inside Providers

## Key Reminders

- Wrap module-level signals, memos, and effects in one `createRoot` and export a disposer.
- Use `onCleanup` for listeners, timers, and other resources.
- Check `resource.error` before calling `resource()` in effects and memos.
- Use the `storage` option on `createResource` when preserving previous data avoids loading flash.
- Prefer `createMemo` for derived values used repeatedly in render.
- Use a recursive **component** (not a recursive function returning JSX) when rendering hierarchies from reactive state.
- Re-check reactive guards **inside** document-level event handlers — not only at effect registration time.
- Render `{props.children}` inside any context Providers the component sets up, unless the outer scope is intentional.

## Red Flags — Stop

- Creating module-level computations without `createRoot`
- Reading `resource()` in an effect or memo before guarding `resource.error`
- Creating effects in loops or conditionals when one tracked owner should contain the logic
- Mutating signal-held objects directly instead of writing a new value or using a store
- Introducing a new pattern when a close Birdhouse example already exists
- Using a plain recursive function that returns JSX inside a reactive render scope — ancestors rebuild on every change. See `references/reactivity-pitfalls.md`.
- Registering a document listener in an effect gated by a reactive guard without re-checking the same guard inside the handler body. See `references/reactivity-pitfalls.md`.
- Rendering `{props.children}` outside a context Provider the component sets up (z-index, theme, focus). See `references/reactivity-pitfalls.md`.
