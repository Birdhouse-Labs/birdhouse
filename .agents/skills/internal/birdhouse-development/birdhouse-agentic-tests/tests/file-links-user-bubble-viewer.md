# User Bubble File Links Viewer

## Description

Verifies that local markdown file links rendered inside a user chat bubble open Birdhouse's shared routed file viewer and keep working across nested viewers, line targets, non-viewable files, and page reloads.

## What this tests

- Workspace-relative local file links in a user message bubble open the shared file viewer
- Absolute local file links in a user message bubble open the shared file viewer
- `file://` local file links in a user message bubble open the shared file viewer
- Markdown file links clicked inside the rich viewer open additional stacked file-viewer modals
- `#L42` line targets open the requested markdown file in raw mode with line 42 visible
- Non-viewable local files stay open in an error state and still offer **Reveal file in Finder**
- Reloading the page while stacked viewers are open restores them from the routed modal URL

## Prerequisites

- Environment selection, sandbox ownership checks, workspace resolution, and recording setup are owned by the top-level skill runner
- Any free model available, because the test asks a sandbox agent to create markdown fixtures inside the workspace before the user bubble links are clicked

## Timeout

8 minutes from the time the setup message is sent.

## Model selection

First choice Big Pickle, second choice any model with "free" in its name.

## Steps

1. Create a timestamped run directory and define the fixture paths used throughout the test:
   ```bash
   RUN_DIR="<run-dir>"
   FIXTURE_ROOT="tmp/file-links-viewer-agentic"
   ROOT_MD="$FIXTURE_ROOT/root.md"
   SECOND_MD="$FIXTURE_ROOT/nested/second.md"
   THIRD_MD="$FIXTURE_ROOT/nested/third.md"
   LINES_MD="$FIXTURE_ROOT/nested/lines.md"
   BLOB_BIN="$FIXTURE_ROOT/artifacts/blob.bin"
   ROOT_MD_ABS="<workspace-root>/$ROOT_MD"
   ROOT_MD_FILE_URL="file://<workspace-root>/$ROOT_MD"
   NON_VIEWABLE_ABS="<workspace-root>/$BLOB_BIN"
   ```

2. Navigate to the workspace agents page:
   `<base-url>/#/workspace/<workspace-id>/agents`

3. Save screenshot `$RUN_DIR/01-start.png` once the page has loaded.

4. Click **New Agent** if the launch panel is not already visible. Select `<model-name>`.

5. Type this setup message into the launch textarea and launch the agent:

   ```
   Create these workspace files exactly under the current workspace root. Use file-editing tools for the markdown files and bash only for the binary file.

   1. tmp/file-links-viewer-agentic/root.md
      Content:
      # File Links Root

      Open [Nested notes](tmp/file-links-viewer-agentic/nested/second.md) from rich markdown.
      Open [Line target](tmp/file-links-viewer-agentic/nested/lines.md#L42) from rich markdown.

   2. tmp/file-links-viewer-agentic/nested/second.md
      Content:
      # Nested Notes

      Open [Third markdown](tmp/file-links-viewer-agentic/nested/third.md) from the stacked viewer.

   3. tmp/file-links-viewer-agentic/nested/third.md
      Content:
      # Third Markdown

      The third viewer layer is open.

   4. tmp/file-links-viewer-agentic/nested/lines.md
      Create exactly 50 lines. Lines 1 through 41 must be `Line N` using the matching number. Line 42 must be exactly `TARGET LINE 42`. Lines 43 through 50 must continue the same `Line N` pattern.

   5. tmp/file-links-viewer-agentic/artifacts/blob.bin
      Create a binary file that contains at least one NUL byte so the shared file viewer rejects it as non-text.

   After writing the files, report these exact confirmations and then stop:
   - `root ok`
   - `second ok`
   - `third ok`
   - `line42 ok: TARGET LINE 42`
   - `blob ok`
   ```

6. Wait for the setup agent to complete. Save screenshot `$RUN_DIR/02-fixtures-created.png` showing the completion message with all five confirmations.

