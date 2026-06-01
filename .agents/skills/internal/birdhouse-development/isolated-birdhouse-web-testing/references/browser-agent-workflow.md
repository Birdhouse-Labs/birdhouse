# Browser Agent Workflow

Use this reference when a parent or implementation agent wants a child agent to test an isolated Birdhouse web flow with browser tools and report findings back.

Load the [Browser Automation with browser-use CLI](birdhouse:skill/browser-use) skill in the browser child agent when it is relevant.

## What The Parent Should Pass In

Pass these concrete inputs to the browser child agent:

- exact worktree path
- exact run dir
- exact Birdhouse server URL and base port
- exact workspace id or exact setup URL
- the specific user path to test
- what counts as success
- what screenshots or MP4 you expect
- explicit instruction to report findings and artifact paths, not to edit code

Minimal prompt shape:

```text
Test this isolated Birdhouse environment with browser-use.

Worktree: /absolute/path/to/worktree
Run dir: /absolute/path/to/run-dir
Server: http://127.0.0.1:50140
Workspace ID: ws_abc123

Validate this exact path:
1. ...
2. ...
3. ...

Capture screenshots at meaningful checkpoints.
Do not edit code.
Report pass/fail, classified findings, and full artifact paths.
```

## What The Browser Child Agent Should Do

1. Start clean.

```bash
browser-use close --all 2>/dev/null || true
```

2. Open the isolated Birdhouse page with a named session.

```bash
browser-use --session isolated-birdhouse open "$SERVER/#/workspace/$WORKSPACE_ID/agents"
```

3. If a recording is desired, start it after the page opens and before the first meaningful interaction.

```bash
browser-use --session isolated-birdhouse record start "$RUN_DIR/demo.mp4"
```

4. Use `browser-use state` before and after major transitions.

5. Capture screenshots at each meaningful checkpoint with ordered names.

```bash
browser-use --session isolated-birdhouse screenshot "$RUN_DIR/screenshots/01-start.png"
browser-use --session isolated-birdhouse screenshot "$RUN_DIR/screenshots/02-before-submit.png"
browser-use --session isolated-birdhouse screenshot "$RUN_DIR/screenshots/03-after-submit.png"
```

6. Report failures as one of:

- app bug
- environment issue
- automation issue

## Recommended Assertions

Use `eval` when text alone is not trustworthy enough.

Examples:

```bash
browser-use --session isolated-birdhouse eval "window.location.hash"
```

```bash
browser-use --session isolated-birdhouse eval "[...document.querySelectorAll('[data-skill-link]')].map(el => el.getAttribute('data-skill-link'))"
```

Prefer assertions that confirm the intended state directly, especially for modal routing and Birdhouse-specific reference buttons.

## Retest Reuse Pattern

Browser child agents should be reusable through `agent_reply`.

Typical follow-ups from the parent agent:

- `Retest the same path after the latest fix.`
- `Rerun only steps 2-4.`
- `Capture one more screenshot of the open modal state.`
- `Record the final happy path now.`

The browser child agent should preserve:

- the exact path it was validating
- the artifact naming pattern it used
- the main automation caveats it observed

## Native Click Caveat

If a valid Birdhouse UI element is present but a native headless browser click does not trigger the expected behavior, verify whether the app wiring still works by dispatching a DOM click event as a fallback.

Example:

```bash
browser-use --session isolated-birdhouse eval "(() => { const el = document.querySelector('[data-skill-link=\"find-docs\"]'); if (!el) return { clicked: false }; el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true })); return { clicked: true, hash: window.location.hash }; })()"
```

If that fallback works, report it as an automation issue or caveat unless you have evidence of a real product bug.

## What The Browser Child Agent Should Report Back

Always return:

- passed or failed
- the exact step that failed, if any
- failure classification: app, environment, or automation
- full screenshot paths
- full MP4 path if recorded
- any exact `browser-use` or `eval` instruction that succeeded and could be reused later

That last point matters. A parent agent may want to reuse the same browser child agent or reproduce the successful path itself.
