// ABOUTME: Kysely migration runner for data.db schema changes
// ABOUTME: Runs on server startup to apply any pending migrations

import Database from "bun:sqlite";
import type { Migration, MigrationResult, MigrationResultSet } from "kysely";
import { Kysely, Migrator } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { log } from "../logger";

// Import migrations directly so they're bundled into the compiled binary
import * as migration_000 from "./migrations/2026-02-28_000_initial_schema";
import * as migration_001 from "./migrations/2026-03-03_001_plaintext_secrets";
import * as migration_002 from "./migrations/2026-03-14_002_skill_trigger_phrases";

const allMigrations: Record<string, Migration> = {
  "2026-02-28_000_initial_schema": migration_000,
  "2026-03-03_001_plaintext_secrets": migration_001,
  "2026-03-14_002_skill_trigger_phrases": migration_002,
};

/**
 * Create a Kysely Migrator for the given data.db path.
 * Used by runMigrations and the human-facing db: scripts.
 */
export function createDataMigrator(dbPath: string): { migrator: Migrator; db: Kysely<Record<string, never>> } {
  const db = new Kysely<Record<string, never>>({
    dialect: new BunSqliteDialect({
      database: new Database(dbPath),
    }),
  });

  const migrator = new Migrator({
    db,
    provider: {
      async getMigrations() {
        return allMigrations;
      },
    },
  });

  return { migrator, db };
}

function logResults(results: MigrationResult[] | undefined): void {
  results?.forEach((it) => {
    if (it.status === "Success") {
      log.server.info({ migration: it.migrationName }, "Migration applied");
    } else if (it.status === "Error") {
      log.server.error({ migration: it.migrationName }, "Migration failed");
    }
  });
}

async function handleResult(resultSet: MigrationResultSet, db: Kysely<Record<string, never>>): Promise<void> {
  logResults(resultSet.results);
  if (resultSet.error) {
    await db.destroy();
    throw resultSet.error;
  }
  await db.destroy();
}

/**
 * Run all pending migrations on the data database.
 * Call this once on server startup before initializing DataDB.
 */
export async function runMigrations(dbPath: string): Promise<void> {
  log.server.info({ dbPath }, "Running data.db migrations...");

  const { migrator, db } = createDataMigrator(dbPath);
  const resultSet = await migrator.migrateToLatest();
  await handleResult(resultSet, db);

  log.server.info({ dbPath }, "Data.db migrations complete");
}
