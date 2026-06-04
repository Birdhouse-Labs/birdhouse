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

1. Navigate to the workspace agents page:
   `http://127.0.0.1:50200/#/workspace/<id>/agents`

2. Take screenshot `01-agents-page.png` once the page has loaded.

3. Click **New Agent**.

4. Select a free model from the model picker (search "free", choose `opencode/big-pickle` or first available free model).

5. In the message input, type exactly:
   ```
   Please run this fibonacci test for me: [fibonacci-recursive-agents](birdhouse:skill/fibonacci-recursive-agents)
   
   Compute fib(4) using the skill instructions. Use child agents as the skill instructs. Report the final answer.
   ```

   > Note: When typing "fibonacci" the skill trigger phrase should appear as an autocomplete suggestion. Select it if it appears — this also validates the trigger phrase system. If it does not appear, type the full text manually.

6. Take screenshot `02-message-composed.png` before sending.

7. Send the message.

8. Start video recording immediately after sending:
   ```bash
   browser-use --session birdhouse-test record start \
     "sandboxes/sandbox1/screenshots/fib-<timestamp>.mp4"
   ```

9. Wait for the root agent to show a completed state in the UI. Poll by checking the agent list in the left sidebar. Take screenshot `03-agents-building.png` when child agents are visible.

10. Once the root agent shows completed, take screenshot `04-tree-complete.png` showing the full agent tree in the sidebar.

11. Stop the recording:
    ```bash
    browser-use --session birdhouse-test record stop
    ```

12. Use browser eval to count the agents visible in the left sidebar:
    ```bash
    browser-use --session birdhouse-test eval \
      "document.querySelectorAll('[data-agent-id]').length"
    ```
    If `data-agent-id` does not exist as an attribute, try counting list items in the agents sidebar by inspecting the DOM with `browser-use state` first to find the right selector.

13. Read the root agent's final message from the UI. It should state the answer.

14. Take screenshot `05-root-answer.png` showing the root agent's final message.

## Pass criteria

All of the following must be true:

- The root agent's final message contains the text `fib(4) = 3`
- The agent sidebar shows exactly 9 agents (1 root + 8 recursive children)
- All agents in the sidebar show a completed or stopped state (no spinning indicators, no error badges)
- The video file exists and has a non-zero size

## Fail criteria

Any of the following immediately indicates failure:

- The root agent's final message states any answer other than 3
- The agent count is not 9 (too few means some agents didn't spawn; too many means the recursion went wrong)
- Any agent shows an error state or red indicator
- The root agent did not complete within the 10-minute timeout
- The recording failed to start or the video file is missing

## Known limitations

- Agent count via DOM eval may be approximate if the sidebar uses virtualization. If the count is uncertain, use the screenshot to manually count visible agents and note the uncertainty in the report.
- The skill trigger phrase autocomplete depends on the sandbox having the skill indexed. If it does not appear, this is noted as a deviation but does not cause the test to fail — the test proceeds with manual text entry.
