# Agent Read Exchange Tooling Test

Exercise Birdhouse's read modes against a worker agent that accumulates multiple exchanges and tool calls.

## Purpose

This validates:

- `agent_create`
- `agent_reply`
- `agent_read`
- `agent_read_tool_call`
- file editing tools
- `bash`
- multi-turn conversation behavior

It is designed to compare `last`, `latest_turn`, `full`, and `all` on the same worker.

## Environment Requirements

- Minimum runnable requirements:
  - `agent_create`
  - `agent_reply`
  - `agent_read`
- Full intended coverage also requires:
  - `agent_read({ ..., full: true })`
  - `agent_read_tool_call`

If `full` or `agent_read_tool_call` are missing in your environment, run the case anyway and mark it as `partially runnable`.

## Procedure

1. Create one child agent named `Read exchange worker`.
2. Use `agent_reply` to drive that worker through a series of separate exchanges.
3. Inspect the worker with all Birdhouse read tools.
4. Drill into at least two tool calls with `agent_read_tool_call`.
5. Compare what each read mode reveals.

The point is to create a realistic multi-turn conversation, not to batch all instructions into one message.

## Worker Setup Prompt

```text
You are a careful tool worker.

Rules:
- Complete only the specific step you are asked to do.
- Use tools when needed.
- After each step, report the result clearly and wait for the next instruction.
- Do not anticipate future steps.
- Do not write any documentation files.
```

Wait for the worker's initial response before continuing.

## Shared Temp Path

Use this workspace-relative temp path throughout:

```text
tmp/read-exchange-test/note.txt
```

This file is the test fixture for the case.
Creating and editing it is intentional and allowed.

## Step Sequence

Drive the worker through these steps with separate `agent_reply` calls. Wait after each one.

### Step 1

```text
Create the directory `tmp/read-exchange-test` if needed.
Then create `tmp/read-exchange-test/note.txt` with exactly these three lines:

alpha
beta
gamma

Use file-editing tools, not bash, for the file contents.
Report what you created and wait.
```

### Step 2

```text
Read `tmp/read-exchange-test/note.txt` and report the second line only.
Wait after reporting.
```

### Step 3

```text
Update `tmp/read-exchange-test/note.txt` so the second line becomes:

beta-updated

Use a file-editing tool.
Report the change and wait.
```

### Step 4

```text
Read `tmp/read-exchange-test/note.txt` again and report the full contents.
Wait after reporting.
```

### Step 5

```text
Run a bash command that lists the contents of `tmp/read-exchange-test` and report what exists.
Wait after reporting.
```

## Read-Mode Inspection

After the worker completes all five steps, inspect the same worker with:

1. `agent_read({ agent_id: WORKER_ID })`
2. `agent_read({ agent_id: WORKER_ID, latest_turn: true })`
3. `agent_read({ agent_id: WORKER_ID, full: true })`
4. `agent_read({ agent_id: WORKER_ID, all: true })`

Then, from the `full` output, pick at least two tool calls and inspect them with `agent_read_tool_call`:

- one file-related tool call (`read`, `write`, or `apply_patch`)
- one `bash` tool call

## What To Report

Report all of the following:

1. Link to the worker agent
2. Final contents of `tmp/read-exchange-test/note.txt`
3. What `last` tells you
4. What `latest_turn` tells you about the latest exchange
5. What `full` tells you about the overall conversation
6. What `all` adds beyond `full`
7. What the tool-call drill-down adds beyond `full`
8. Whether each mode feels appropriate for its purpose

Be concrete. Mention whether the latest exchange is easy to follow, whether any mode is too noisy, and whether anything important is missing.

## Notes

- This is the stronger read-mode test compared with the Fibonacci case.
- It is especially useful for validating whether `latest_turn` captures the latest exchange cleanly and whether `full` plus drill-down forms a good handoff workflow.
