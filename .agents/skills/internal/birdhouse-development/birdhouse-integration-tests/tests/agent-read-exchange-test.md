# Agent Read Exchange

## Description

Verifies that Birdhouse's agent tooling API works correctly across multiple exchanges. The test agent drives a worker child through five steps of file and bash operations using `agent_create` and `agent_reply`, then inspects the worker with all four `agent_read` modes and `agent_read_tool_call`. A screen recording captures the agent's own work in the Birdhouse UI as it runs.

## What this tests

- `agent_create`, `agent_reply`, and `agent_read` work correctly across multiple exchanges
- `agent_read` default (last message), `latest_turn`, `full`, and `all` modes each return the correct scope of conversation
- `agent_read_tool_call` drills into individual tool calls from `full` output
- File edit tools and bash work correctly inside a child agent
- The worker produces correct file contents after sequential edits

## Prerequisites

- sandbox1 running and fork-verified (see SKILL.md environment setup)
- No browser interaction required for the test logic itself — but the test agent records its own Birdhouse UI session to produce a video artifact

## Timeout

10 minutes from first `agent_create` call.

## Model selection

Not applicable — this test uses agent tooling directly, not the model picker.

## Steps

1. Create a timestamped run directory:
   ```bash
   RUN_DIR="/tmp/agent-read-exchange-test-$(date +%Y-%m-%d-%H-%M-%S)"
   mkdir -p "$RUN_DIR"
   ```

2. Open the Birdhouse workspace agents page in a browser session and start recording. This captures the agent tree building as the test runs — the video is evidence that the tooling created real agents visible in the UI:
   ```bash
   browser-use --session birdhouse-exchange-test close 2>/dev/null || true
   browser-use --session birdhouse-exchange-test open \
     "http://127.0.0.1:50200/#/workspace/<id>/agents"
   browser-use --session birdhouse-exchange-test record start \
     "$RUN_DIR/exchange-recording.mp4"
   ```

3. **Create the worker agent** using `agent_create`:
   ```
   Prompt: "You are a careful tool worker. Complete only the specific step you are asked to do. Use tools when needed. After each step, report the result clearly and wait for the next instruction. Do not anticipate future steps. Do not write any documentation files."
   Title: "Worker agent: read-exchange-test"
   ```
   Save the worker's agent ID as `WORKER_ID`. Wait for the worker's initial response.

4. After the worker responds, take a screenshot showing it has appeared in the sidebar:
   ```bash
   browser-use --session birdhouse-exchange-test screenshot "$RUN_DIR/01-worker-created.png"
   ```

5. **Step 1** — Reply to the worker with `agent_reply`:
   ```
   Create the directory tmp/read-exchange-test if needed. Then create tmp/read-exchange-test/note.txt with exactly these three lines:

   alpha
   beta
   gamma

   Use file-editing tools, not bash, for the file contents. Report what you created and wait.
   ```
   Wait for completion.

6. **Step 2** — Reply to the worker:
   ```
   Read tmp/read-exchange-test/note.txt and report the second line only. Wait after reporting.
   ```
   Wait for completion. Note what the worker reports as the second line.

7. **Step 3** — Reply to the worker:
   ```
   Update tmp/read-exchange-test/note.txt so the second line becomes: beta-updated

   Use a file-editing tool. Report the change and wait.
   ```
   Wait for completion.

8. **Step 4** — Reply to the worker:
   ```
   Read tmp/read-exchange-test/note.txt again and report the full contents. Wait after reporting.
   ```
   Wait for completion.

9. **Step 5** — Reply to the worker:
   ```
   Run a bash command that lists the contents of tmp/read-exchange-test and report what exists. Wait after reporting.
   ```
   Wait for completion.

10. Take a screenshot showing the worker in the sidebar with all exchanges complete:
    ```bash
    browser-use --session birdhouse-exchange-test screenshot "$RUN_DIR/02-all-steps-done.png"
    ```

11. **Read-mode inspection** — Inspect the worker with all four modes:
    - `agent_read({ agent_id: WORKER_ID })` — default last message
    - `agent_read({ agent_id: WORKER_ID, latest_turn: true })` — latest exchange
    - `agent_read({ agent_id: WORKER_ID, full: true })` — full conversation summary
    - `agent_read({ agent_id: WORKER_ID, all: true })` — raw full transcript

    Note how many exchanges `latest_turn` returned — it should be exactly one.

    From the `full` output, find tool calls in the `parts` array entries with `type: "tool"`. The `callID` field in those parts maps to the `call_id` parameter of `agent_read_tool_call`. Select one of each type:
    - One file-related tool call (`read`, `write`, or `edit`)
    - One `bash` tool call

    Run `agent_read_tool_call({ agent_id: WORKER_ID, call_id: CALL_ID })` for each.

12. Read the actual file to verify contents:
    ```bash
    cat tmp/read-exchange-test/note.txt
    ```

13. **Stop recording:**
    ```bash
    browser-use --session birdhouse-exchange-test record stop
    ```

14. Write `$RUN_DIR/report.txt` containing:
    - Worker agent ID
    - Final file contents
    - What each read mode returned (one line per mode), including:
      - How many exchanges `latest_turn` returned
      - At least one field present in `all` but absent in `full` (e.g. tool timing metadata `time.start`/`time.end`)
    - What the two tool-call drill-downs added beyond the `full` preview
    - Any deviations

15. **Clean up:**
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
- The worker correctly reports `beta` as the second line after step 2
- `agent_read` default returns only the worker's last message (step 5 response)
- `agent_read` with `latest_turn: true` returns exactly one exchange (step 5 reply + response) — not the full conversation
- `agent_read` with `full: true` returns a summary covering all five exchanges
- `agent_read` with `all: true` includes fields absent in `full` — specifically tool timing metadata (`time.start`, `time.end`) in tool call state
- `agent_read_tool_call` returns the full content of the inspected tool call including inputs, outputs, and timing
- `$RUN_DIR/report.txt` exists and is non-empty
- The video file exists and has a non-zero file size

## Fail criteria

Any of the following immediately indicates failure:

- Final file contents differ from expected
- Worker reports wrong second line (anything other than `beta`)
- Any `agent_read` call errors or returns empty content
- `latest_turn` returns more than one exchange
- `full` and `all` contain no detectable differences (timing metadata absent from both)
- `agent_read_tool_call` errors or returns less content than the `full` preview
- The test did not complete within 10 minutes
- Recording failed or video is missing

## Known limitations

- The exact wording of read mode output will vary. Evaluate scope (how much conversation is covered) not exact phrasing.
- If the worker uses `write` instead of `edit` for step 3, the file will still be correct — not a failure.
- Directory creation via bash is acceptable even though the step asks for file-editing tools — the constraint is on file contents only.
- The worker may paraphrase bash output rather than quoting it verbatim. A natural-language summary is acceptable as long as the content is correct.
- The bash step (step 5) may fail in some sandbox environments due to WASM runtime issues. If bash fails but all file operations succeeded and all other pass criteria are met, note it as a deviation but do not fail the test.
