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

12 minutes from when the first message is sent.

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

8. Reply to the parent agent:
   ```
   Good. Now relay this to your child agent word for word:

   Create the directory tmp/read-exchange-test if needed. Then create tmp/read-exchange-test/note.txt with exactly these three lines:
   alpha
   beta
   gamma

   Use file-editing tools, not bash, for the file contents. Report what you created and wait.

   After the child responds, tell me what it created.
   ```

9. Wait for completion. Save screenshot `$RUN_DIR/04-step1-done.png`.

10. Reply to the parent agent:
    ```
    Relay this to your child: Read tmp/read-exchange-test/note.txt and report the second line only. Wait after reporting.

    Tell me what the child says the second line is.
    ```

11. Wait for completion. Save screenshot `$RUN_DIR/05-step2-done.png`.

12. Reply to the parent agent:
    ```
    Relay this to your child: Update tmp/read-exchange-test/note.txt so the second line becomes: beta-updated. Use a file-editing tool. Report the change and wait.

    Tell me when the child confirms the update.
    ```

13. Wait for completion. Save screenshot `$RUN_DIR/06-step3-done.png`.

14. Reply to the parent agent:
    ```
    Relay this to your child: Read tmp/read-exchange-test/note.txt again and report the full contents. Wait after reporting.

    Tell me the full contents the child reports.
    ```

15. Wait for completion. Save screenshot `$RUN_DIR/07-step4-done.png`.

16. Reply to the parent agent:
    ```
    Relay this to your child: Run a bash command listing the contents of tmp/read-exchange-test and report what files exist. Wait after reporting.

    Tell me what the child reports.
    ```

17. Wait for completion. Save screenshot `$RUN_DIR/08-step5-done.png`.

18. Reply to the parent agent:
    ```
    Last step: ask your child to delete the tmp/read-exchange-test directory and everything in it using bash. Confirm when done.
    ```

19. Wait for completion. Stop the recording. Save final screenshot `$RUN_DIR/09-final.png`.
    ```bash
    browser-use --session birdhouse-exchange-test record stop
    ```

## Pass criteria

All of the following must be true:

- A child agent appears in the sidebar nested under the parent after the first exchange
- The parent reports `beta` as the second line after step 2
- The parent confirms the file was updated in step 3
- The parent reports the full contents as `alpha`, `beta-updated`, `gamma` (three lines, correct values)
- The parent confirms the cleanup completed
- The video file exists and has a non-zero file size

## Fail criteria

Any of the following immediately indicates failure:

- No child agent appears in the sidebar
- The parent reports wrong content at any step
- The parent reports a tool call error that blocks progress
- The test did not complete within 12 minutes
- The recording failed or is missing

## Known limitations

- The parent agent may paraphrase the child's output. Evaluate correctness of content, not exact wording.
- Bash may fail in some sandbox environments due to WASM runtime issues. If the bash step (step 5) fails but all file operations succeeded, note it as a deviation — it does not fail the test.
- The cleanup step (step 6) may also fail due to bash issues. Note as deviation if so.
