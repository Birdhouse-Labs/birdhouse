# Skill Trigger Phrase Autocomplete

## Description

Verifies that the skill trigger phrase system surfaces suggestions in the new agent launch panel when a user types a matching prefix.

## What this tests

- Skill trigger phrases are indexed and searchable in the sandbox
- The autocomplete dropdown appears on the launch panel when a trigger prefix is typed character by character
- The correct skill name and trigger phrase appear in the suggestion

## Prerequisites

- sandbox1 running (Birdhouse at http://127.0.0.1:50200)
- No fork verification required — this test is Birdhouse-only, does not involve OpenCode

## Timeout

2 minutes.

## Steps

1. Create a timestamped run directory and set it as the artifact destination:
   ```bash
   RUN_DIR="/tmp/autocomplete-test-$(date +%Y-%m-%d-%H-%M-%S)"
   mkdir -p "$RUN_DIR"
   echo "Run artifacts: $RUN_DIR"
   ```

2. Close any existing browser session for this test, then open the agents page in a persistent browser context:
   `http://127.0.0.1:50200/#/workspace/<id>/agents`

3. Click **New Agent** to open the launch panel.

4. Click into the message textarea so it is focused and empty.

5. **Type the trigger prefix one character at a time.** The autocomplete listener requires individual key events — bulk text insertion will not trigger it. Send `f`, `i`, `b` as three separate key-press events.

6. After typing `fib`, inspect the visible page state and confirm whether an autocomplete dropdown suggestion appears containing `fibonacci-recursive-agents`.

7. Save a screenshot to `$RUN_DIR/autocomplete-suggestion.png`.

8. If the suggestion is visible, click it and confirm the skill reference link `[fibonacci-recursive-agents](birdhouse:skill/fibonacci-recursive-agents)` was inserted into the textarea.

9. **Report the run directory path** so the user can open it:
   ```
   Artifacts saved to: $RUN_DIR
   ```

## Pass criteria

- After typing `fib` character by character, a dropdown suggestion for `fibonacci-recursive-agents` is visible
- The suggestion includes the trigger phrase text (e.g. "fibonacci test" or "fibonacci recursive")
- Clicking the suggestion inserts a skill reference link into the textarea with the `birdhouse:skill/fibonacci-recursive-agents` URL (the display label may be the trigger phrase, e.g. `[fibonacci test](birdhouse:skill/fibonacci-recursive-agents)`)

## Fail criteria

- No autocomplete suggestion appears after typing `fib` one character at a time
- The suggestion appears but clicking it does not insert a `birdhouse:skill/fibonacci-recursive-agents` URL into the textarea
- The test did not complete within 2 minutes

## Known limitations

- This test must use character-by-character key events because it validates the key-event autocomplete path. Bulk text insertion may bypass the behavior under test.
- If the skill index has not been refreshed since the sandbox was started, trigger phrases may not be present. Restart sandbox1 if this test fails unexpectedly after a skill update.
