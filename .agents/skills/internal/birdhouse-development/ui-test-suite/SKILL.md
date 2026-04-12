---
name: ui-test-suite
description: Goal-driven UI test suite for Birdhouse. Runs an agent through real user flows in an isolated server using browser automation, producing timestamped artifacts (screenshots, logs, report).
tags:
  - testing
  - birdhouse
trigger_phrases:
  - UI test suite
metadata:
  internal: true
---

# Birdhouse UI Test Suite

## Strategy

Traditional UI tests break when you rename a button or restructure a page. This suite takes a different approach: give an agent *user goals*, a fresh isolated environment, and browser automation tools, then let it figure out how to achieve those goals while observing what is clear, confusing, or broken along the way.

This makes tests **resilient to UI changes** (the agent adapts like a real user) and **useful for UX review** instead of only producing brittle pass/fail assertions. A good run should tell you both whether the flow worked and where a new user would struggle.

Each test case is a *spec*, not a script. It describes what the user is trying to accomplish, what success looks like, and what deserves scrutiny. The agent should adapt to the UI it finds rather than expecting exact copy, selectors, or button positions.

## Required workflow

If you are running or authoring this suite, read these files in this order before doing anything else:

1. **[how-to-run-a-test-case.md](./how-to-run-a-test-case.md)** — exact runbook for creating a clean environment, starting Birdhouse, and constructing the test agent prompt
2. **[how-to-write-a-test-case.md](./how-to-write-a-test-case.md)** — rules for writing durable goal-based test cases instead of click scripts
3. **A test case file** from `test-cases/` — the specific user journey to execute, for example **[test-cases/ftue-walk-through.md](./test-cases/ftue-walk-through.md)**

Do not assume the test case contains runner setup. Environment isolation, temp directories, browser cleanup, and credentials handling belong in the runbook, not in the test case.

## What a valid run needs

- A repository root determined at run time instead of machine-specific absolute paths
- A fresh Birdhouse server instance with its own temp data database
- A unique workspace directory for the run so workspace-scoped state does not leak between runs
- A timestamped artifact directory under `tmp/ui-test-runs/` containing screenshots, logs, and the written report for that run
- A browser session cleared of cookies and storage for the test origin
- Any required real credentials supplied in the prompt at run time, never hard-coded into the skill or test case
- A final report that separates product issues from environment issues such as expired keys, quota exhaustion, or third-party outages

## Files

- **[how-to-run-a-test-case.md](./how-to-run-a-test-case.md)** — exact run steps, prompt template, cleanup, and isolation rules
- **[how-to-write-a-test-case.md](./how-to-write-a-test-case.md)** — template and principles for authoring new test cases
- **[test-cases/ftue-walk-through.md](./test-cases/ftue-walk-through.md)** — first-time user experience: profile, workspace creation, provider setup, and first agent launch
