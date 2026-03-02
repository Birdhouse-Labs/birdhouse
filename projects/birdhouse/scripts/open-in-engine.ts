#!/usr/bin/env bun
// ABOUTME: Dev-mode script to open a Birdhouse agent session in its engine (OpenCode TUI)
// ABOUTME: Accepts a Birdhouse URL, ws_.../agent_... string, or explicit IDs

import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ============================================================================
// Config
// ============================================================================

const OPENCODE_REPO = "/Users/crayment/dev/oss/opencode";
const OPENCODE_PKG = join(OPENCODE_REPO, "packages", "opencode");
const BIRDHOUSE_DATA_ROOT = join(homedir(), "Library/Application Support/Birdhouse");
const DATA_DB_PATHS = [
  join(BIRDHOUSE_DATA_ROOT, "data-dev.db"),
  join(BIRDHOUSE_DATA_ROOT, "data.db"),
];

// ============================================================================
// Args
// ============================================================================

const rawArgs = process.argv.slice(2);

if (rawArgs.length === 0 || rawArgs.includes("--help") || rawArgs.includes("-h")) {
  console.error("Usage: bun run scripts/open-in-engine.ts <url-or-string>");
  console.error("       bun run scripts/open-in-engine.ts --workspace <ws_id> --agent <agent_id>");
  console.error("");
  console.error("  <url-or-string>   A Birdhouse URL or ws_.../agent_... string.");
  console.error("                    Picks first ws_... as workspace, last agent_... as agent");
  console.error("                    (so modal stacks resolve to the deepest agent).");
  console.error("");
  console.error("Examples:");
  console.error('  bun run scripts/open-in-engine.ts "http://localhost:50120/#/workspace/ws_abc/agent/agent_xyz"');
  console.error('  bun run scripts/open-in-engine.ts "http://localhost:50120/#/workspace/ws_abc/agent/agent_xyz?modals=agent%2Fagent_deep"');
  console.error("  bun run scripts/open-in-engine.ts ws_abc/agent_xyz");
  console.error("  bun run scripts/open-in-engine.ts --workspace ws_abc --agent agent_xyz");
  process.exit(1);
}

// ============================================================================
// Parsing
// ============================================================================

function parseInput(input: string): { workspaceId: string | null; agentId: string | null } {
  const workspaceMatch = input.match(/ws_[A-Za-z0-9_-]+/);
  const agentMatches = [...input.matchAll(/agent_[A-Za-z0-9_-]+/g)];
  return {
    workspaceId: workspaceMatch ? workspaceMatch[0] : null,
    agentId: agentMatches.length > 0 ? agentMatches[agentMatches.length - 1][0] : null,
  };
}

let workspaceId: string | null = null;
let agentId: string | null = null;

for (let i = 0; i < rawArgs.length; i++) {
  if ((rawArgs[i] === "--workspace" || rawArgs[i] === "-w") && rawArgs[i + 1]) {
    workspaceId = rawArgs[++i];
  } else if ((rawArgs[i] === "--agent" || rawArgs[i] === "-a") && rawArgs[i + 1]) {
    agentId = rawArgs[++i];
  } else if (!rawArgs[i].startsWith("-")) {
    const parsed = parseInput(rawArgs[i]);
    if (!workspaceId) workspaceId = parsed.workspaceId;
    if (!agentId) agentId = parsed.agentId;
  }
}

if (!workspaceId) {
  console.error("❌ Could not determine workspace ID.");
  process.exit(1);
}
if (!agentId) {
  console.error("❌ Could not determine agent ID.");
  process.exit(1);
}

// ============================================================================
// Validate OpenCode source exists
// ============================================================================

const opencodeIndex = join(OPENCODE_PKG, "src", "index.ts");
if (!existsSync(opencodeIndex)) {
  console.error(`❌ OpenCode source not found at: ${OPENCODE_PKG}`);
  process.exit(1);
}

// ============================================================================
// Look up workspace
// ============================================================================

type WorkspaceRow = { workspace_id: string; directory: string; opencode_port: number | null };

function findWorkspace(id: string): WorkspaceRow {
  for (const dbPath of DATA_DB_PATHS) {
    if (!existsSync(dbPath)) continue;
    const db = new Database(dbPath, { readonly: true });
    const row = db
      .query<WorkspaceRow, [string]>(
        "SELECT workspace_id, directory, opencode_port FROM workspaces WHERE workspace_id = ?",
      )
      .get(id);
    db.close();
    if (row) return row;
  }
  console.error(`❌ Workspace not found: ${id}`);
  process.exit(1);
}

const workspace = findWorkspace(workspaceId);

if (!workspace.opencode_port) {
  console.error(`❌ No running OpenCode instance for workspace: ${workspaceId}`);
  console.error("   Start Birdhouse and open this workspace first.");
  process.exit(1);
}

const opencodeUrl = `http://127.0.0.1:${workspace.opencode_port}`;

// ============================================================================
// Look up agent
// ============================================================================

const agentsDbPath = join(BIRDHOUSE_DATA_ROOT, "workspaces", workspaceId, "agents.db");

if (!existsSync(agentsDbPath)) {
  console.error(`❌ Agents database not found: ${agentsDbPath}`);
  process.exit(1);
}

const agentsDb = new Database(agentsDbPath, { readonly: true });
const agent = agentsDb
  .query<{ id: string; session_id: string; title: string; directory: string }, [string]>(
    "SELECT id, session_id, title, directory FROM agents WHERE id = ?",
  )
  .get(agentId);
agentsDb.close();

if (!agent) {
  console.error(`❌ Agent not found: ${agentId} in workspace ${workspaceId}`);
  process.exit(1);
}

// ============================================================================
// Verify OpenCode is reachable
// ============================================================================

try {
  const response = await fetch(`${opencodeUrl}/global/health`, { signal: AbortSignal.timeout(2000) });
  if (!response.ok) {
    console.error(`❌ OpenCode at ${opencodeUrl} returned status ${response.status}`);
    process.exit(1);
  }
} catch {
  console.error(`❌ Cannot reach OpenCode at ${opencodeUrl}`);
  console.error("   Make sure Birdhouse is running and the workspace is active.");
  process.exit(1);
}

// ============================================================================
// Launch TUI
// ============================================================================

console.log(`Opening: ${agent.title}`);
console.log(`  Agent:    ${agent.id}`);
console.log(`  Session:  ${agent.session_id}`);
console.log(`  OpenCode: ${opencodeUrl}`);
console.log("");

const opencodeDataDir = join(BIRDHOUSE_DATA_ROOT, "workspaces", workspaceId, "engine");

const env: Record<string, string> = {
  ...(process.env as Record<string, string>),
  OPENCODE_XDG_DATA_HOME: join(opencodeDataDir, "data"),
  OPENCODE_XDG_CONFIG_HOME: join(opencodeDataDir, "config"),
  OPENCODE_XDG_STATE_HOME: join(opencodeDataDir, "state"),
  OPENCODE_XDG_CACHE_HOME: join(opencodeDataDir, "cache"),
};

const proc = Bun.spawn(
  [
    "bun", "run", "--conditions=browser", "src/index.ts",
    "attach", opencodeUrl,
    "--session", agent.session_id,
    "--dir", agent.directory,
  ],
  { cwd: OPENCODE_PKG, env, stdin: "inherit", stdout: "inherit", stderr: "inherit" },
);

process.exit(await proc.exited);
