// ABOUTME: Rolls back the last data.db migration on the local dev database
// ABOUTME: Human-only tool — for recovering from a bad migration during development

import Database from "bun:sqlite";
import type { Migration } from "kysely";
import { Kysely, Migrator } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { homedir } from "node:os";
import { join } from "node:path";

// Must match allMigrations in run-migrations.ts exactly
import * as migration_000 from "../src/lib/migrations/migrations/2026-02-28_000_initial_schema";
import * as migration_001 from "../src/lib/migrations/migrations/2026-03-03_001_plaintext_secrets";
import * as migration_002 from "../src/lib/migrations/migrations/2026-03-14_002_skill_trigger_phrases";

const DEV_DB = join(homedir(), "Library/Application Support/Birdhouse/data-dev.db");

console.log("Rolling back last data.db migration on dev database...");
console.log(`  ${DEV_DB}\n`);

const db = new Kysely<Record<string, never>>({
  dialect: new BunSqliteDialect({
    database: new Database(DEV_DB),
  }),
});

const allMigrations: Record<string, Migration> = {
  "2026-02-28_000_initial_schema": migration_000,
  "2026-03-03_001_plaintext_secrets": migration_001,
  "2026-03-14_002_skill_trigger_phrases": migration_002,
};

const migrator = new Migrator({
  db,
  provider: {
    async getMigrations() {
      return allMigrations;
    },
  },
});

const { error, results } = await migrator.migrateDown();

results?.forEach((it) => {
  if (it.status === "Success") {
    console.log(`Rolled back: ${it.migrationName}`);
  } else if (it.status === "Error") {
    console.error(`Rollback failed: ${it.migrationName}`);
  } else if (it.status === "NotExecuted") {
    console.log("Nothing to roll back.");
  }
});

if (error) {
  console.error("Rollback failed:", error);
  await db.destroy();
  process.exit(1);
}

await db.destroy();
console.log("\nDone.");
