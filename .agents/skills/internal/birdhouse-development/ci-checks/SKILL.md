---
name: ci-checks
description: List all Birdhouse CI checks and how to run them locally. Load this skill when you need to run CI checks, verify a branch is clean, or check if changes would pass GitHub Actions.
tags:
  - birdhouse
trigger_phrases:
  - ci checks
metadata:
  internal: true
version: 1.0.0
---

# CI Checks

Run each check as a separate tool call from the appropriate working directory. All checks must pass before merging.

## Frontend

Working directory: `projects/birdhouse/frontend`

```bash
bun run typecheck
```

```bash
bun run lint
```

```bash
bun run lint:css
```

```bash
bun run test
```

```bash
bun run generate:themes && bun run validate:themes && bun run build
```

## Server

Working directory: `projects/birdhouse/server`

```bash
bun run typecheck
```

```bash
bun run lint
```

```bash
bun test
```

```bash
bun run build
```

## Plugin

Working directory: `projects/birdhouse-oc-plugin`

```bash
bun run typecheck
```

```bash
bun test
```

```bash
bun run build
```

## Notes

- Run each command as a separate tool call so failures are isolated and easy to identify.
- If working in a worktree, prefix each path with the worktree root (e.g. `worktrees/my-feature/projects/birdhouse/frontend`).
- Frontend test failures may include pre-existing failures unrelated to your changes — check whether failing test files are ones you touched.
