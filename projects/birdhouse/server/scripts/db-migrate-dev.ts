// ABOUTME: Runs pending data.db migrations against the local dev database
// ABOUTME: Human-only tool — agents should use the test suite to verify migrations

import { homedir } from "node:os";
import { join } from "node:path";
import { runMigrations } from "../src/lib/migrations/run-migrations";

const DEV_DB = join(homedir(), "Library/Application Support/Birdhouse/data-dev.db");

console.log("Running data.db migrations on dev database...");
console.log(`  ${DEV_DB}\n`);

await runMigrations(DEV_DB);

console.log("\nDev database is up to date.");
