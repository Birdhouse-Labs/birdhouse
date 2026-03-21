// ABOUTME: Rolls back one agents.db migration on an explicit workspace database
// ABOUTME: Human-only tool — use the test suite to verify migrations during development

import { createAgentsMigrator } from "../src/lib/agents-db-migrations/run-agents-db-migrations";
import { resolveAgentsDbPath } from "./resolve-agents-db-path";

const arg = process.argv[2];

if (!arg) {
  console.error("Usage: bun run db:migrate-down-agents-db <workspace-id-or-path>");
  console.error("  workspace-id  e.g. ws_a8d1e136456699b4");
  console.error("  path          e.g. ~/Library/Application Support/Birdhouse/workspaces/ws_xxx/agents.db");
  console.error("");
  console.error("Rolls back exactly one migration (the most recently applied).");
  process.exit(1);
}

const dbPath = resolveAgentsDbPath(arg);

const { migrator, db } = createAgentsMigrator(dbPath);

// Show current state before acting
const migrations = await migrator.getMigrations();
const applied = migrations.filter((m) => m.executedAt);
console.log("Currently applied migrations:");
for (const m of applied) {
  console.log(`  ${m.name} (applied ${m.executedAt?.toISOString()})`);
}
if (applied.length === 0) {
  console.log("  (none)");
  await db.destroy();
  process.exit(0);
}

console.log(`\nRolling back: ${applied[applied.length - 1].name}\n`);

const { error, results } = await migrator.migrateDown();

results?.forEach((it) => {
  if (it.status === "Success") {
    console.log(`Rolled back: ${it.migrationName}`);
  } else if (it.status === "Error") {
    console.error(`Failed: ${it.migrationName}`);
  } else if (it.status === "NotExecuted") {
    console.log("Nothing to roll back.");
  }
});

if (error) {
  console.error("\nRollback failed:", error);
  await db.destroy();
  process.exit(1);
}

await db.destroy();
console.log("\nDone.");
