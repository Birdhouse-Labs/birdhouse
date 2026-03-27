# How to Run a UI Test Case

## Prerequisites

- `browser-use` on PATH (verify: `browser-use doctor`)
- Birdhouse server buildable from `projects/birdhouse/server`
- Birdhouse frontend buildable from `projects/birdhouse/frontend`
- OpenCode configured either through environment variables or `projects/birdhouse/.env`
- A valid API key to supply at test time when the test case needs one — the test agent enters it through the UI, never pre-seeded via API. If you do not have a key handy, ask the person running the test or check an existing configured workspace: open it in Birdhouse → Settings → Workspace Settings → AI Providers. Do not store keys in any test case file or skill file.

From anywhere inside the clone, determine the repo root once:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
printf '%s\n' "$REPO_ROOT"
```

Build the frontend once before the run so the isolated server can serve the UI:

```bash
bun run build
```

Run that from `"$REPO_ROOT/projects/birdhouse/frontend"`.

## Step 1 — Choose a port

Pick an unused port. `50150` is the convention. Verify nothing is running there:

```bash
curl -s http://127.0.0.1:50150/api/health
```

If it responds, kill the process or pick a different port:

```bash
lsof -ti :50150 | xargs kill 2>/dev/null
```

Also verify the OpenCode port range that Birdhouse will use for this run is free. Birdhouse allocates OpenCode from `<PORT> + 10` onward.

```bash
PORT=50150
for p in $(seq $((PORT + 10)) $((PORT + 109))); do
  if lsof -ti :"$p" >/dev/null 2>&1; then
    echo "Port $p is already in use"
  fi
done
```

If any of those ports are in use, either stop the conflicting processes or choose a different base port.

## Step 2 — Prepare a timestamped run artifact directory

Create a timestamped output directory for this run. Do not reuse a fixed directory name.

```bash
TEST_NAME="ftue-walk-through"
RUN_TIMESTAMP=$(date +"%Y-%m-%d-%H-%M-%S")
RUN_DIR="$REPO_ROOT/tmp/ui-test-runs/${TEST_NAME}-${RUN_TIMESTAMP}"
WORKSPACE_DIR="$RUN_DIR/workspace"
SCREENSHOT_DIR="$RUN_DIR/screenshots"
mkdir -p "$WORKSPACE_DIR" "$SCREENSHOT_DIR"
printf '%s\n' "$RUN_DIR"
```

This gives the run a self-contained artifact directory with:

- `data.db`
- workspace directory
- `screenshots/`
- `server.log`
- `report.md`

Using a unique `WORKSPACE_DIR` matters because Birdhouse derives the workspace ID from the directory path. Reusing the same directory can leak prior `agents.db` and OpenCode state into later runs.

## Step 3 — Create the test agent

Use `agent_create`. The prompt should contain four sections in order:

1. The isolated server setup instructions
2. The credentials block
3. The test case content (paste from the test case file)
4. The reporting instructions

### Section 1 — Isolated server setup

Paste this into the prompt (substitute `<PORT>` and the concrete paths you created in Step 2):

---

**Isolated server setup**

Load the `browser-use` skill first.

First, close any existing browser session to start clean:

```bash
browser-use close --all 2>/dev/null || true
```

Use these run-specific paths for this test:

```bash
REPO_ROOT="<REPO_ROOT>"
RUN_DIR="<RUN_DIR>"
WORKSPACE_DIR="<WORKSPACE_DIR>"
DATA_DB_PATH="$RUN_DIR/data.db"
SERVER_LOG="$RUN_DIR/server.log"
SERVER_PID_FILE="$RUN_DIR/server.pid"
SCREENSHOT_DIR="<SCREENSHOT_DIR>"
REPORT_FILE="$RUN_DIR/report.md"
mkdir -p "$SCREENSHOT_DIR"
```

Start an isolated Birdhouse server on port `<PORT>`. Run this from `projects/birdhouse/server` (use the `workdir` parameter, do not `cd`). Do not use `--watch` for test runs.

```bash
if [ -f "$REPO_ROOT/projects/birdhouse/.env" ]; then
  BIRDHOUSE_BASE_PORT=<PORT> \
  BIRDHOUSE_DATA_DB_PATH="$DATA_DB_PATH" \
  FRONTEND_STATIC="$REPO_ROOT/projects/birdhouse/frontend/dist" \
  bun --env-file="$REPO_ROOT/projects/birdhouse/.env" src/index.ts > "$SERVER_LOG" 2>&1 &
else
  BIRDHOUSE_BASE_PORT=<PORT> \
  BIRDHOUSE_DATA_DB_PATH="$DATA_DB_PATH" \
  FRONTEND_STATIC="$REPO_ROOT/projects/birdhouse/frontend/dist" \
  bun src/index.ts > "$SERVER_LOG" 2>&1 &
fi
echo $! > "$SERVER_PID_FILE"
echo "Server PID: $(cat "$SERVER_PID_FILE")"
```

Poll until healthy (up to 30 seconds):

```bash
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:<PORT>/api/health > /dev/null 2>&1; then
    echo "Server ready after ${i}s"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "ERROR: server did not start in 30s"
    cat "$SERVER_LOG"
    exit 1
  fi
  sleep 1
