---
name: birdhouse-agentic-tests
description: Run, write, and manage Birdhouse agentic tests. Each test exercises Birdhouse end-to-end using a real browser and a real sandbox or explicitly requested isolated OpenCode instance. Use when asked to run agentic tests, run a specific test, or add a new agentic test.
tags:
  - birdhouse
  - testing
  - agentic
version: 1.0.0
author: Birdhouse Team
metadata:
  internal: true
---

# Birdhouse Agentic Tests

End-to-end tests that exercise Birdhouse through a real browser against a real Birdhouse sandbox. By default, tests run against the persistent `sandbox1` environment so Cody can inspect the same stateful environment manually. `sandbox2` is supported when explicitly requested. Fresh isolated runs are used only when explicitly requested. Each test is a markdown file. An agent follows the steps, then self-scores pass or fail based on the criteria in the test file.

## ⚠️ Two-environment constraint — read this first

**The test runner agent is NOT inside the sandbox it is testing.**

- The test runner lives in the **production Birdhouse** (port 50100) — the same environment you are talking to the test runner in.
- The sandbox under test usually runs at **port 50200** (`sandbox1`) or **50220** (`sandbox2`).
- These are completely separate environments with separate agent stores, separate sessions, and separate OpenCode instances.

**Consequence:** Any `agent_create`, `agent_reply`, `agent_read`, or file tool call the test runner makes goes into production, not sandbox. The only way to exercise sandbox Birdhouse is through the browser — by opening the chosen sandbox URL in a browser session and interacting with the sandbox UI.

**Every test must be browser-driven.** There is no exception. A test that calls Birdhouse agent tools directly is testing the production environment, not the sandbox.

## What an agentic test is

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

### Environment selection policy

- Default target: `sandbox1`
- If Cody explicitly says `sandbox2`, use `sandbox2`
- If Cody explicitly asks for isolated/fresh/disposable, load the `isolated-birdhouse-web-testing` skill and follow that workflow instead of using a sandbox
- If Cody mentions a worktree, still prefer the requested sandbox (`sandbox1` by default) unless Cody explicitly asks for isolated

### Sandbox ports

- `sandbox1`
  - Birdhouse URL: `http://127.0.0.1:50200`
  - OpenCode health: `http://127.0.0.1:50210/global/health`
- `sandbox2`
  - Birdhouse URL: `http://127.0.0.1:50220`
  - OpenCode health: `http://127.0.0.1:50230/global/health`

### Sandbox ownership preflight

Before running any test against `sandbox1` or `sandbox2`, always do all of the following:

1. Check whether the target Birdhouse port is listening.
   ```bash
   lsof -nP -iTCP:<birdhouse-port> -sTCP:LISTEN
   ```

2. If a process is listening, inspect its working directory.
   ```bash
   lsof -a -p <pid> -d cwd
   ```

3. Check OpenCode fork health.
   ```bash
   curl -s http://127.0.0.1:<opencode-port>/global/health
   ```

4. If Cody asked to use a specific worktree and the target sandbox is running from a different worktree, stop and ask Cody what to do.

   Report:
   - target sandbox (`sandbox1` or `sandbox2`)
   - listening PID
   - serving cwd
   - intended worktree

   Offer these likely next steps:
   - kill the current sandbox process and restart the requested sandbox from the intended worktree
   - use `sandbox2` instead
   - use an isolated run instead

Do not silently test a different worktree than the one Cody asked for.

### Starting a sandbox

If the chosen sandbox is not running and Cody has not asked for isolated:

1. Run the start command from the repo root or the intended worktree root.
2. Pass an absolute `--opencode-path`.
3. Re-run the ownership preflight after startup.

Example:

```bash
bash sandboxes/start-sandbox.sh --sandbox sandbox1 \
  --opencode-path /absolute/path/to/opencode
```

Use `sandbox2` the same way when explicitly requested:

```bash
bash sandboxes/start-sandbox.sh --sandbox sandbox2 \
  --opencode-path /absolute/path/to/opencode
```

Stop commands:

```bash
bash sandboxes/stop-sandbox.sh --sandbox sandbox1
bash sandboxes/stop-sandbox.sh --sandbox sandbox2
```

### Fresh isolated instance

If Cody explicitly asks for a fresh isolated instance instead of `sandbox1`/`sandbox2`, load the `isolated-birdhouse-web-testing` skill for the full setup workflow.

## Runner-owned runtime values

