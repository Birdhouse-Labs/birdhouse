# Agent Read Exchange

## Description

Verifies that Birdhouse's agent tooling API works correctly across multiple exchanges. A worker agent is driven through five steps involving file creation, reading, editing, and bash. After completion, all four read modes are exercised and their output is inspected.

## What this tests

- `agent_create`, `agent_reply`, and `agent_read` work correctly across multiple exchanges
- `agent_read` default (last message), `latest_turn`, `full`, and `all` modes each return the expected scope of conversation
- `agent_read_tool_call` correctly drills into individual tool calls from `full` output
- File edit tools and bash tool work correctly inside a child agent
- The worker agent produces the correct file contents after sequential edits

## Prerequisites

- sandbox1 running and fork-verified (see SKILL.md environment setup)
- No browser required — this test exercises the agent tooling API directly

## Timeout

10 minutes from first `agent_create` call.

## Model selection

Not applicable — the worker agent uses whatever model the parent assigns. Use the default model.

## Steps

1. Create a timestamped run directory:
   ```bash
   RUN_DIR="/tmp/agent-read-exchange-test-$(date +%Y-%m-%d-%H-%M-%S)"
   mkdir -p "$RUN_DIR"
   ```

2. Create the worker agent with this exact prompt:
   ```
   You are a careful tool worker.

   Rules:
   - Complete only the specific step you are asked to do.
   - Use tools when needed.
   - After each step, report the result clearly and wait for the next instruction.
   - Do not anticipate future steps.
   - Do not write any documentation files.
   ```
   Note the worker's agent ID.

3. Wait for the worker's initial response before continuing.

4. **Step 1** — Reply to the worker:
   ```
   Create the directory `tmp/read-exchange-test` if needed.
   Then create `tmp/read-exchange-test/note.txt` with exactly these three lines:

   alpha
   beta
   gamma

   Use file-editing tools, not bash, for the file contents.
   Report what you created and wait.
   ```
   Wait for completion.

5. **Step 2** — Reply to the worker:
   ```
   Read `tmp/read-exchange-test/note.txt` and report the second line only.
   Wait after reporting.
   ```
   Wait for completion.

6. **Step 3** — Reply to the worker:
   ```
   Update `tmp/read-exchange-test/note.txt` so the second line becomes:

   beta-updated

   Use a file-editing tool.
   Report the change and wait.
   ```
   Wait for completion.

7. **Step 4** — Reply to the worker:
   ```
   Read `tmp/read-exchange-test/note.txt` again and report the full contents.
   Wait after reporting.
   ```
   Wait for completion.

8. **Step 5** — Reply to the worker:
   ```
   Run a bash command that lists the contents of `tmp/read-exchange-test` and report what exists.
   Wait after reporting.
   ```
   Wait for completion.

9. **Read-mode inspection** — Inspect the worker with all four read modes:
   - `agent_read({ agent_id: WORKER_ID })` — default last message
   - `agent_read({ agent_id: WORKER_ID, latest_turn: true })` — latest exchange
   - `agent_read({ agent_id: WORKER_ID, full: true })` — full conversation summary
   - `agent_read({ agent_id: WORKER_ID, all: true })` — raw full transcript

   Then from the `full` output, pick two tool calls and inspect them:
   - One file-related tool call (`read`, `write`, or `edit`)
   - One `bash` tool call
   Use `agent_read_tool_call({ agent_id: WORKER_ID, call_id: CALL_ID })` for each.

10. Read the actual file to verify contents:
    ```bash
    cat tmp/read-exchange-test/note.txt
    ```

11. Write a summary to `$RUN_DIR/report.txt` containing:
    - Worker agent ID
    - Final file contents
    - What each read mode returned (one line per mode)
    - What the two tool-call drill-downs added
    - Any deviations

12. **Clean up** — delete the test directory:
    ```bash
    rm -rf tmp/read-exchange-test
    ```

## Pass criteria

All of the following must be true:

- `tmp/read-exchange-test/note.txt` final contents are exactly:
  ```
  alpha
  beta-updated
  gamma
  ```
- `agent_read` default returns only the worker's last message (step 5 response)
- `agent_read` with `latest_turn: true` returns the step 5 exchange (reply + response)
- `agent_read` with `full: true` returns a summary covering all five exchanges
- `agent_read` with `all: true` returns more detail than `full` (raw tool call content visible)
- `agent_read_tool_call` returns the full content of the inspected tool call
- `$RUN_DIR/report.txt` exists and is non-empty

## Fail criteria

Any of the following immediately indicates failure:

- Final file contents differ from expected (wrong lines, extra whitespace, missing update)
- Any `agent_read` call errors or returns empty content
- `latest_turn` returns more than one exchange worth of content (suggests it is behaving like `full`)
- `full` and `all` return identical content (suggests one mode is not working correctly)
- `agent_read_tool_call` errors or returns less content than the `full` preview
- The test did not complete within 10 minutes

## Known limitations

- This test does not use a browser and produces no video or screenshots — only `$RUN_DIR/report.txt`.
- The exact wording of read mode output will vary. Evaluate scope (how much conversation is covered) not exact phrasing.
- If the worker uses `write` instead of `edit` for step 3, the file will still be correct — this is not a failure.