done
```

Confirm the frontend is being served, not just the API root:

```bash
curl -sf http://127.0.0.1:<PORT>/ | grep -qi '<!doctype html\|<html'
```

If that check fails, stop and report an environment failure. Do not continue with a browser run against an API-only server.

Open the browser on the setup URL for this run's workspace directory:

```bash
browser-use open "http://localhost:<PORT>/#/setup?directory=$WORKSPACE_DIR"
```

Clear origin state before interacting so a stale browser profile does not leak cookies or storage into the run:

```bash
browser-use cookies clear --url "http://localhost:<PORT>" || true
browser-use eval "window.localStorage.clear(); window.sessionStorage.clear(); window.location.reload()"
```

---

### Section 2 — Credentials block

Paste a short credentials section even if the test case does not need credentials.

Use this template:

---

**Credentials**

- Google AI (Gemini) API key: `<PASTE_KEY_HERE>`

Rules:
- Treat credentials as input values provided by the runner, not part of the repository
- Enter credentials only through the UI
- If the provider rejects the key because it is invalid, expired, rate-limited, or out of quota, stop and report an **environment failure** separately from any Birdhouse UX issues

---

### Section 3 — Test case content

Paste the full contents of the test case file (e.g. `test-cases/ftue-walk-through.md`).

### Section 4 — Reporting instructions

Paste this at the end of the prompt:

---

**Reporting**

As you walk through each goal, annotate each step inline:
- ✅ worked as expected
- ⚠️ confusing, awkward, or missing guidance
- 🔴 broken or blocking

Take screenshots at key moments using zero-padded numeric prefixes so order is obvious in the artifact directory:

```bash
browser-use screenshot "$SCREENSHOT_DIR/01-profile-setup.png"
browser-use screenshot "$SCREENSHOT_DIR/02-workspace-create.png"
browser-use screenshot "$SCREENSHOT_DIR/03-booting-screen.png"
# ...and so on
```

Naming convention: `NN-kebab-description.png` where `NN` is two-digit zero-padded. Take a screenshot at every distinct step — at minimum one per user goal in the test case.

Write the final markdown report to:

```bash
$REPORT_FILE
```

After writing the final report in your response, save it with a command like:

```bash
cat > "$REPORT_FILE" <<'EOF'
# <test title>

## Step-by-step log
...

## Issues

### 🔴 Broken
...

### ⚠️ Confusing
...

### 💬 Polish
...

## Environment notes
...

## Overall verdict
...
EOF
```

At the end, produce:
1. A step-by-step log with inline annotations
2. A prioritized issues list separated by severity:
   - **🔴 Broken** — blocks a new user from completing the flow (must fix)
   - **⚠️ Confusing** — friction or missing guidance but recoverable (should fix)
   - **💬 Polish** — noticeable but minor, user can still succeed (nice to have)
   - Do not include known intentional behaviours in any severity tier
3. A short environment notes section covering credentials, startup behaviour, and any third-party failures
4. A one-paragraph overall verdict

Then save that same report as markdown at `REPORT_FILE` so the run directory is self-contained.

If you hit a blocker, inspect the relevant logs before concluding the product is broken:

```bash
tail -n 200 "$SERVER_LOG"
```

If Birdhouse has already created a workspace and you need the OpenCode log, inspect the workspace health endpoint and then look for the OpenCode log under the Birdhouse data root for that workspace.

**Rules**
- Run `browser-use state` before every click — never guess element indices
- The browser daemon persists between commands; do not re-open the browser
- Do NOT pre-seed credentials via API or curl — enter everything through the UI as a real user would
- If a step is ambiguous, make the most natural user choice and note it
- If previous-run state appears in the UI, stop and mark the run invalid rather than silently continuing
- Distinguish Birdhouse UX failures from environment failures such as invalid credentials, provider outages, or missing frontend assets
- **`browser-use state` does not show virtualized list items that are off-screen.** Dropdowns and long lists only render visible rows in the DOM — items scrolled below the fold will be absent from `state` output entirely. If you need to verify the full contents of a list (e.g. a model selector), query the DOM directly:
  ```bash
  # Count all options and inspect items at any position
  browser-use eval "
  const lb = document.querySelector('[role=listbox]');
  const opts = Array.from(lb ? lb.querySelectorAll('[role=option]') : []);
  opts.map((o, i) => i + ': ' + o.textContent.trim().replace(/\s+/g, ' ').slice(0, 80));
  "
  ```
  If the listbox has a known `id`, use `document.getElementById('the-id')` instead of `querySelector` to avoid ambiguity.

---

### Full example `agent_create` call

```javascript
agent_create({
  title: "FTUE walk-through — UI test run",
  prompt: [
    SECTION_1_SERVER_SETUP,       // server setup block above, substituted
    SECTION_2_CREDENTIALS,        // runner-supplied credentials block
    SECTION_3_TEST_CASE_CONTENT,  // full contents of ftue-walk-through.md
    SECTION_4_REPORTING,          // reporting block above
  ].join("\n\n")
})
```

## Step 4 — Wait for results

Tests typically take 5–15 minutes. Use `agent_read(agent_id)` to wait. If it times out, the agent is still running — call `agent_read` again.

```javascript
agent_read({ agent_id })           // wait for completion
agent_read({ agent_id, latest_turn: true })  // get final message if needed
```

## Step 5 — Cleanup

Kill the isolated server and anything still listening on the server or OpenCode port range:

```bash
PORT=<PORT>
kill $(cat "$SERVER_PID_FILE" 2>/dev/null) 2>/dev/null || true
for p in $(seq "$PORT" $((PORT + 109))); do
  lsof -ti :"$p" | xargs kill 2>/dev/null || true
done
```

Remove temp data for the run:

```bash
echo "Artifacts kept in $RUN_DIR"
```

Close the browser session:

```bash
browser-use close --all
```

The run artifacts remain in `RUN_DIR` on purpose so they can be inspected locally or archived by CI. Birdhouse workspace engine state also lives under the user's Birdhouse data root and is keyed by workspace directory. That is why the run must always use a unique `WORKSPACE_DIR`.

To delete old artifacts later:

```bash
rm -rf "$REPO_ROOT/tmp/ui-test-runs/<test-name>-<timestamp>"
```