The top-level skill runner owns environment discovery. Test files must not derive these values themselves from local sqlite files or fixed ports.

Before executing a test, resolve these runtime values:

- `<base-url>` — the chosen Birdhouse sandbox URL
- `<workspace-id>` — the Birdhouse workspace id to test against
- `<workspace-root>` — the filesystem directory for that workspace
- `<run-dir>` — the artifact directory for this run
- `<session-name>` — the named browser session for the run
- `<model-name>` — the selected model label when the test launches an agent

Resolve them like this:

1. `BASE_URL` comes from the chosen target sandbox.
2. `WORKSPACE_ID` should come from the running sandbox, not from a local sqlite file assumption. Prefer:
   - the `birdhouseWorkspaceId` field from the OpenCode health response when present, or
   - `GET /api/workspaces` followed by `GET /api/workspace/:id` if you need to inspect available workspaces.
3. `WORKSPACE_ROOT` should come from the running Birdhouse API, not from the local `sandboxes/` folder assumption. Use:
   - `GET /api/workspaces` and match the chosen `workspace_id`, then read that workspace's `directory` field.
4. If you must create a new sandbox workspace, use an absolute directory path under the target sandbox/worktree. Do not use a relative directory, because it may resolve against the OpenCode side instead of the Birdhouse worktree.

   Good:
   ```bash
   curl -s -X POST <base-url>/api/workspace/create \
     -H "Content-Type: application/json" \
     -d '{"directory":"/absolute/path/to/worktree/sandboxes/sandbox2/workspace"}'
   ```

   Bad:
   ```bash
   curl -s -X POST <base-url>/api/workspace/create \
     -H "Content-Type: application/json" \
     -d '{"directory":"sandboxes/sandbox2/workspace"}'
   ```
5. `RUN_DIR` should be created by the runner before browser work starts.
6. `SESSION_NAME` should be unique per run and reused for every browser command in that run.

## Model selection

First choice: **Big Pickle** (`opencode/big-pickle`). Second choice: any model with "free" in its name.

Check what's available against the chosen sandbox base URL:
```bash
curl -s <base-url>/api/workspace/<workspace-id>/models | python3 -m json.tool
```

The prompt can override this by naming a specific model. Tests are designed to work with free models so they run without API key setup.

## Browser automation

Load the [browser-use](birdhouse:skill/browser-use) skill for all browser work. Pass this skill reference to child agents so they can load it. Follow its patterns for opening pages, interacting with elements, taking screenshots, and recording video.

If a different browser automation skill is preferred, swap the skill reference above — nothing in this skill depends on browser-use internals.

Use a persistent, named browser context for the whole test so page state survives across steps. If the selected browser tool supports named sessions, use a stable name such as `birdhouse-test`.

**Recording rule:** always start and stop recording on the same named browser session used for the interactions. If the recording is missing, zero bytes, or structurally invalid, fail the run rather than substituting a different recording method unless Cody explicitly asked for that fallback.

Example:

```bash
browser-use --session <session-name> open "<base-url>/#/workspace/<workspace-id>/agents"
browser-use --session <session-name> record start "<run-dir>/test-recording.mp4"
# ...all interactions use --session <session-name>...
browser-use --session <session-name> record stop
ffprobe -v error -show_entries format=duration,size \
  -of default=noprint_wrappers=1:nokey=0 "<run-dir>/test-recording.mp4"
```

**Viewport size — always set to 720p by default.** Immediately after every `browser-use open` call, set the viewport to 1280×720 unless the prompt explicitly instructs a different resolution:

```bash
browser-use --session <session-name> python "browser._run(browser._session._cdp_set_viewport(1280, 720))"
```

Verify it took:
```bash
browser-use --session <session-name> eval "window.innerWidth + 'x' + window.innerHeight"
# expected: 1280x720
```

Note: `await session.page.set_viewport_size(...)` does not work — `session` is not in scope and `await` outside an async function raises a SyntaxError. Use the `_cdp_set_viewport` approach above.

**Completion detection:** Two reliable visual signals that an agent run has finished:

1. The message panel switches from a **Stop** button to a **Send** button.
2. The agent's row in the sidebar and its header lose their **gradient color**. Running agents display a purple/pink gradient on their row and title. Completed agents show plain/muted colors. The Birdhouse brand icon next to each row is a static logo — it does not animate regardless of run state.

## Running a single test

Run a single test in this exact order:

