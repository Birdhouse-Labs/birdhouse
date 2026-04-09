// ABOUTME: Tests the guarded bulk rollback helper against isolated temp Birdhouse databases.
// ABOUTME: Verifies dry-run discovery and execute-mode rollback without touching real local workspaces.

import Database from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentsMigrator } from "../src/lib/agents-db-migrations/run-agents-db-migrations";
import { runMigrations } from "../src/lib/migrations/run-migrations";
import { DataDB, type Workspace } from "../src/lib/data-db";
import {
  bulkRollbackAgentsDbMigration,
  getAppliedAgentsDbMigrations,
  listWorkspaceAgentsDatabases,
} from "./db-migrate-down-agents-all-lib";

const TARGET_MIGRATION = "20260403173314_harness_type";
const PREVIOUS_MIGRATION = "20260321144612_composer_drafts";

function getAgentColumnNames(dbPath: string): string[] {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db.query<{ name: string }, []>("PRAGMA table_info(agents)").all().map((row) => row.name);
  } finally {
    db.close();
  }
}

async function migrateAgentsDbTo(dbPath: string, migrationName?: string): Promise<void> {
  const { migrator, db } = createAgentsMigrator(dbPath);
  try {
    if (migrationName) {
      const result = await migrator.migrateTo(migrationName);
      if (result.error) {
        throw result.error;
      }
      return;
    }

    const result = await migrator.migrateToLatest();
    if (result.error) {
      throw result.error;
    }
  } finally {
    await db.destroy();
  }
}

describe("bulkRollbackAgentsDbMigration", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  async function createIsolatedBirdhouseRoot(): Promise<{
    root: string;
    dataDbPath: string;
    addWorkspace: (workspaceId: string, withAgentsDb: boolean, latestMigration?: string) => Promise<string>;
  }> {
    const root = mkdtempSync(join(tmpdir(), "birdhouse-bulk-rollback-"));
    tempRoots.push(root);
    const workspacesRoot = join(root, "workspaces");
    mkdirSync(workspacesRoot, { recursive: true });

    const dataDbPath = join(root, "data.db");
    await runMigrations(dataDbPath);
    const dataDb = new DataDB(dataDbPath);

    const addWorkspace = async (
      workspaceId: string,
      withAgentsDb: boolean,
      latestMigration = TARGET_MIGRATION,
    ): Promise<string> => {
      const workspaceDir = join(root, "workspace-directories", workspaceId);
      mkdirSync(workspaceDir, { recursive: true });

      const workspace: Workspace = {
        workspace_id: workspaceId,
        directory: workspaceDir,
        title: workspaceId,
        opencode_port: null,
        opencode_pid: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      };
      dataDb.insertWorkspace(workspace);

      const agentsDbPath = join(workspacesRoot, workspaceId, "agents.db");
      if (withAgentsDb) {
        mkdirSync(join(workspacesRoot, workspaceId), { recursive: true });
        await migrateAgentsDbTo(
          agentsDbPath,
          latestMigration === TARGET_MIGRATION ? undefined : PREVIOUS_MIGRATION,
        );
      }

      return agentsDbPath;
    };

    return { root, dataDbPath, addWorkspace };
  }

  test("discovers workspace agents.db paths from data.db", async () => {
    const isolated = await createIsolatedBirdhouseRoot();
    const firstPath = await isolated.addWorkspace("ws_first", true);
    await isolated.addWorkspace("ws_missing", false);

    const discovered = listWorkspaceAgentsDatabases(isolated.dataDbPath, isolated.root).sort((a, b) =>
      a.workspaceId.localeCompare(b.workspaceId),
    );

    expect(discovered).toEqual([
      {
        workspaceId: "ws_first",
        title: "ws_first",
        agentsDbPath: firstPath,
        exists: true,
      },
      {
        workspaceId: "ws_missing",
        title: "ws_missing",
        agentsDbPath: join(isolated.root, "workspaces", "ws_missing", "agents.db"),
        exists: false,
      },
    ]);
  });

  test("dry run reports only databases where the target migration is the latest applied migration", async () => {
    const isolated = await createIsolatedBirdhouseRoot();
    const latestPath = await isolated.addWorkspace("ws_latest", true, TARGET_MIGRATION);
    const oldPath = await isolated.addWorkspace("ws_old", true, PREVIOUS_MIGRATION);
    await isolated.addWorkspace("ws_missing", false);

    const results = (await bulkRollbackAgentsDbMigration({
      targetMigration: TARGET_MIGRATION,
      execute: false,
      dataDbPath: isolated.dataDbPath,
      birdhouseRoot: isolated.root,
    })).sort((a, b) => a.workspaceId.localeCompare(b.workspaceId));

    expect(results.map((result) => ({ workspaceId: result.workspaceId, status: result.status }))).toEqual([
      { workspaceId: "ws_latest", status: "dry_run" },
      { workspaceId: "ws_missing", status: "missing_db" },
      { workspaceId: "ws_old", status: "not_applied" },
    ]);
    expect(getAppliedAgentsDbMigrations(latestPath)).toContain(TARGET_MIGRATION);
    expect(getAppliedAgentsDbMigrations(oldPath)).not.toContain(TARGET_MIGRATION);
  });

  test("execute mode rolls back the target migration and removes the harness_type column", async () => {
    const isolated = await createIsolatedBirdhouseRoot();
    const latestPath = await isolated.addWorkspace("ws_latest", true, TARGET_MIGRATION);

    const beforeMigrations = getAppliedAgentsDbMigrations(latestPath);
    expect(beforeMigrations.at(-1)).toBe(TARGET_MIGRATION);
    expect(getAgentColumnNames(latestPath)).toContain("harness_type");

    const results = await bulkRollbackAgentsDbMigration({
      targetMigration: TARGET_MIGRATION,
      execute: true,
      dataDbPath: isolated.dataDbPath,
      birdhouseRoot: isolated.root,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("rolled_back");
    expect(getAppliedAgentsDbMigrations(latestPath)).not.toContain(TARGET_MIGRATION);
    expect(getAgentColumnNames(latestPath)).not.toContain("harness_type");
  });
});
