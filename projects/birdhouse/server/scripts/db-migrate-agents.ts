// ABOUTME: Runs pending agents.db migrations against a specific workspace database
// ABOUTME: Human-only tool — agents should use the test suite to verify migrations

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { runAgentsDbMigrations } from "../src/lib/agents-db-migrations/run-agents-db-migrations";

const arg = process.argv[2];

if (!arg) {
  console.error("Usage: bun run db:migrate-agents-db <workspace-id-or-path>");
  console.error("  workspace-id  e.g. ws_a8d1e136456699b4");
  console.error("  path          e.g. ~/Library/Application Support/Birdhouse/workspaces/ws_xxx/agents.db");
  process.exit(1);
}

// Resolve to a file path — accepts either a workspace ID or a direct path
let dbPath: string;

if (arg.startsWith("ws_")) {
  dbPath = join(homedir(), "Library/Application Support/Birdhouse/workspaces", arg, "agents.db");
} else {
  dbPath = arg.replace(/^~/, homedir());
}

if (!existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  process.exit(1);
}

console.log("Running agents.db migrations...");
console.log(`  ${dbPath}\n`);

await runAgentsDbMigrations(dbPath);

console.log("\nDone.");
