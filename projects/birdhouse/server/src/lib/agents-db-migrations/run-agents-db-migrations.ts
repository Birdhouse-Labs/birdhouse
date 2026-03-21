// ABOUTME: Kysely migration runner for agents.db schema changes
// ABOUTME: Runs once per workspace on first access to apply any pending migrations

import Database from "bun:sqlite";
import type { Migration } from "kysely";
import { Kysely, Migrator } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { log } from "../logger";

// Import migrations directly so they're bundled into the compiled binary
import * as migration_20260320000000 from "./migrations/20260320000000_initial_schema";

/**
 * Run all pending migrations on an agents database
 * Call this once before using the AgentsDB instance for a given workspace
 */
export async function runAgentsDbMigrations(dbPath: string): Promise<void> {
  log.server.info({ dbPath }, "Running agents DB migrations...");

  // Create a temporary Kysely instance ONLY for migrations
  const db = new Kysely<Record<string, never>>({
    dialect: new BunSqliteDialect({
      database: new Database(dbPath),
    }),
  });

  const allMigrations: Record<string, Migration> = {
    "20260320000000_initial_schema": migration_20260320000000,
  };

  const migrator = new Migrator({
    db,
    provider: {
      async getMigrations() {
        return allMigrations;
      },
    },
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      log.server.info({ migration: it.migrationName }, "Migration applied");
    } else if (it.status === "Error") {
      log.server.error({ migration: it.migrationName }, "Migration failed");
    }
  });

  if (error) {
    log.server.error({ error }, "Agents DB migration failed");
    await db.destroy();
    throw error;
  }

  log.server.info({ dbPath }, "Agents DB migrations complete");

  await db.destroy();
}
