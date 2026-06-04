---
name: birdhouse-integration-tests
description: Run, write, and manage Birdhouse integration tests. Each test exercises Birdhouse end-to-end using a real browser and a real isolated OpenCode instance. Use when asked to run integration tests, run a specific test, or add a new integration test.
tags:
  - birdhouse
  - testing
  - integration
version: 1.0.0
author: Birdhouse Team
metadata:
  internal: true
---

# Birdhouse Integration Tests

End-to-end tests that exercise Birdhouse through a real browser against a real isolated OpenCode instance. Each test is a markdown file. An agent follows the steps, then self-scores pass or fail based on the criteria in the test file.

## What an integration test is

A markdown file in `tests/` alongside this skill. Every test file contains:

- **Title and description** — what the test covers
- **What this tests** — the specific behaviors being validated
- **Prerequisites** — what must be true before the test starts
- **Timeout** — maximum wall-clock time to allow
- **Steps** — numbered, browser-driven actions to perform in order
- **Pass criteria** — specific, checkable conditions that must all be true
- **Fail criteria** — specific conditions that immediately indicate failure

The agent self-scores at the end based solely on the criteria written in the test file. No judgment calls — if the criteria are met, it passes.

## Finding tests

Tests live in the `tests/` directory alongside this skill file. When asked to run a named test, list the files in `tests/` and pick the closest match by name or description. Do not hardcode a list — read the directory each time.

## Environment setup

### Default: sandbox1

sandbox1 is the persistent testing environment. It accumulates state across runs, which intentionally exercises data migrations and agent history loading.

- Birdhouse URL: `http://127.0.0.1:50200`
- OpenCode health: `http://127.0.0.1:50210/global/health`
- Start command (from birdhouse-workspace root, absolute path required):
  ```bash
  bash sandboxes/start-sandbox.sh --sandbox sandbox1 \
    --opencode-path /Users/crayment/dev/birdhouse-workspace/.worktrees/opencode-birdhouse
  ```
- Stop command:
  ```bash
  bash sandboxes/stop-sandbox.sh --sandbox sandbox1
  ```

Before running any test, verify sandbox1 is running and using the Birdhouse fork:

```bash
curl -s http://127.0.0.1:50210/global/health
```

The response must contain `birdhouseWorkspaceId`. If it does not, opencode is not using the Birdhouse fork — stop and investigate before running tests.

If sandbox1 is not running, start it. If the opencode worktree is missing (e.g. after an OS upgrade), recreate it:

```bash
git -C ~/dev/oss/opencode worktree prune
git -C ~/dev/oss/opencode worktree add \
  /Users/crayment/dev/birdhouse-workspace/.worktrees/opencode-birdhouse \
  birdhouse-v<version>
cd .worktrees/opencode-birdhouse && bun install
cp projects/birdhouse-oc-plugin/src/plugin.ts \
   .worktrees/opencode-birdhouse/packages/opencode/src/plugin/birdhouse.ts
```

### Fresh isolated instance

If asked to run against a fresh isolated instance instead of sandbox1, load the `isolated-birdhouse-web-testing` skill for the full setup workflow. Use it when you need a guaranteed clean state or are testing data migrations from scratch.

## Getting the workspace ID

The sandbox may have an existing workspace from a previous run. Check:

```bash
sqlite3 sandboxes/sandbox1/data.db \
  "SELECT workspace_id FROM workspaces LIMIT 1;"
```

If no workspace exists, create one:

```bash
curl -s -X POST http://127.0.0.1:50200/api/workspaces/create \
  -H "Content-Type: application/json" \
  -d '{"directory": "sandboxes/sandbox1/workspace"}'
```

Then trigger opencode to spawn by hitting a workspace endpoint and waiting ~10 seconds:

```bash
curl -s http://127.0.0.1:50200/api/workspace/<id>/models > /dev/null
sleep 10
```

## Model selection

First choice: **Big Pickle** (`opencode/big-pickle`). Second choice: any model with "free" in its name.

Check what's available:
```bash
curl -s http://127.0.0.1:50200/api/workspace/<id>/models | python3 -m json.tool
```

The prompt can override this by naming a specific model. Tests are designed to work with free models so they run without API key setup.

## Browser automation

Load the [browser-use](birdhouse:skill/browser-use) skill for all browser work. Follow its patterns for opening pages, interacting with elements, taking screenshots, and recording video. Do not repeat its commands here.

If a different browser automation skill is preferred, swap the skill reference above — nothing in this skill depends on browser-use internals.

Use a named browser session (e.g. `--session birdhouse-test`) so the browser persists across steps within a test.

## Running a single test

Each test manages its own timestamped run directory under `/tmp/`. The test file's steps define where to create it. Artifacts (screenshots, video) go inside that directory. At the end of the test, report the run directory path.

1. Read the test file from `tests/`.
2. Set up the environment (sandbox running, workspace ID obtained, opencode verified).
3. Follow the test steps exactly, including the step that creates the run directory.
4. Produce the output contract (see below), including the run directory path.

## Running all tests (or a named subset)

Create a top-level suite directory first, then run each test serially inside it:

```bash
SUITE_DIR="/tmp/birdhouse-suite-$(date +%Y-%m-%d-%H-%M-%S)"
mkdir -p "$SUITE_DIR"
echo "Suite output: $SUITE_DIR"
```

For each test, override the test's `RUN_DIR` to be a subdirectory of `$SUITE_DIR` named after the test:

```bash
RUN_DIR="$SUITE_DIR/<test-name>"
mkdir -p "$RUN_DIR"
```

Run serially — one test at a time, in file-system order. After all tests complete, produce a summary report listing each test's verdict, one-line reasoning, and run directory path. Report the suite directory path so the user can inspect all artifacts in one place.

When asked to run a subset by name ("run the fib and autocomplete tests"), match by test file name. Run only the matched tests.

## Output contract

Every test run must produce:

```
verdict: pass | fail
reasoning: <what was checked and why it passed or failed>
video: <absolute path to MP4>
screenshots: <ordered list of absolute paths>
deviations: <any steps that could not be followed as written, or "none">
```

A parent agent (such as opencode-rebase) can consume this output to gate a release.

## Adding a new test

1. Copy `tests/template.md` to `tests/<name>.md`.
2. Fill in every section. Leave no placeholder text.
3. Pass criteria must be checkable from the browser UI alone — no API calls.
4. Run the test once standalone before committing to confirm the steps are followable and the criteria are unambiguous.
5. Commit the new test file.

Base directory for this skill: file:///Users/crayment/dev/birdhouse-workspace/.agents/skills/internal/birdhouse-development/birdhouse-integration-tests
Relative paths in this skill (e.g., tests/) are relative to this base directory.
