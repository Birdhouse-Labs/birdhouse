# Birdhouse Workspace Structure

This document explains the project structure for AI agents working in this workspace.

## Overview

This directory is a **workspace root** that contains multiple independent projects in the `projects/` folder. Each project has its own dependencies and build configuration.

## Project Structure

```
birdhouse/
├── AGENTS.md                    # This file - workspace structure guide
└── projects/                    # Independent projects
    ├── birdhouse/               # Main Birdhouse platform
    │   ├── frontend/            # SolidJS web application
    │   ├── server/              # Bun orchestration server
    │   └── README.md            # Main platform documentation
    │
    ├── birdhouse-oc-plugin/     # OpenCode plugin
    │   └── README.md            # Plugin documentation
    │
    └── marketing/               # Marketing site
```

## Git Repository Structure

**Important:** Currently all projects are in a single monorepo.

# Code Organization Philosophy

**We love making small files around here.**

Keep files focused on a single responsibility. Better to have many small, clear files than few large, complex ones.

## Engineering Principles

- GOLDEN RULE: Code is written to be easy to read, understand, and above all, change.
  - Most other rules stem directly from this principle.
- Simple made Easy (Rich Hickey)
  - Rich Hickey distinguishes "simple" from "easy" by defining simple as the opposite of complex—meaning a system is clear, unentangled, and objective—while easy is the opposite of hard, and is subjective, convenient, and at hand. An easy solution today might introduce future complexity that makes it hard to understand, debug, or change later, whereas simple solutions, though potentially harder initially, lead to long-term robustness and reliability.
- DRY can be evil
  - The right application of DRY is for things that change for the same reason. This is when abstraction helps.
  - The wrong abstraction is worse than no abstraction. Removing repetition when things change for different reasons does not serve us.
- Testing
  - Tests should serve this principle: make code easier to change confidently.
  - Compromises exist. We can’t test everything.
  - Prioritizing speed pays dividends.
- When it’s good to crash
  - Handling edge cases that are world breaking. A crash can trigger our monitoring systems, and we can become aware of it and fix it. Silently bypassing unexpected conditions means we might never be aware.
  - If we expect a value to exist at a point in the code, make it required and log if it’s missing. If it’s world breaking, crash. This principle can be applied broadly.

## Main Projects

### Birdhouse Platform (`projects/birdhouse/`)

Multi-agent orchestration platform built on OpenCode. Read [`projects/birdhouse/README.md`](projects/birdhouse/README.md) for architecture details.

**Key components:**
- **Frontend:** SolidJS UI for visualizing agent trees and message streams
- **Server:** Bun server that orchestrates agents and manages persistence
- **Both share:** A monorepo with workspace dependencies

**Working directory for most tasks:** 
- Frontend: `projects/birdhouse/frontend`
- Server: `projects/birdhouse/server`

### Birdhouse OpenCode Plugin (`projects/birdhouse-oc-plugin/`)

OpenCode plugin that exposes agent management tools (`agent_create`, `agent_read`, `agent_reply`, `agent_tree`). Read [`projects/birdhouse-oc-plugin/README.md`](projects/birdhouse-oc-plugin/README.md) for API details.

**Working directory:** `projects/birdhouse-oc-plugin`

### Marketing Site (`projects/marketing/`)

The Birdhouse marketing and documentation website.

**Working directory:** `projects/marketing`

## Testing

Frontend and server each have their own CI checks.
You can run all checks from the root of the monorepo with `bun run check:all`
Often as an agent it's better to run the checks independently though. Below is a list of all CI checks that are run as part of `check:all`:

```bash
# frontend
bun run generate:themes
bun run validate:themes
bun run typecheck
bun run lint
bun run lint:css
bun run test
bun run build

# server
bun run lint
bun run typecheck
bun test
bun run build

# plugin
bun run typecheck
bun test
bun run build
```

# Architecture: Deps System

## All External Boundaries Go Through Deps

**Rule:** All external APIs, databases, and services MUST use the deps system. Never use direct `fetch()` calls when deps provides the method.

### Why Deps?

1. **Testability** - Mock any external call via `createTestDeps()`
2. **Consistency** - One pattern for all external boundaries
3. **Type Safety** - Deps interface enforces contracts

### Testing Pattern

```typescript
// ✅ CORRECT: Mock via createTestDeps
const deps = createTestDeps({
  getProviders: async () => ({ providers: [...] }),
  sendMessage: async () => mockMessage,
});

// ❌ WRONG: Direct fetch or custom injection
const result = await fetch('http://opencode/...');  // Don't do this!
const validator = (fetchFn) => ...;  // Don't create custom injection patterns!
```

### What's in Deps?

- `deps.opencode` - All OpenCode API calls (sessions, messages, models, etc.)
- `deps.agentsDB` - SQLite database operations
- `deps.log` - Structured logging

**See:** `server/src/dependencies.ts` for the full interface

---

## Common Pitfalls

Not being mindful of what directory you are running tools in.

## Quick Reference

| Task | Command |
|------|---------|
| Frontend changes | `cd projects/birdhouse/frontend` |
| Server changes | `cd projects/birdhouse/server` |
| Plugin changes | `cd projects/birdhouse-oc-plugin` |
| View architecture | Read `projects/birdhouse/README.md` |
| View frontend docs | Read `projects/birdhouse/frontend/README.md` |
| View server docs | Read `projects/birdhouse/server/README.md` |

## Workspace Best Practices

When working in this workspace:

- **Navigate to the appropriate project** before running git commands
- **Read project READMEs** to understand dependencies and build processes
- **Follow commit style guide** at [`docs/git-commit-style.md`](docs/git-commit-style.md) - required reading for all git commits
- **Commit Often** We like small commits. Easy to squash later!
- **Logging & reading logs** documented in [`LOGGING.md`](LOGGING.md)

## Working with Agents

### Delegating Specialized Work

For tasks requiring domain-specific knowledge, delegate to a child agent that's warmed up with the relevant documentation:

**Platform Database Changes (Supabase)**
- When making schema changes to the platform database (user/license management)
- Create a child agent and have it read `projects/birdhouse/server/supabase/README.md` first
- This ensures the agent understands the migration workflow and best practices
- The agent will use proper `supabase migration new` → `supabase db push` workflow instead of ad-hoc changes

**Frontend Development (SolidJS/Corvu)**
- Before working with SolidJS reactive primitives, effects, or component lifecycle, read `projects/birdhouse/docs/code-review/solidjs.md`
- Before working with Corvu UI components (Dialog, Drawer, etc), read `projects/birdhouse/docs/code-review/corvu.md`
- These docs contain essential patterns and common pitfalls with real codebase examples

## Documentation

- **Git Commit Style** - [`docs/git-commit-style.md`](docs/git-commit-style.md) - Subject-first commit messages optimized for scanning and searching
- **Code Review Guides** - [`projects/birdhouse/docs/code-review/`](projects/birdhouse/docs/code-review/) - Best practices and patterns for the Birdhouse codebase
  - [`solidjs.md`](projects/birdhouse/docs/code-review/solidjs.md) - SolidJS reactive primitives, effects, component lifecycle
  - [`corvu.md`](projects/birdhouse/docs/code-review/corvu.md) - Corvu UI components (Dialog, Drawer, etc)
  - [`testing.md`](projects/birdhouse/docs/code-review/testing.md) - Testing patterns and best practices
  - [`CODE_REVIEW.md`](projects/birdhouse/docs/code-review/CODE_REVIEW.md) - Index of all code review guides

## Questions?

If you're unsure which project to work in, ask your human before proceeding.
