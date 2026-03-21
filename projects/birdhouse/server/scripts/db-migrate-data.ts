// ABOUTME: Applies all pending data.db migrations to an explicit database path
// ABOUTME: Human-only tool — agents verify migrations via the test suite

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { runMigrations } from "../src/lib/migrations/run-migrations";

const arg = process.argv[2];

if (!arg) {
  console.error("Usage: bun run db:migrate-data <path>");
  console.error("  path  Absolute path to the data.db file");
  console.error("");
  console.error("Examples:");
  console.error('  bun run db:migrate-data ~/Library/Application\\ Support/Birdhouse/data-dev.db');
  console.error('  bun run db:migrate-data ~/Library/Application\\ Support/Birdhouse/data-spotcheck.db');
  process.exit(1);
}

const dbPath = arg.replace(/^~/, homedir());

if (!existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  process.exit(1);
}

console.log("Applying pending data.db migrations...");
console.log(`  ${dbPath}\n`);

await runMigrations(dbPath);

console.log("\nDone.");
