# Fibonacci Recursive Agents

## Description

Verifies that Birdhouse agents can spawn recursive child agents and that skill references work end-to-end. A browser agent sends a message containing a skill reference link, and the spawned Birdhouse agent loads that skill and runs the computation recursively.

## What this tests

- Skill link resolution: the spawned agent can load a skill referenced via `birdhouse:skill/` link
- Recursive agent spawning: agents correctly delegate to child agents
- Agent tree integrity: the correct number of agents are created in the correct hierarchy
- Result correctness: the final answer is mathematically correct

## Prerequisites

- sandbox1 running and fork-verified (see SKILL.md environment setup)
- Any free model available in the workspace model list

## Timeout

10 minutes from the time Launch Agent is clicked.

## Model selection

First choice: **Big Pickle** (`opencode/big-pickle`). Second choice: any model with "free" in its name.

## Steps

1. Create a timestamped run directory in `tmp/` and set it as the artifact destination for this run:
   ```bash
   RUN_DIR="/tmp/fib-test-$(date +%Y-%m-%d-%H-%M-%S)"
   mkdir -p "$RUN_DIR"
   echo "Run artifacts: $RUN_DIR"
   ```
   Use `$RUN_DIR` for all screenshots and the video throughout this test.

2. Close any existing session and open the agents page:
   ```bash
   browser-use --session birdhouse-fib-test close 2>/dev/null || true
   browser-use --session birdhouse-fib-test open \
     "http://127.0.0.1:50200/#/workspace/<id>/agents"
   ```

3. **Start recording immediately** — before any interaction:
   ```bash
   browser-use --session birdhouse-fib-test record start "$RUN_DIR/fib-recording.mp4"
   ```

4. Save screenshot:
   ```bash
   browser-use --session birdhouse-fib-test screenshot "$RUN_DIR/01-agents-page.png"
   ```

5. Click **New Agent** to open the launch panel.

6. **Select a model.** The model picker combobox requires a JS-triggered input event to open — a direct click alone may not populate the list. Clear the input and fire an input event to reveal all models, then scroll to find and click **Big Pickle**:
   ```bash
   browser-use --session birdhouse-fib-test eval \
     "(() => { const el = document.querySelector('input[role=combobox]') || document.querySelector('[data-model-picker] input'); if (!el) return 'not found'; el.value = ''; el.dispatchEvent(new Event('input', {bubbles:true})); return 'opened'; })()"
   ```
   Then inspect the visible options and select **Big Pickle** by its visible label. If Big Pickle is not visible, type `free` into the model picker and select the first visible result.

   Verify the selection with eval — the `state` output will still show placeholder text even after a successful selection:
   ```bash
   browser-use --session birdhouse-fib-test eval \
     "document.querySelector('input[role=combobox]').value"
   ```
   This should return `Big Pickle`.

7. Type the following message into the textarea on the launch panel (before clicking Launch Agent).

   Use `browser-use input <index> "text"` — not `browser-use type` — because this is a React-controlled textarea and bulk type may silently garble or truncate the input. Embed the blank line between paragraphs as `\n\n` in the string. Do not use Shift+Enter to insert newlines — it submits the form.

   Message text:
   ```
   Please run this fibonacci test for me: [fibonacci-recursive-agents](birdhouse:skill/fibonacci-recursive-agents)\n\nCompute fib(4) using the skill instructions. Use child agents as the skill instructs. Report the final answer.
   ```

8. Save screenshot before launching:
   ```bash
   browser-use --session birdhouse-fib-test screenshot "$RUN_DIR/02-message-composed.png"
   ```

9. Click **Launch Agent**.

10. **Wait for completion.** Use `browser-use state` as the primary polling method — read the visible text to check whether the invoker agent's message panel shows a final answer with no active tool calls. Poll every 30 seconds.

    Two reliable visual signals that the run is complete:

    1. The message panel switches from a **Stop** button to a **Send** button.
    2. The agent's row in the sidebar and its header lose their **gradient color** — running agents show a purple/pink gradient; completed agents show plain/muted colors.

    The Birdhouse brand icon next to each row is a static logo — it does not animate regardless of run state. Do not rely on DOM selectors like `[data-active-agent]` or `.border-l-2` — these do not reliably reflect run state.

11. Once done, save screenshot:
    ```bash
    browser-use --session birdhouse-fib-test screenshot "$RUN_DIR/03-agents-building.png"
    ```

12. Stop the recording:
    ```bash
    browser-use --session birdhouse-fib-test record stop
    ```

13. **Count the agents in the current run's tree using the screenshot.**

    Save a screenshot of the sidebar showing the current run's expanded tree, then count the rows visually. The current run is the top entry in the sidebar — it has the most recent timestamp. Count every row under the invoker (including the invoker itself). Do not count rows from earlier runs.

    Note: all agents in the sidebar display at `level=1` in the DOM regardless of logical nesting depth — the hierarchy is visual only. Count by timestamp group, not by DOM level.

    The expected tree for fib(4) has exactly 10 agents:
    ```
    invoker                   (1)
    fib(4)                    (1)
    fib(3)                    (1)
      fib(2)                  (1)
        fib(1)                (1)
        fib(0)                (1)
      fib(1)                  (1)
    fib(2)                    (1)
      fib(1)                  (1)
      fib(0)                  (1)
    ```
    Total: 10 agents.

14. Read the root agent's final message from the main panel. It should state the answer.

15. Save final screenshot:
    ```bash
    browser-use --session birdhouse-fib-test screenshot "$RUN_DIR/04-tree-complete.png"
    ```

16. **Report the run directory path** so the user can open it directly:
    ```
    Artifacts saved to: $RUN_DIR
    ```

## Pass criteria

All of the following must be true:

- The root fib(4) agent's final message contains the text `fib(4) = 3`
- The current run's agent tree contains exactly **10 agents**: 1 invoker + 1 fib(4) root + 8 recursive children
- No agent in the current run's tree shows an error state or red indicator
- The video file `$RUN_DIR/fib-recording.mp4` exists and has a non-zero file size

## Fail criteria

Any of the following immediately indicates failure:

- The root agent's final message states any answer other than 3
- The agent count for this run is not 10 (too few means some agents didn't spawn; too many means the recursion went wrong)
- Any agent in this run's tree shows an error state or red indicator
- The root agent did not complete within the 10-minute timeout
- The recording failed to start or the video file is missing or zero bytes

## Known limitations

- **Model picker:** The combobox may not respond to direct click — use the JS input event approach in step 6 to open the full list reliably.
- **Completion detection:** Do not use CSS selector polling for run state — use `browser-use state` text output instead.
- **Viewport:** Screenshot dimensions depend on the browser automation tool. Ensure screenshots capture the relevant page state clearly.
