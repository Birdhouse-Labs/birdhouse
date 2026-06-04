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

10 minutes from the time the message is sent.

## Model selection

First choice: **Big Pickle** (`opencode/big-pickle`). Second choice: any model with "free" in its name.

## Steps

1. Close any existing session and open the agents page:
   ```bash
   browser-use --session birdhouse-fib-test close 2>/dev/null || true
   browser-use --session birdhouse-fib-test open \
     "http://127.0.0.1:50200/#/workspace/<id>/agents"
   ```

2. Save screenshot to file (do NOT use screenshot without a path — that returns base64 into context):
   ```bash
   browser-use --session birdhouse-fib-test screenshot \
     "sandboxes/sandbox1/screenshots/01-agents-page.png"
   ```

3. Click **New Agent** to open the launch panel.

4. **Select a model.** The model picker combobox requires a JS-triggered input event to open — a direct click alone may not populate the list. Clear the input and fire an input event to reveal all models, then scroll to find and click **Big Pickle**:
   ```bash
   browser-use --session birdhouse-fib-test eval \
     "(() => { const el = document.querySelector('input[role=combobox]') || document.querySelector('[data-model-picker] input'); if (!el) return 'not found'; el.value = ''; el.dispatchEvent(new Event('input', {bubbles:true})); return 'opened'; })()"
   ```
   Then use `browser-use state` to find the Big Pickle option index and click it. If Big Pickle is not visible, type "free" in the input and select the first result.

5. Type the message text into the textarea on the launch panel. The message must be entered before clicking Launch Agent — the skill trigger phrase autocomplete lives on the launch panel, not in the conversation panel after launch.

   Use a bulk type command to enter the full message. Autocomplete will not fire (bulk typing bypasses the key-event listener entirely — even typing character-by-character afterward does not revive it once bulk text has been deposited). This is expected. The autocomplete feature is tested by a separate dedicated test.

   Full message text:
   ```
   Please run this fibonacci test for me: [fibonacci-recursive-agents](birdhouse:skill/fibonacci-recursive-agents)

   Compute fib(4) using the skill instructions. Use child agents as the skill instructs. Report the final answer.
   ```
   Please run this fibonacci test for me: [fibonacci-recursive-agents](birdhouse:skill/fibonacci-recursive-agents)

   Compute fib(4) using the skill instructions. Use child agents as the skill instructs. Report the final answer.
   ```

6. Save screenshot before launching:
   ```bash
   browser-use --session birdhouse-fib-test screenshot \
     "sandboxes/sandbox1/screenshots/02-message-composed.png"
   ```

7. Click **Launch Agent**. Note the time.

8. Start video recording immediately after launching:
   ```bash
   browser-use --session birdhouse-fib-test record start \
     "sandboxes/sandbox1/screenshots/fib-$(date +%s).mp4"
   ```

9. **Wait for completion.** Use `browser-use state` as the primary polling method — read the visible text to check whether the invoker agent's message panel shows a final answer with no active tool calls. Poll every 30 seconds.

   **Important — do not mistake the Birdhouse brand icon for a spinner.** The circular icon shown next to each agent in the sidebar is the static Birdhouse logo. It does not animate. The only sign of a running agent is a pulsing purple left border on the agent row or a tool call showing `running` status in the main panel. When `browser-use state` shows the final message text `fib(4) = 3` in the panel with no `running` tool calls, the run is complete.

   Do not rely on DOM selectors like `[data-active-agent]` or `.border-l-2` — these do not reliably reflect run state.

10. Once done, save screenshot:
    ```bash
    browser-use --session birdhouse-fib-test screenshot \
      "sandboxes/sandbox1/screenshots/03-agents-building.png"
    ```

11. Stop the recording:
    ```bash
    browser-use --session birdhouse-fib-test record stop
    ```

12. **Count the agents in the current run's tree using the screenshot.**

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

13. Read the root agent's final message from the main panel. It should state the answer.

14. Save final screenshot:
    ```bash
    browser-use --session birdhouse-fib-test screenshot \
      "sandboxes/sandbox1/screenshots/04-tree-complete.png"
    ```

## Pass criteria

All of the following must be true:

- The root fib(4) agent's final message contains the text `fib(4) = 3`
- The current run's agent tree contains exactly **10 agents**: 1 invoker + 1 fib(4) root + 8 recursive children
- No agent in the current run's tree shows an error state or red indicator
- The video file exists and has a non-zero file size

## Fail criteria

Any of the following immediately indicates failure:

- The root agent's final message states any answer other than 3
- The agent count for this run is not 10 (too few means some agents didn't spawn; too many means the recursion went wrong)
- Any agent in this run's tree shows an error state or red indicator
- The root agent did not complete within the 10-minute timeout
- The recording failed to start or the video file is missing or zero bytes

## Known limitations

- **Model picker:** The combobox may not respond to direct click — use the JS input event approach in step 4 to open the full list reliably.
- **Autocomplete:** The autocomplete listener requires every character to arrive as a key event. Any bulk type operation poisons the listener state permanently for that field — subsequent character-by-character input does not revive it. This test uses bulk typing and therefore never triggers autocomplete. Skill trigger phrase autocomplete is validated by a separate dedicated test.
- **Completion detection:** Do not use CSS selector polling for run state — use `browser-use state` text output instead.
- **Viewport:** browser-use does not support explicit viewport sizing. Screenshots will be at the browser default resolution.
