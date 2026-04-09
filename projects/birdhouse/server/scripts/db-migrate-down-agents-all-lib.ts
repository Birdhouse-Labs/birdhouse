// ABOUTME: Discovers workspace agents.db files and rolls back one specific migration when it is the latest applied.
// ABOUTME: Powers a dry-run-first bulk rollback tool so developers can safely undo a migration across local workspaces.

import Database from "bun:sqlite";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createAgentsMigrator } from "../src/lib/agents-db-migrations/run-agents-db-migrations";

export interface WorkspaceAgentsDbRecord {
  workspaceId: string;
  title: string | null;
  agentsDbPath: string;
  exists: boolean;
}

export type BulkRollbackStatus =
  | "rolled_back"
  | "dry_run"
  | "missing_db"
  | "not_applied"
  | "not_latest"
  | "failed";

export interface BulkRollbackResult {
  workspaceId: string;
  title: string | null;
  agentsDbPath: string;
  status: BulkRollbackStatus;
  latestAppliedMigration?: string;
  appliedMigrations: string[];
  error?: string;
}

export interface BulkRollbackOptions {
  targetMigration: string;
  dataDbPath?: string;
  birdhouseRoot?: string;
  execute: boolean;
}

export function getDefaultBirdhouseRoot(homeDirectory = homedir()): string {
  return join(homeDirectory, "Library/Application Support/Birdhouse");
}

export function getDefaultDataDbPath(birdhouseRoot = getDefaultBirdhouseRoot()): string {
  return join(birdhouseRoot, "data.db");
}

export function expandHomePath(path: string, homeDirectory = homedir()): string {
  return path.replace(/^~/, homeDirectory);
}

export function listWorkspaceAgentsDatabases(
  dataDbPath = getDefaultDataDbPath(),
  birdhouseRoot = getDefaultBirdhouseRoot(),
): WorkspaceAgentsDbRecord[] {
  const resolvedDataDbPath = expandHomePath(dataDbPath);
  const resolvedBirdhouseRoot = expandHomePath(birdhouseRoot);

  if (!existsSync(resolvedDataDbPath)) {
    throw new Error(`data.db not found: ${resolvedDataDbPath}`);
  }

  const db = new Database(resolvedDataDbPath, { readonly: true });

  try {
    const rows = db
      .query<{ workspace_id: string; title: string | null }, []>(
        "SELECT workspace_id, title FROM workspaces ORDER BY last_used DESC",
      )
      .all();

    return rows.map((row) => {
      const agentsDbPath = join(resolvedBirdhouseRoot, "workspaces", row.workspace_id, "agents.db");
      return {
        workspaceId: row.workspace_id,
        title: row.title,
        agentsDbPath,
        exists: existsSync(agentsDbPath),
      };
    });
  } finally {
    db.close();
  }
}

export function getAppliedAgentsDbMigrations(dbPath: string): string[] {
  const db = new Database(dbPath, { readonly: true });

  try {
    const hasTable =
      db
        .query<{ name: string }, [string]>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
        )
        .get("kysely_migration") !== null;

    if (!hasTable) {
      return [];
    }

    const rows = db
      .query<{ name: string }, []>("SELECT name FROM kysely_migration ORDER BY timestamp ASC, name ASC")
      .all();

    return rows.map((row) => row.name);
  } finally {
    db.close();
  }
}

export async function rollbackSpecificAgentsDbMigration(
  dbPath: string,
  targetMigration: string,
): Promise<{ rolledBack: string | null }> {
  const applied = getAppliedAgentsDbMigrations(dbPath);
  const latest = applied[applied.length - 1] ?? null;

  if (latest !== targetMigration) {
    throw new Error(
      latest
        ? `Latest applied migration is ${latest}, not ${targetMigration}`
        : `No applied migrations found in ${dbPath}`,
    );
  }

  const { migrator, db } = createAgentsMigrator(dbPath);

  try {
    const { error, results } = await migrator.migrateDown();
    if (error) {
      throw error;
    }

    const successful = results?.find((result) => result.status === "Success")?.migrationName ?? null;
    if (successful !== targetMigration) {
      throw new Error(
        successful
          ? `Rolled back ${successful} instead of ${targetMigration}`
          : `No migration was rolled back for ${dbPath}`,
      );
    }

    return { rolledBack: successful };
  } finally {
    await db.destroy();
  }
}

export async function bulkRollbackAgentsDbMigration(options: BulkRollbackOptions): Promise<BulkRollbackResult[]> {
  const workspaces = listWorkspaceAgentsDatabases(options.dataDbPath, options.birdhouseRoot);
  const results: BulkRollbackResult[] = [];

  for (const workspace of workspaces) {
    if (!workspace.exists) {
      results.push({
        workspaceId: workspace.workspaceId,
        title: workspace.title,
        agentsDbPath: workspace.agentsDbPath,
        status: "missing_db",
        appliedMigrations: [],
      });
      continue;
    }

    try {
      const appliedMigrations = getAppliedAgentsDbMigrations(workspace.agentsDbPath);
      const latestAppliedMigration = appliedMigrations[appliedMigrations.length - 1];

      if (!appliedMigrations.includes(options.targetMigration)) {
        results.push({
          workspaceId: workspace.workspaceId,
          title: workspace.title,
          agentsDbPath: workspace.agentsDbPath,
          status: "not_applied",
          latestAppliedMigration,
          appliedMigrations,
        });
        continue;
      }

      if (latestAppliedMigration !== options.targetMigration) {
        results.push({
          workspaceId: workspace.workspaceId,
          title: workspace.title,
          agentsDbPath: workspace.agentsDbPath,
          status: "not_latest",
          latestAppliedMigration,
          appliedMigrations,
        });
        continue;
      }

      if (!options.execute) {
        results.push({
          workspaceId: workspace.workspaceId,
          title: workspace.title,
          agentsDbPath: workspace.agentsDbPath,
          status: "dry_run",
          latestAppliedMigration,
          appliedMigrations,
        });
        continue;
      }

      await rollbackSpecificAgentsDbMigration(workspace.agentsDbPath, options.targetMigration);

      results.push({
        workspaceId: workspace.workspaceId,
        title: workspace.title,
        agentsDbPath: workspace.agentsDbPath,
        status: "rolled_back",
        latestAppliedMigration,
        appliedMigrations,
      });
    } catch (error) {
      results.push({
        workspaceId: workspace.workspaceId,
        title: workspace.title,
        agentsDbPath: workspace.agentsDbPath,
        status: "failed",
        appliedMigrations: workspace.exists ? getAppliedAgentsDbMigrations(workspace.agentsDbPath) : [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