7. In the same agent thread, send this follow-up user message exactly so the links render inside a user chat bubble:

   ```
   Open these local file links from my message bubble:

   - [Relative root](tmp/file-links-viewer-agentic/root.md)
   - [Absolute root](<workspace-root>/tmp/file-links-viewer-agentic/root.md)
   - [File URL root](file://<workspace-root>/tmp/file-links-viewer-agentic/root.md)
   - [Non-viewable file](<workspace-root>/tmp/file-links-viewer-agentic/artifacts/blob.bin)
   ```

8. Save screenshot `$RUN_DIR/03-user-links-rendered.png` showing the user bubble with the four local file link buttons.

9. Click **Relative root** in the user bubble. Confirm a dialog titled `root.md` opens, the full path `<workspace-root>/tmp/file-links-viewer-agentic/root.md` is visible in the dialog header, and **Rich** is selected. Save screenshot `$RUN_DIR/04-relative-root.png`. Close the viewer.

10. Click **Absolute root** in the same user bubble. Confirm the same `root.md` viewer opens again with **Rich** selected. Save screenshot `$RUN_DIR/05-absolute-root.png`. Close the viewer.

11. Click **File URL root** in the same user bubble. Confirm the same `root.md` viewer opens again with **Rich** selected. Save screenshot `$RUN_DIR/06-file-url-root.png`.

12. While `root.md` is still open in rich mode, click **Line target** inside the rendered markdown. Confirm a second dialog titled `lines.md` opens on top of `root.md`, **Raw** is selected for `lines.md`, and `TARGET LINE 42` is visible in the raw editor viewport. Save screenshot `$RUN_DIR/07-line-target-raw.png`. Close only the top `lines.md` viewer so `root.md` remains open.

13. From the still-open `root.md` viewer, click **Nested notes**. Confirm a second dialog titled `second.md` opens on top of `root.md` and renders its markdown content in rich mode.

14. From the `second.md` viewer, click **Third markdown**. Confirm a third dialog titled `third.md` opens on top of `second.md`, while `root.md` and `second.md` remain visible behind it as stacked viewers. Save screenshot `$RUN_DIR/08-stacked-viewers-before-reload.png`.

15. Reload the page while the three file viewers are still open. Wait for the agents page to finish loading again, then confirm dialogs titled `root.md`, `second.md`, and `third.md` are restored from the modal URL stack. Save screenshot `$RUN_DIR/09-stacked-viewers-after-reload.png`.

16. Close all file viewers. Then click **Non-viewable file** in the same user bubble. Confirm a dialog titled `blob.bin` opens, an error message containing `Only text files can be viewed` is visible, and a **Reveal file in Finder** button is present and enabled. Click **Reveal file in Finder** once. Save screenshot `$RUN_DIR/10-non-viewable-error.png`.

17. Take screenshot `$RUN_DIR/11-final.png` showing the final non-viewable-file error state.

## Pass criteria

All of the following must be true:

- The user bubble renders clickable local file link buttons for the relative, absolute, `file://`, and non-viewable targets
- Clicking **Relative root**, **Absolute root**, and **File URL root** each opens the same shared `root.md` file viewer with the resolved absolute workspace path visible
- Clicking **Line target** from rendered markdown opens `lines.md` as a stacked viewer with **Raw** selected and `TARGET LINE 42` visible
- Clicking **Nested notes** and then **Third markdown** produces three stacked file-viewer dialogs titled `root.md`, `second.md`, and `third.md`
- Reloading the page while those viewers are open restores the same stacked dialogs from the routed modal URL
- Clicking **Non-viewable file** shows an error containing `Only text files can be viewed` while still keeping **Reveal file in Finder** available
- The runner-provided video file exists and has a non-zero size

## Fail criteria

Any of the following immediately indicates failure:

- Any of the three direct user-bubble link formats fails to open `root.md`
- A markdown file link clicked inside the viewer replaces the existing viewer instead of stacking a new one
- The `#L42` target does not open raw mode, or `TARGET LINE 42` is not visible after opening it
- Reloading the page drops the open viewer stack or returns to the page without restoring `root.md`, `second.md`, and `third.md`
- The non-viewable file closes immediately, shows no error state, or does not offer **Reveal file in Finder**
- The setup agent does not report all five confirmation lines
- The operation did not complete within the timeout

## Known limitations

- The non-viewable-file path depends on the setup agent successfully creating a binary file with at least one NUL byte.
