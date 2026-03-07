# Run Agent Test Suite

Run the agent test cases in this folder and report which ones pass, partially run, or are blocked in the current Birdhouse environment.

## Purpose

This file is the entry point for one agent to run the whole suite.

Do not assume every Birdhouse environment exposes the same tool surface or contains the same dataset agents.

## Step 1: Inspect Your Tool Surface

Before running any case, determine what this environment actually supports.

At minimum, check whether you have:

- `agent_create`
- `agent_reply`
- `agent_read`
- `agent_tree`

Also determine whether your environment supports:

- `agent_read({ ..., full: true })`
- `agent_read_tool_call`

If those are not available, do not pretend the suite fully passed. Record the mismatch explicitly.

## Step 2: Run Cases In Order

Run these files in order:

1. `fib-recursive-agents.md`
2. `read-exchange-tooling.md`
3. `implementation-tree-reading.md`

## Step 3: Classification Rules

For each case, classify it as one of:

- `passed`
- `partially runnable`
- `blocked`

Use these meanings:

- `passed`: you ran the case as written and recovered the intended outputs
- `partially runnable`: you could run the main behavior, but the docs required tools or capabilities that were missing in your environment
- `blocked`: the case depends on a fixed dataset or environment artifact that does not exist where you are running

## Case-Specific Expectations

### `fib-recursive-agents.md`

- Should be runnable in any Birdhouse environment that has `agent_create`, `agent_read`, and `agent_tree`
- Strongly validates recursive `agent_create`

### `read-exchange-tooling.md`

- Requires `agent_create`, `agent_reply`, and `agent_read`
- Fully validates the intended workflow only if `full` and `agent_read_tool_call` are available
- This case intentionally creates and edits the fixture file `tmp/read-exchange-test/note.txt`
- Those writes are allowed because they are the test fixture itself
- If those are missing, mark the case `partially runnable`

### `implementation-tree-reading.md`

- Uses fixed dataset agent IDs
- First, verify whether those exact agents exist
- If any required fixed agent is missing, mark the case `blocked`
- Do not treat missing dataset agents as runner failure; treat them as dataset availability failure

## What To Report

For each case, report:

1. classification (`passed`, `partially runnable`, or `blocked`)
2. links to the agents you created or inspected
3. final result or key output
4. what worked
5. what was missing or confusing

Then give a suite summary:

1. Which cases passed cleanly
2. Which cases were only partially runnable
3. Which cases were blocked by missing dataset or tool support
4. Exact tool-surface mismatches
5. Exact dataset gaps
6. What a future runner should know before attempting the suite

## Important Honesty Rule

If your environment lacks `full`, `agent_read_tool_call`, or the fixed dataset agents, say so plainly.

Do not silently substitute a different workflow and claim full success.
