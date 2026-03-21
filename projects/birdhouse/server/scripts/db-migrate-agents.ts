// ABOUTME: Applies all pending agents.db migrations to an explicit workspace database
// ABOUTME: Human-only tool — agents verify migrations via the test suite

import { runAgentsDbMigrations } from "../src/lib/agents-db-migrations/run-agents-db-migrations";
import { resolveAgentsDbPath } from "./resolve-agents-db-path";

const arg = process.argv[2];

if (!arg) {
  console.error("Usage: bun run db:migrate-agents-db <workspace-id-or-path>");
  console.error("  workspace-id  e.g. ws_a8d1e136456699b4");
  console.error("  path          e.g. ~/Library/Application Support/Birdhouse/workspaces/ws_xxx/agents.db");
  process.exit(1);
}

const dbPath = resolveAgentsDbPath(arg);

console.log("Applying pending agents.db migrations...");
console.log(`  ${dbPath}\n`);

await runAgentsDbMigrations(dbPath);

console.log("\nDone.");
