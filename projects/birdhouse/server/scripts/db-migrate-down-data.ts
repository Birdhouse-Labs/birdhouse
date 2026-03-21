// ABOUTME: Rolls back one data.db migration on an explicit database path
// ABOUTME: Human-only tool — use the test suite to verify migrations during development

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { createDataMigrator } from "../src/lib/migrations/run-migrations";

const arg = process.argv[2];

if (!arg) {
  console.error("Usage: bun run db:migrate-down-data <path>");
  console.error("  path  Absolute path to the data.db file");
  console.error("");
  console.error("Rolls back exactly one migration (the most recently applied).");
  process.exit(1);
}

const dbPath = arg.replace(/^~/, homedir());

if (!existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  process.exit(1);
}

const { migrator, db } = createDataMigrator(dbPath);

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
