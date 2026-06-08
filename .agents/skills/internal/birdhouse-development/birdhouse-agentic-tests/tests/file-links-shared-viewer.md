# File Links Shared Viewer

## Description

Verifies that local markdown file links in chat open the shared routed file viewer, including nested file links opened from rendered markdown inside the viewer itself.

## What this tests

- User chat bubbles render local file links as clickable viewer buttons
- Workspace-relative paths open files from the workspace root
- Absolute paths and `file://` links open the same file content
- File links inside rendered markdown open stacked file-viewer modals
- `#L42` line targets open raw mode at the requested line
- Non-viewable files show an error state with a visible `Reveal file in Finder` action
- Reloading a routed file-viewer URL restores the viewer from the modal stack

## Prerequisites

- sandbox1 running and fork-verified (see SKILL.md environment setup)
- Any free model available in the workspace model list

## Timeout

6 minutes from when Launch Agent is clicked.

## Model selection

First choice: **Big Pickle** (`opencode/big-pickle`). Second choice: any model with "free" in its name.

## Steps

1. Create a timestamped run directory and timestamped workspace paths for this run:
   ```bash
   TIMESTAMP="$(date +%Y-%m-%d-%H-%M-%S)"
   RUN_DIR="/tmp/file-links-shared-viewer-$TIMESTAMP"
   WORK_DIR="tmp/file-links-test-$TIMESTAMP"
   WORKSPACE_ROOT="$(sqlite3 sandboxes/sandbox1/data.db \"SELECT directory FROM workspaces LIMIT 1;\")"
   ABS_NOTES_PATH="$WORKSPACE_ROOT/$WORK_DIR/docs/absolute.md"
   mkdir -p "$RUN_DIR/screenshots"
   echo "Run artifacts: $RUN_DIR"
   ```

2. Seed the sandbox workspace with the files the UI flow will open:
   ```bash
   mkdir -p "$WORKSPACE_ROOT/$WORK_DIR/docs" "$WORKSPACE_ROOT/$WORK_DIR/src" "$WORKSPACE_ROOT/$WORK_DIR/artifacts"
   printf '# Nested notes\n\nThis file links deeper.\n\n[absolute notes](%s)\n' "$ABS_NOTES_PATH" > "$WORKSPACE_ROOT/$WORK_DIR/docs/nested.md"
   printf '# Absolute notes\n\nOpened from an absolute link.\n' > "$WORKSPACE_ROOT/$WORK_DIR/docs/absolute.md"
   {
     for i in $(seq 1 41); do printf '// line %s\n' "$i"; done
     printf 'const targetLine = 42;\n'
     for i in $(seq 43 50); do printf '// line %s\n' "$i"; done
   } > "$WORKSPACE_ROOT/$WORK_DIR/src/example.ts"
   printf '\0binary\n' > "$WORKSPACE_ROOT/$WORK_DIR/artifacts/blob.bin"
   ```

3. Close any existing session, open the sandbox agents page, and start recording immediately in a named session:
   ```bash
   browser-use --session birdhouse-file-links-test close 2>/dev/null || true
   browser-use --session birdhouse-file-links-test open \
     "http://127.0.0.1:50200/#/workspace/<id>/agents"
   browser-use --session birdhouse-file-links-test python \
     "browser._run(browser._session._cdp_set_viewport(1280, 720))"
   browser-use --session birdhouse-file-links-test record start \
     "$RUN_DIR/file-links-recording.mp4"
   ```

4. Save screenshot `$RUN_DIR/screenshots/01-agents-page.png`.

5. Click **New Agent**.

6. Select **Big Pickle** using the same combobox-opening approach as the fib test. If Big Pickle is not available, select the first visible free model.

7. Type this exact launch prompt into the textarea and launch the agent:
   ```
   Reply with only: ready
   ```

8. Wait for completion. Completion signals:
   - Stop button switches back to Send
   - the agent row/header lose their gradient running state

