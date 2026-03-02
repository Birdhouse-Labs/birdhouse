# Contributing to Birdhouse

Thank you for your interest in contributing. This document covers everything you need to get started.

## Table of Contents

- [Before You Start](#before-you-start)
- [What We're Looking For](#what-were-looking-for)
- [What We're Not Looking For](#what-were-not-looking-for)
- [Setup](#setup)
- [Development Workflow](#development-workflow)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)
- [Code Style](#code-style)
- [Getting Help](#getting-help)

---

## Before You Start

- Read the [Roadmap](https://github.com/Birdhouse-Labs/birdhouse/discussions/categories/roadmap) to understand where Birdhouse is going and why.
- Check the [ROADMAP.md](./ROADMAP.md) to see what's planned and what's actively being worked on.
- Browse [open issues](https://github.com/Birdhouse-Labs/birdhouse/issues) — especially ones labeled `good first issue` or `help wanted`.
- For significant changes, open a [Discussion](https://github.com/Birdhouse-Labs/birdhouse/discussions) first to align before investing time in implementation.

## What We're Looking For

- Bug fixes for [reported issues](https://github.com/Birdhouse-Labs/birdhouse/issues?q=is%3Aissue+is%3Aopen+label%3A%22type%3A+bug%22)
- Features listed on the [roadmap](./ROADMAP.md) that are marked as accepting contributions
- Documentation improvements — clearer setup guides, better explanations, fixed typos
- Test coverage improvements
- Performance improvements with measurable benchmarks
- Accessibility improvements to the frontend

## What We're Not Looking For

To keep Birdhouse focused, we will close PRs that:

- Rewrite or significantly restructure existing working code
- Duplicate functionality that already exists

If you're unsure whether your idea fits, open a Discussion before writing any code.

---

## Setup

### Prerequisites

- [Bun](https://bun.sh) (v1.1 or later)
- [Birdhouse's OpenCode fork](https://github.com/Birdhouse-Labs/opencode) — Birdhouse requires our fork, not upstream OpenCode
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Fork and clone

```bash
git clone git@github.com:YOUR_USERNAME/birdhouse.git
cd birdhouse
```

### 2. Install dependencies

```bash
cd server && bun install
cd frontend && bun install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
BIRDHOUSE_BASE_PORT=50120
BIRDHOUSE_WORKSPACE_ROOT=/path/to/your/workspace
```

### 4. Start development servers

```bash
bun run dev
```

This starts the frontend (default: port 50120) and server (port 50121) with hot reload.

See [SETUP.md](./SETUP.md) for detailed port configuration and troubleshooting.

---

## Development Workflow

1. Create a branch from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes. Keep commits small and focused.

3. Run all checks before pushing:
   ```bash
   bun run check:all
   ```

4. Push and open a PR against `main`.

---

## Submitting a Pull Request

- Keep PRs focused on a single change. Large PRs are hard to review.
- Fill out the PR template completely.
- Link the issue your PR addresses (e.g. `Closes #123`).
- PRs need at least one approval before merging.
- Don't rebase or force-push after a review has started.

By submitting a PR, you agree that your contribution will be licensed under the [MIT License](./LICENSE).

---

## Reporting Bugs

Use the [bug report template](https://github.com/Birdhouse-Labs/birdhouse/issues/new?template=bug_report.yml). Include:

- Steps to reproduce
- Expected vs. actual behavior
- Birdhouse version, OS, Bun version

---

## Requesting Features

Open a [Discussion in Ideas](https://github.com/Birdhouse-Labs/birdhouse/discussions/categories/ideas) rather than an issue. Upvotes on discussions help us prioritize. If an idea gains traction and aligns with the roadmap, we'll convert it to a tracked issue.

---

## Code Style

- Match the style of the surrounding code — consistency within a file matters more than external conventions.
- All code files should start with a 2-line comment explaining what the file does (prefixed with `ABOUTME: `).
- Prefer simple, readable code over clever code.
- Avoid adding dependencies without discussion.

The frontend uses SolidJS — read [`docs/code-review/solidjs.md`](./docs/code-review/solidjs.md) before working on reactive primitives or component lifecycle. If you're working with Corvu UI components, read [`docs/code-review/corvu.md`](./docs/code-review/corvu.md).

---

## Getting Help

- **GitHub Discussions** — [Q&A category](https://github.com/Birdhouse-Labs/birdhouse/discussions/categories/q-a) for setup questions and general help
- **Issues** — for confirmed bugs only

We're a small team. We read everything but responses may take time.
