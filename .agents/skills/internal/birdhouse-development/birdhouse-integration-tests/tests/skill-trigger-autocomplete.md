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

2. Open the agents page:
   ```bash
   browser-use --session birdhouse-autocomplete-test close 2>/dev/null || true
   browser-use --session birdhouse-autocomplete-test open \
     "http://127.0.0.1:50200/#/workspace/<id>/agents"
   ```

2. Click **New Agent** to open the launch panel.

3. Click into the message textarea so it is focused and empty.

4. **Type the trigger prefix one character at a time.** The autocomplete listener requires individual key events — bulk type commands will not trigger it. Type: `f`, `i`, `b` (three characters is sufficient).

   Using browser-use: send each character as a separate `keys` command:
   ```bash
   browser-use --session birdhouse-autocomplete-test keys "f"
   browser-use --session birdhouse-autocomplete-test keys "i"
   browser-use --session birdhouse-autocomplete-test keys "b"
   ```

   Using any other browser automation skill: send each character as an individual key-press event, not as a bulk string.

6. After typing "fib", check whether a dropdown suggestion appeared. Use `browser-use state` to read the visible elements and look for a suggestion containing "fibonacci-recursive-agents".

7. Save screenshot:
   ```bash
   browser-use --session birdhouse-autocomplete-test screenshot "$RUN_DIR/autocomplete-suggestion.png"
   ```

8. If the suggestion is visible, click it and confirm the skill reference link was inserted into the textarea.

9. **Report the run directory path** so the user can open it:
   ```
   Artifacts saved to: $RUN_DIR
   ```

## Pass criteria

- After typing "fib" character by character, a dropdown suggestion for `fibonacci-recursive-agents` is visible on the page
- The suggestion includes the trigger phrase text (e.g. "fibonacci test" or "fibonacci recursive")
- Clicking the suggestion inserts a `[fibonacci-recursive-agents](birdhouse:skill/fibonacci-recursive-agents)` link into the textarea

## Fail criteria

- No autocomplete suggestion appears after typing "fib" one character at a time
- The suggestion appears but clicking it does not insert the skill reference link
- The test did not complete within 2 minutes

## Known limitations

- This test must use character-by-character key events. Any bulk type command will prevent autocomplete from firing.
- If the skill index has not been refreshed since the sandbox was started, trigger phrases may not be present. Restart sandbox1 if this test fails unexpectedly after a skill update.