9. Save screenshot `$RUN_DIR/screenshots/02-agent-ready.png`.

10. Send this follow-up user message as a plain markdown chat bubble. Substitute `$WORK_DIR` and `$ABS_NOTES_PATH` before sending:
    ```
    Validation bubble: [relative]($WORK_DIR/docs/nested.md) [absolute]($ABS_NOTES_PATH) [file-url](file://$ABS_NOTES_PATH) [line]($WORK_DIR/src/example.ts#L42) [binary]($WORK_DIR/artifacts/blob.bin)
    ```

11. Save screenshot `$RUN_DIR/screenshots/03-chat-bubble-sent.png` showing the rendered user message bubble with the file-link buttons.

12. Click **relative** in the user bubble.

13. Save screenshot `$RUN_DIR/screenshots/04-relative-opened.png`.

14. In the `nested.md` viewer, click **absolute notes**.

15. Save screenshot `$RUN_DIR/screenshots/05-stacked-modal-open.png` showing the stacked viewer state.

16. Close only the top viewer and confirm the `nested.md` viewer remains open underneath.

17. Close the remaining nested viewer and return to the chat bubble.

18. Click **file-url** in the user bubble.

19. Save screenshot `$RUN_DIR/screenshots/06-file-url-opened.png`.

20. Close that viewer.

21. Click **line** in the user bubble.

22. Save screenshot `$RUN_DIR/screenshots/07-line-opened.png` showing raw code view with line `42` visible.

23. Close that viewer.

24. Click **binary** in the user bubble.

25. Save screenshot `$RUN_DIR/screenshots/08-binary-error-opened.png` showing the error state and the `Reveal file in Finder` button.

26. Click **Reveal file in Finder**.

27. Save screenshot `$RUN_DIR/screenshots/09-after-reveal-click.png` and verify there is no browser-visible reveal failure message.

28. Refresh the page while the binary file-viewer modal is still open.

29. Save screenshot `$RUN_DIR/screenshots/10-after-reload.png` showing the binary file-viewer modal restored from the URL.

30. Stop the recording:
    ```bash
    browser-use --session birdhouse-file-links-test record stop
    ```

31. Report the run directory path:
    ```
    Artifacts saved to: $RUN_DIR
    ```

## Pass criteria

All of the following must be true:

- The user chat bubble shows clickable buttons for the local file links
- Clicking `relative` opens a file-viewer dialog labeled `nested.md`
- Clicking `absolute notes` from `nested.md` opens a second file-viewer modal while the first remains underneath
- Clicking `file-url` opens the same `absolute.md` content as the absolute path link
- Clicking `line` opens `example.ts` in raw view with line `42` visible
- Clicking `binary` opens an error-state file viewer with a visible `Reveal file in Finder` button
- After clicking `Reveal file in Finder`, no browser-visible reveal failure message appears
- Reloading the page while the binary viewer is open restores that viewer from the routed modal URL
- The video file exists and has a non-zero file size

## Fail criteria

Any of the following immediately indicates failure:

- The user chat bubble renders any of the file links as plain text instead of clickable link/button UI
- Clicking `relative` does not open `nested.md`
- Clicking the nested `absolute notes` link does not create a second stacked viewer modal
- Clicking `file-url` does not open the expected file content
- Clicking `line` does not show the requested source file and line target
- Clicking `binary` does not show an error-state viewer
- Clicking `Reveal file in Finder` shows a browser-visible reveal failure message
- Reloading the page drops the binary viewer instead of restoring it
- The test did not complete within 6 minutes
- The recording failed to start or the video file is missing or zero bytes

## Known limitations

- `Reveal file in Finder` is only browser-observable indirectly. Treat the absence of a browser-visible failure message as success; Finder itself is outside browser visibility.
- After modal open/close actions, browser element indexes may change. Re-run `state` as needed rather than reusing stale indexes.