1. Read the test file from `tests/`.
2. Choose the environment:
   - `sandbox1` by default
   - `sandbox2` only if Cody explicitly asked for it
   - isolated only if Cody explicitly asked for it
3. Perform the sandbox ownership preflight.
4. If the chosen sandbox is owned by the wrong worktree for Cody’s request, stop and ask Cody what to do.
5. Resolve the runner-owned runtime values.
6. Follow the browser-driven test steps exactly, substituting the resolved runtime values where the test expects them.
7. Verify the recording artifact before declaring success.
8. Produce the output contract (see below), including the run directory path.

## Running all tests (or a named subset)

The orchestrator agent (you) coordinates the suite. It does NOT run the browser itself — it delegates each test to a child agent and waits for results.

### Orchestrator steps

1. List all test files in `tests/`. Skip `template.md`. If running a named subset, match by file name.

2. Create a suite directory:
   ```bash
   SUITE_DIR="/tmp/birdhouse-suite-$(date +%Y-%m-%d-%H-%M-%S)"
   mkdir -p "$SUITE_DIR"
   ```

3. For each test, **spawn a child agent** with:
   - The full contents of the test file — substitute runner-owned values like `<base-url>`, `<workspace-id>`, `<workspace-root>`, `<run-dir>`, `<session-name>`, and `<model-name>` before including it
   - The assigned `RUN_DIR` path: `$SUITE_DIR/<test-name-without-extension>`
   - The full contents of SKILL.md (so the child knows the output contract and environment)
   - The [browser-use](birdhouse:skill/browser-use) skill reference (pass the link so the child can load it)
   - The sandbox environment details (URL, workspace ID, workspace root, chosen sandbox name)
   - Instruction to produce the output contract and use `RUN_DIR` for all artifacts

   Wait for each child agent to complete before spawning the next.

4. Collect the output contract from each child agent.

5. Write `$SUITE_DIR/report.md` (see format below).

6. Report the suite directory path to the user.

### report.md format

```markdown
# Agentic Test Suite Report

**Date:** <date>
**Suite:** <SUITE_DIR>
**Result:** <N> passed, <M> failed

## Summary

| Test | Verdict | Notes |
|------|---------|-------|
| fib | ✅ pass | fib(4) = 3, 10 agents, video recorded |
| skill-trigger-autocomplete | ❌ fail | Suggestion did not appear |

## Failure Details

### <test-name>

<Full reasoning from the child agent's output contract>

**Deviations:**
<deviations from the child agent's output contract>

**Artifacts:** <RUN_DIR path>
```

Only include a "Failure Details" section for tests that failed. If all tests pass, omit that section.

## Output contract

Every test run (child agent) must produce:

```
verdict: pass | fail
reasoning: <what was checked and why it passed or failed>
run_dir: <absolute path to the test's artifact directory>
video: <absolute path to MP4>
screenshots: <ordered list of absolute paths>
deviations: <any steps that could not be followed as written, or "none">
```

The orchestrator collects these from each child and uses them to write `report.md`.

## Adding a new test

All tests must be browser-driven — see the two-environment constraint above.

The test runner opens the runner-supplied sandbox URL in a browser and interacts with the sandbox UI. It cannot call Birdhouse agent tools directly against the sandbox.

1. Copy `tests/template.md` to `tests/<name>.md`.
2. Fill in every section. Leave no placeholder text.
3. Every step must be achievable through the browser UI — typing messages, clicking buttons, observing the agent tree, reading visible text.
4. Test files must not hardcode sandbox ownership assumptions. Do not make the test discover environment details from local sandbox sqlite files or fixed ports.
5. Tests should consume runner-provided values like `<base-url>`, `<workspace-id>`, `<workspace-root>`, `<run-dir>`, `<session-name>`, and `<model-name>` when needed.
6. If a test needs local fixture files, create them inside `<workspace-root>` (or another runner-provided workspace path) during the browser-driven flow. Do not assume repository assets exist under the active workspace root unless the runner explicitly supplied them.
7. Pass criteria must be verifiable from the browser UI alone.
8. Run the test once standalone before committing to confirm the steps are followable and the criteria are unambiguous.
9. Commit the new test file.

Base directory for this skill: file:///Users/crayment/dev/birdhouse-workspace/.agents/skills/internal/birdhouse-development/birdhouse-agentic-tests
Relative paths to skill-local assets (e.g., tests/) are relative to this base directory.
