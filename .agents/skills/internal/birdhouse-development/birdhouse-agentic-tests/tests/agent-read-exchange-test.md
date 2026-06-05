# Agent Read Exchange

## Description

Verifies that a Birdhouse agent can create a child agent, exchange messages with it across multiple turns, and use file and bash tools correctly. The test is driven entirely through the browser UI — the test runner types messages to a sandbox Birdhouse agent asking it to orchestrate a worker through a sequence of file and bash operations.

**Why browser-driven:** The test runner lives in production Birdhouse (port 50100). The sandbox under test runs at port 50200. These are separate environments. The only way to exercise sandbox behavior is through the browser.

## What this tests

- A sandbox Birdhouse agent can create a child agent on request
- The parent agent can relay instructions to its child across multiple turns
- File edit tools and bash work correctly inside the child agent
- The parent agent correctly reports the child's results back through the UI
- The agent tree in the sidebar shows the child nested under the parent

## Prerequisites

- sandbox1 running and fork-verified (see SKILL.md environment setup)
- Any free model available

## Timeout

5 minutes from when the first message is sent.

## Model selection

First choice: **Big Pickle**. Second choice: any model with "free" in its name.

## Steps

1. Create a timestamped run directory:
   ```bash
   RUN_DIR="/tmp/agent-read-exchange-test-$(date +%Y-%m-%d-%H-%M-%S)"
   mkdir -p "$RUN_DIR"
   ```

2. Close any existing session, open the sandbox agents page, and start recording immediately:
   ```bash
   browser-use --session birdhouse-exchange-test close 2>/dev/null || true
   browser-use --session birdhouse-exchange-test open \
     "http://127.0.0.1:50200/#/workspace/<id>/agents"
   browser-use --session birdhouse-exchange-test record start \
     "$RUN_DIR/exchange-recording.mp4"
   ```

3. Save screenshot `$RUN_DIR/01-agents-page.png`.

4. Click **New Agent**, select **Big Pickle** (or first free model using the JS input event approach from the fib test), and type:

   ```
   I need you to create a child agent to do some file work. Create a child agent with this exact prompt:

   You are a careful tool worker. Complete only the specific step you are asked to do. Use tools when needed. After each step, report the result clearly and wait for the next instruction. Do not anticipate future steps.

   Once the child agent responds with its initial greeting, tell me the child is ready and wait for my next instruction.
   ```

5. Launch Agent. Save screenshot `$RUN_DIR/02-launched.png`.

6. Wait for the parent agent to complete. Completion: Stop→Send transition; gradient fades on the parent's row/header. A child agent should be visible in the sidebar nested under the parent.

7. Save screenshot `$RUN_DIR/03-child-created.png` showing the child in the sidebar.

8. **Relay 1** — Reply to the parent agent:
   ```
   Relay this to your child word for word:

   Do these two things in order:
   1. Create the directory tmp/read-exchange-test if needed, then create tmp/read-exchange-test/note.txt with exactly these three lines (use file-editing tools, not bash):
   alpha
   beta
   gamma
   2. Read tmp/read-exchange-test/note.txt and report the second line only.

   Report both results and wait.

   Tell me: what file did the child create, and what was the second line?
   ```

9. Wait for completion. Save screenshot `$RUN_DIR/04-relay1-done.png`.

10. **Relay 2** — Reply to the parent agent:
    ```
    Relay this to your child word for word:

    Do these two things in order:
    1. Update tmp/read-exchange-test/note.txt so the second line becomes: beta-updated. Use a file-editing tool.
    2. Read tmp/read-exchange-test/note.txt and report the full contents.

    Report both results and wait.

    Tell me the full file contents the child reports after the edit.
    ```

11. Wait for completion. Save screenshot `$RUN_DIR/05-relay2-done.png`.

12. Stop the recording and save final screenshot `$RUN_DIR/06-final.png`.
    ```bash
    browser-use --session birdhouse-exchange-test record stop
    ```

## Pass criteria

All of the following must be true:

- A child agent appears in the sidebar nested under the parent after the first exchange
- The parent reports `beta` as the second line (relay 1)
- The parent reports the full contents as `alpha`, `beta-updated`, `gamma` after the edit (relay 2)
- The video file exists and has a non-zero file size

## Fail criteria

Any of the following immediately indicates failure:

- No child agent appears in the sidebar
- The parent reports wrong second line (anything other than `beta`)
- The parent reports wrong final contents after the edit
- The parent reports a tool call error that blocks progress
- The test did not complete within 5 minutes
- The recording failed or is missing

## Known limitations

- The parent agent may paraphrase the child's output. Evaluate correctness of content, not exact wording.
- No cleanup step — `tmp/read-exchange-test/` is left on disk after the test. Bash is unreliable in this sandbox environment due to WASM runtime issues, so cleanup is intentionally omitted rather than wasting test time on known failures.
