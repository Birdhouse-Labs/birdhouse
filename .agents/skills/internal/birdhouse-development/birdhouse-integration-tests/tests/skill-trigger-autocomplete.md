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

3. **Start recording immediately** before any interaction. Save to `$RUN_DIR/autocomplete-recording.mp4`.

4. If the launch panel is not already visible on the right side of the screen, click **New Agent** in the sidebar. If the panel is already showing, skip this step.

5. Run `state` to find the message textarea index. Click into it to focus it. If there is any existing text, clear it before proceeding.

6. **Type the trigger prefix one character at a time.** The autocomplete listener requires individual key events — bulk text insertion will not trigger it. Send `f`, `i`, `b` as three separate key-press events.

7. After typing `fib`, inspect the visible page state. In the state output, look for `div role=option` elements containing `fibonacci-recursive-agents` — that is how autocomplete suggestions appear. Confirm whether such an element is present.

8. Save a screenshot to `$RUN_DIR/autocomplete-suggestion.png`.

9. If the suggestion is visible, click it and confirm the skill reference link with a `birdhouse:skill/fibonacci-recursive-agents` URL was inserted into the textarea.

10. Save a screenshot to `$RUN_DIR/after-click.png`.

11. Stop the recording.

12. **Report the run directory path** so the user can open it:
    ```
    Artifacts saved to: $RUN_DIR
    ```

## Pass criteria

- After typing `fib` character by character, a dropdown suggestion for `fibonacci-recursive-agents` is visible
- The suggestion includes the trigger phrase text (e.g. "fibonacci test" or "fibonacci recursive")
- Clicking the suggestion inserts a skill reference link into the textarea with the `birdhouse:skill/fibonacci-recursive-agents` URL (the display label may be the trigger phrase, e.g. `[fibonacci test](birdhouse:skill/fibonacci-recursive-agents)`)
- The video file exists and has a non-zero file size

## Fail criteria

- No autocomplete suggestion appears after typing `fib` one character at a time
- The suggestion appears but clicking it does not insert a `birdhouse:skill/fibonacci-recursive-agents` URL into the textarea
- The test did not complete within 2 minutes
- The recording failed to start or the video file is missing or zero bytes

## Known limitations

- This test must use character-by-character key events because it validates the key-event autocomplete path. Bulk text insertion may bypass the behavior under test.
- If the skill index has not been refreshed since the sandbox was started, trigger phrases may not be present. Restart sandbox1 if this test fails unexpectedly after a skill update.
