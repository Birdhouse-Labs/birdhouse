// ABOUTME: Kysely migration runner for agents.db schema changes
// ABOUTME: Runs once per workspace on first access to apply any pending migrations

import Database from "bun:sqlite";
import type { Migration, MigrationResult, MigrationResultSet } from "kysely";
import { Kysely, Migrator } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { log } from "../logger";

// Import migrations directly so they're bundled into the compiled binary
import * as migration_20260320000000 from "./migrations/20260320000000_initial_schema";

const allMigrations: Record<string, Migration> = {
  "20260320000000_initial_schema": migration_20260320000000,
};

/**
 * Create a Kysely Migrator for the given agents.db path.
 * Used by runAgentsDbMigrations and the human-facing db: scripts.
 */
export function createAgentsMigrator(dbPath: string): { migrator: Migrator; db: Kysely<Record<string, never>> } {
  return createAgentsMigratorFromDb(new Database(dbPath));
}

/**
 * Create a Kysely Migrator from an already-open Database instance.
 * Used when the caller already holds the connection (e.g. in-memory databases).
 */
export function createAgentsMigratorFromDb(database: Database): { migrator: Migrator; db: Kysely<Record<string, never>> } {
  const db = new Kysely<Record<string, never>>({
    dialect: new BunSqliteDialect({ database }),
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
 * Run all pending migrations on an agents database.
 * Call this once before using the AgentsDB instance for a given workspace.
 */
export async function runAgentsDbMigrations(dbPath: string): Promise<void> {
  log.server.info({ dbPath }, "Running agents DB migrations...");

  const { migrator, db } = createAgentsMigrator(dbPath);
  const resultSet = await migrator.migrateToLatest();
  await handleResult(resultSet, db);

  log.server.info({ dbPath }, "Agents DB migrations complete");
}

/**
 * Run all pending migrations on an already-open Database instance.
 * Used for in-memory databases where each connection is a fresh database.
 * Does NOT close the database — the caller retains ownership.
 */
export async function runAgentsDbMigrationsOnDb(database: Database): Promise<void> {
  const { migrator, db } = createAgentsMigratorFromDb(database);
  const resultSet = await migrator.migrateToLatest();
  logResults(resultSet.results);
  // Release Kysely's internal resources without closing the underlying connection.
  // BunSqliteDialect.destroy() calls db.close(), so we skip destroy here and
  // let the caller manage the Database lifetime.
  if (resultSet.error) {
    throw resultSet.error;
  }
}
