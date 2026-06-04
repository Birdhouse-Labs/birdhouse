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

Search the model picker for "free". Use `opencode/big-pickle` if available, otherwise any model whose name contains "free".

## Steps

1. Set the browser viewport to 1080p before opening any page:
   ```bash
   browser-use --session birdhouse-fib-test close 2>/dev/null || true
   ```
   Then open with explicit viewport (browser-use defaults to a large size — check `browser-use --help` or `browser-use config` for viewport options; if not available, proceed and note the deviation):
   ```bash
   browser-use --session birdhouse-fib-test open \
     "http://127.0.0.1:50200/#/workspace/<id>/agents"
   ```

2. Save screenshot to file (do NOT use screenshot without a path — that returns base64 into context):
   ```bash
   browser-use --session birdhouse-fib-test screenshot \
     "sandboxes/sandbox1/screenshots/01-agents-page.png"
   ```

3. Click **New Agent**.

4. Select a free model from the model picker (search "free", choose `opencode/big-pickle` or first available free model).

5. In the message input, type exactly:
   ```
   Please run this fibonacci test for me: [fibonacci-recursive-agents](birdhouse:skill/fibonacci-recursive-agents)

   Compute fib(4) using the skill instructions. Use child agents as the skill instructs. Report the final answer.
   ```

   > Note: When typing "fibonacci" the skill trigger phrase should appear as an autocomplete suggestion. Select it if it appears — this also validates the trigger phrase system. If it does not appear, type the full text manually.

6. Save screenshot before sending:
   ```bash
   browser-use --session birdhouse-fib-test screenshot \
     "sandboxes/sandbox1/screenshots/02-message-composed.png"
   ```

7. Send the message. Note the time sent.

8. Start video recording immediately after sending:
   ```bash
   browser-use --session birdhouse-fib-test record start \
     "sandboxes/sandbox1/screenshots/fib-$(date +%s).mp4"
   ```

9. **Waiting for completion.** The root agent is done when its entry in the sidebar no longer has a purple/active border and the message panel shows a final answer with no active tool calls running.

   **Important — do not mistake the Birdhouse brand icon for a spinner.** The circular icon shown to the left of each agent name in the sidebar is the static Birdhouse logo. It does not rotate or animate. The only sign of an active/running agent is a pulsing purple left border on the agent row, or a tool call showing `running` status in the main panel.

   Poll every 30 seconds by running:
   ```bash
   browser-use --session birdhouse-fib-test eval \
     "(() => { const active = document.querySelector('[data-active-agent]') || document.querySelector('.border-l-2'); return active ? 'still-running' : 'done'; })()"
   ```
   If the eval is inconclusive, use `browser-use state` to read visible text and check whether the agent panel shows a final message or an active tool call.

10. Once the root agent is done, save screenshot:
    ```bash
    browser-use --session birdhouse-fib-test screenshot \
      "sandboxes/sandbox1/screenshots/03-agents-building.png"
    ```

11. Stop the recording:
    ```bash
    browser-use --session birdhouse-fib-test record stop
    ```

12. **Count the agents in the current run's subtree.** Do NOT use the "Today N Agents" group label — that accumulates across all test runs on the same day.

    Instead, count the tree items nested under the top-level invoker agent for this run. Click the invoker agent row to expand it if needed, then use:
    ```bash
    browser-use --session birdhouse-fib-test eval \
      "document.querySelectorAll('[role=treeitem]').length"
    ```
    This counts all tree rows currently visible in the sidebar. If multiple test runs are expanded, collapse older ones first by clicking their top-level rows.

    As a reliable fallback: use `browser-use state` to list all visible tree items, then count only those belonging to the current run (identifiable by their timestamp matching the run start time).

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

- The `[role=treeitem]` eval counts all visible rows. If older runs are expanded in the sidebar, collapse them before counting, or count manually from the screenshot.
- The skill trigger phrase autocomplete depends on the sandbox having the skill indexed. If it does not appear, this is noted as a deviation but does not cause the test to fail — the test proceeds with manual text entry.
- If browser-use does not support explicit viewport sizing, screenshots will be at the browser's default resolution. Note this as a deviation.
