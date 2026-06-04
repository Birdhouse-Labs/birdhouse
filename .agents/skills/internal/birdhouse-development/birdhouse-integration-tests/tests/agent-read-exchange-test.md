# Agent Read Exchange

## Description

Verifies that Birdhouse agents can create child agents, exchange messages with them across multiple turns, and use file and bash tools correctly. The test is driven entirely through the browser UI — a Birdhouse agent is sent a series of messages asking it to orchestrate a worker child through a sequence of file and bash operations.

## What this tests

- A Birdhouse agent can create a child agent via the UI on request
- The parent agent can reply to its child agent across multiple turns
- File edit tools and bash work correctly inside the child agent
- The parent agent can read and report back on the child's results
- The agent tree in the sidebar updates correctly as child agents are created

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

2. Close any existing session and open the agents page:
   ```bash
   browser-use --session birdhouse-exchange-test close 2>/dev/null || true
   browser-use --session birdhouse-exchange-test open \
     "http://127.0.0.1:50200/#/workspace/<id>/agents"
   ```

3. **Start recording immediately:**
   ```bash
   browser-use --session birdhouse-exchange-test record start \
     "$RUN_DIR/exchange-recording.mp4"
   ```

4. Save screenshot `$RUN_DIR/01-agents-page.png`.

5. Click **New Agent**, select **Big Pickle** (or first free model), and type this message:

   ```
   I need you to create a child agent to do some file work for me. Create a child agent with this exact prompt:

   You are a careful tool worker. Complete only the specific step you are asked to do. Use tools when needed. After each step, report the result clearly and wait for the next instruction. Do not anticipate future steps.

   Once the child agent responds, tell me its agent ID and wait for my next instruction.
   ```

6. **Launch Agent.** Save screenshot `$RUN_DIR/02-message-sent.png`.

7. Wait for the parent agent to complete its first response. Watch for a child agent to appear in the sidebar. Completion signal: Stop→Send transition and gradient fades on the parent agent row.

8. Save screenshot `$RUN_DIR/03-child-created.png` showing the child agent in the sidebar.

9. Reply to the parent agent:
   ```
   Good. Now reply to your child agent and ask it to:

   Create the directory tmp/read-exchange-test if it doesn't exist, then create tmp/read-exchange-test/note.txt with exactly these three lines:
   alpha
   beta
   gamma

   Use file-editing tools (not bash) for the file contents. Tell the child to report what it created and wait.

   Wait for the child to finish, then tell me what it reported.
   ```

10. Wait for the parent agent to complete. Save screenshot `$RUN_DIR/04-step1-done.png`.

11. Reply to the parent agent:
    ```
    Now reply to your child agent and ask it to read tmp/read-exchange-test/note.txt and report the second line only. Wait for the child to respond, then tell me what the second line was.
    ```

12. Wait for completion. Save screenshot `$RUN_DIR/05-step2-done.png`.

13. Reply to the parent agent:
    ```
    Now reply to your child agent and ask it to update tmp/read-exchange-test/note.txt so the second line becomes "beta-updated". Use a file-editing tool. Wait for the child to confirm, then tell me the change was made.
    ```

14. Wait for completion. Save screenshot `$RUN_DIR/06-step3-done.png`.

15. Reply to the parent agent:
    ```
    Now reply to your child agent and ask it to run a bash command listing the contents of tmp/read-exchange-test, then read tmp/read-exchange-test/note.txt and report the full contents. Wait for the child to respond and tell me both: what files exist and what the full file contents are.
    ```

16. Wait for completion. Save screenshot `$RUN_DIR/07-step4-done.png`.

17. Reply to the parent agent:
    ```
    Did all the tool calls in this session work correctly? What were the final contents of tmp/read-exchange-test/note.txt? And did your child agent complete all steps successfully?
    ```

18. Wait for the parent's final response. Save screenshot `$RUN_DIR/08-final-report.png`.

19. **Stop recording:**
    ```bash
    browser-use --session birdhouse-exchange-test record stop
    ```

20. **Clean up** the test directory via the parent agent — reply:
    ```
    Please ask your child agent to delete the tmp/read-exchange-test directory and everything inside it using bash.
    ```
    Wait for confirmation.

## Pass criteria

All of the following must be true:

- A child agent appears in the sidebar after the first message (visible as a nested entry under the parent)
- The parent agent correctly reports `beta` as the second line after step 2
- The parent agent confirms the file was updated in step 3
- The parent agent's final response confirms the final contents of `note.txt` are:
  ```
  alpha
  beta-updated
  gamma
  ```
- The parent agent confirms all tool calls succeeded
- The video file exists and has a non-zero file size

## Fail criteria

Any of the following immediately indicates failure:

- No child agent appears in the sidebar
- The parent reports wrong content at any step (wrong second line, wrong final contents)
- The parent reports a tool call error at any step
- The parent cannot relay instructions to the child (messaging fails)
- The test did not complete within 12 minutes
- The recording failed or is missing

## Known limitations

- The parent agent may paraphrase the child's output rather than quoting it verbatim. A natural-language summary is acceptable as long as the content is correct.
- The parent agent may create its child using a different model than itself. This is acceptable.
- Directory creation via bash inside the child is acceptable even if the test asks for file-editing tools — the constraint is on the file contents only.
