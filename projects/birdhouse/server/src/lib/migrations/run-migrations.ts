// ABOUTME: Kysely migration runner for data.db schema changes
// ABOUTME: Runs on server startup to apply any pending migrations

import Database from "bun:sqlite";
import type { Migration } from "kysely";
import { Kysely, Migrator, sql } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { log } from "../logger";

// Import migrations directly so they're bundled into the compiled binary
import * as migration_000 from "./migrations/2026-02-28_000_initial_schema";
import * as migration_001 from "./migrations/2026-03-03_001_plaintext_secrets";

/**
 * Run all pending migrations on the data database
 * Call this once on server startup before initializing DataDB
 */
export async function runMigrations(dbPath: string): Promise<void> {
  log.server.info({ dbPath }, "Running database migrations...");

  // Create a temporary Kysely instance ONLY for migrations
  // Using Record<string, never> instead of any for empty database type
  const db = new Kysely<Record<string, never>>({
    dialect: new BunSqliteDialect({
      database: new Database(dbPath),
    }),
  });

  const allMigrations: Record<string, Migration> = {
    "2026-02-28_000_initial_schema": migration_000,
    "2026-03-03_001_plaintext_secrets": migration_001,
  };

  // When there is exactly one migration, reset Kysely's tracking tables so it
  // re-evaluates from scratch. All migrations use IF NOT EXISTS so re-running
  // them is safe — no data is affected. This fires automatically whenever
  // migrations are squashed down to a single file, and self-disables as soon
  // as a second migration is added.
  if (Object.keys(allMigrations).length === 1) {
    await sql`DROP TABLE IF EXISTS kysely_migration`.execute(db);
    await sql`DROP TABLE IF EXISTS kysely_migration_lock`.execute(db);
  }

  const migrator = new Migrator({
    db,
    provider: {
      // Provide migrations directly instead of loading from filesystem
      async getMigrations() {
        return allMigrations;
      },
    },
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      log.server.info({ migration: it.migrationName }, "✅ Migration applied");
    } else if (it.status === "Error") {
      log.server.error({ migration: it.migrationName }, "❌ Migration failed");
    }
  });

  if (error) {
    log.server.error({ error }, "Migration failed");
    await db.destroy();
    throw error;
  }

  log.server.info("All migrations applied successfully");

  // Clean up Kysely instance - we only needed it for migrations
  await db.destroy();
}
