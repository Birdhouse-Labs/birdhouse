// ABOUTME: Tests for agents.db Kysely migration runner
// ABOUTME: Verifies migrations apply correctly to fresh and pre-existing databases

import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentsMigrator, runAgentsDbMigrations } from "./run-agents-db-migrations";

// ============================================================================
// Helpers
// ============================================================================

function getTables(dbPath: string): string[] {
  const db = new Database(dbPath);
  const rows = db.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  db.close();
  return rows.map((r) => r.name);
}

function getColumns(dbPath: string, table: string): string[] {
  const db = new Database(dbPath);
  const rows = db.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all();
  db.close();
  return rows.map((r) => r.name);
}

function getIndexes(dbPath: string): string[] {
  const db = new Database(dbPath);
  const rows = db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all();
  db.close();
  return rows.map((r) => r.name);
}

function getAgentsForeignKeyTables(dbPath: string): string[] {
  const db = new Database(dbPath);
  try {
    const rows = db.query<{ table: string }, []>("PRAGMA foreign_key_list(agents)").all();
    return rows.map((row) => row.table);
  } finally {
    db.close();
  }
}

function getMigrationNames(dbPath: string): string[] {
  const db = new Database(dbPath);
  try {
    const rows = db.query<{ name: string }, []>("SELECT name FROM kysely_migration ORDER BY name").all();
    db.close();
    return rows.map((r) => r.name);
  } catch {
    db.close();
    return [];
  }
}

function getAgentCount(dbPath: string): number {
  const db = new Database(dbPath);
  const row = db.query<{ c: number }, []>("SELECT COUNT(*) as c FROM agents").get();
  db.close();
  return row?.c ?? 0;
}

function tempDbPath(): string {
  return join(tmpdir(), `agents-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

const fixturesDir = join(import.meta.dir, "__fixtures__");

// ============================================================================
// Fresh database
// ============================================================================

describe("runAgentsDbMigrations — fresh database", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = tempDbPath();
  });

  test("creates agents and agent_events tables", async () => {
    await runAgentsDbMigrations(dbPath);
    const tables = getTables(dbPath);
    expect(tables).toContain("agents");
    expect(tables).toContain("agent_events");
  });

  test("agents table has all expected columns", async () => {
    await runAgentsDbMigrations(dbPath);
    const cols = getColumns(dbPath, "agents");
    expect(cols).toContain("id");
    expect(cols).toContain("session_id");
    expect(cols).toContain("parent_id");
    expect(cols).toContain("tree_id");
    expect(cols).toContain("level");
    expect(cols).toContain("title");
    expect(cols).toContain("project_id");
    expect(cols).toContain("directory");
    expect(cols).toContain("model");
    expect(cols).toContain("harness_type");
    expect(cols).toContain("created_at");
    expect(cols).toContain("updated_at");
    expect(cols).toContain("cloned_from");
    expect(cols).toContain("cloned_at");
    expect(cols).toContain("archived_at");
  });

  test("agent_events table has all expected columns", async () => {
    await runAgentsDbMigrations(dbPath);
    const cols = getColumns(dbPath, "agent_events");
    expect(cols).toContain("id");
    expect(cols).toContain("agent_id");
    expect(cols).toContain("event_type");
    expect(cols).toContain("timestamp");
    expect(cols).toContain("actor_agent_id");
    expect(cols).toContain("actor_agent_title");
    expect(cols).toContain("source_agent_id");
    expect(cols).toContain("source_agent_title");
    expect(cols).toContain("target_agent_id");
    expect(cols).toContain("target_agent_title");
    expect(cols).toContain("metadata");
  });

  test("creates all expected indexes", async () => {
    await runAgentsDbMigrations(dbPath);
    const indexes = getIndexes(dbPath);
    expect(indexes).toContain("idx_agents_session_id");
    expect(indexes).toContain("idx_agents_directory");
    expect(indexes).toContain("idx_agents_tree_updated");
    expect(indexes).toContain("idx_agents_tree_created");
    expect(indexes).toContain("idx_agents_cloned_from");
    expect(indexes).toContain("idx_agent_events_agent_timestamp");
    expect(indexes).toContain("idx_agent_events_actor");
    expect(indexes).toContain("idx_agent_events_source");
    expect(indexes).toContain("idx_agent_events_target");
  });

  test("records migration in kysely_migration table", async () => {
    await runAgentsDbMigrations(dbPath);
    const migrations = getMigrationNames(dbPath);
    expect(migrations).toContain("20260320000000_initial_schema");
    expect(migrations).toContain("20260321144612_composer_drafts");
    expect(migrations).toContain("20260403173314_harness_type");
  });

  test("creates composer_drafts and composer_draft_attachments tables", async () => {
    await runAgentsDbMigrations(dbPath);
    const tables = getTables(dbPath);
    expect(tables).toContain("composer_drafts");
    expect(tables).toContain("composer_draft_attachments");
  });

  test("composer_drafts table has all expected columns", async () => {
    await runAgentsDbMigrations(dbPath);
    const cols = getColumns(dbPath, "composer_drafts");
    expect(cols).toContain("draft_id");
    expect(cols).toContain("context");
    expect(cols).toContain("text");
    expect(cols).toContain("updated_at");
  });

  test("composer_draft_attachments table has all expected columns", async () => {
    await runAgentsDbMigrations(dbPath);
    const cols = getColumns(dbPath, "composer_draft_attachments");
    expect(cols).toContain("id");
    expect(cols).toContain("draft_id");
    expect(cols).toContain("filename");
    expect(cols).toContain("mime");
    expect(cols).toContain("url");
    expect(cols).toContain("position");
  });

  test("creates idx_draft_attachments_draft_id index", async () => {
    await runAgentsDbMigrations(dbPath);
    const indexes = getIndexes(dbPath);
    expect(indexes).toContain("idx_draft_attachments_draft_id");
  });

  test("is idempotent — running twice does not error", async () => {
    await runAgentsDbMigrations(dbPath);
    await runAgentsDbMigrations(dbPath);
    const tables = getTables(dbPath);
    expect(tables).toContain("agents");
    expect(tables).toContain("agent_events");
    expect(tables).toContain("composer_drafts");
    expect(tables).toContain("composer_draft_attachments");
  });
});

// ============================================================================
// demo-snapshot.db — real-world DB with 291 agents, all bespoke migrations applied
// ============================================================================

describe("runAgentsDbMigrations — demo-snapshot.db", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = tempDbPath();
    copyFileSync(join(fixturesDir, "demo-snapshot.db"), dbPath);
  });

  test("runs without error on existing schema", async () => {
    await expect(runAgentsDbMigrations(dbPath)).resolves.toBeUndefined();
  });

  test("existing data is intact after migration", async () => {
    await runAgentsDbMigrations(dbPath);
    const db = new Database(dbPath);
    const count = db.query<{ c: number }, []>("SELECT COUNT(*) as c FROM agents").get();
    db.close();
    expect(count?.c).toBeGreaterThan(0);
  });

  test("schema matches expected state after migration", async () => {
    await runAgentsDbMigrations(dbPath);
    const cols = getColumns(dbPath, "agents");
    expect(cols).toContain("cloned_from");
    expect(cols).toContain("cloned_at");
    expect(cols).toContain("archived_at");
    const eventCols = getColumns(dbPath, "agent_events");
    expect(eventCols).toContain("actor_agent_id");
  });

  test("applies composer_drafts migration to existing DB", async () => {
    await runAgentsDbMigrations(dbPath);
    const migrations = getMigrationNames(dbPath);
    expect(migrations).toEqual([
      "20260320000000_initial_schema",
      "20260321144612_composer_drafts",
      "20260403173314_harness_type",
    ]);
  });

  test("is idempotent — running twice does not error or change state", async () => {
    await runAgentsDbMigrations(dbPath);
    await runAgentsDbMigrations(dbPath);
    const migrations = getMigrationNames(dbPath);
    expect(migrations).toHaveLength(3);
  });

  test("can roll back harness_type migration on a real fixture snapshot without losing rows or indexes", async () => {
    await runAgentsDbMigrations(dbPath);

    const beforeCount = getAgentCount(dbPath);
    const beforeIndexes = getIndexes(dbPath);

    const { migrator, db } = createAgentsMigrator(dbPath);
    const result = await migrator.migrateDown();
    await db.destroy();

    expect(result.error).toBeUndefined();
    expect(result.results?.find((it) => it.status === "Success")?.migrationName).toBe("20260403173314_harness_type");
    expect(getMigrationNames(dbPath)).toEqual(["20260320000000_initial_schema", "20260321144612_composer_drafts"]);
    expect(getColumns(dbPath, "agents")).not.toContain("harness_type");
    expect(getAgentCount(dbPath)).toBe(beforeCount);
    expect(getIndexes(dbPath)).toEqual(beforeIndexes);
  });

  test("can roll back and re-apply harness_type migration on a real fixture snapshot", async () => {
    await runAgentsDbMigrations(dbPath);

    const beforeCount = getAgentCount(dbPath);

    const { migrator, db } = createAgentsMigrator(dbPath);
    const downResult = await migrator.migrateDown();
    expect(downResult.error).toBeUndefined();

    const upResult = await migrator.migrateToLatest();
    await db.destroy();

    expect(upResult.error).toBeUndefined();
    expect(getMigrationNames(dbPath)).toEqual([
      "20260320000000_initial_schema",
      "20260321144612_composer_drafts",
      "20260403173314_harness_type",
    ]);
    expect(getColumns(dbPath, "agents")).toContain("harness_type");
    expect(getAgentCount(dbPath)).toBe(beforeCount);
  });

  test("rollback keeps self-referential foreign keys pointing at agents", async () => {
    await runAgentsDbMigrations(dbPath);

    const beforeCount = getAgentCount(dbPath);
    const beforeIndexes = getIndexes(dbPath);

    const { migrator, db } = createAgentsMigrator(dbPath);
    const downResult = await migrator.migrateDown();
    await db.destroy();

    expect(downResult.error).toBeUndefined();
    expect(getMigrationNames(dbPath)).toEqual(["20260320000000_initial_schema", "20260321144612_composer_drafts"]);
    expect(getColumns(dbPath, "agents")).not.toContain("harness_type");
    expect(getAgentsForeignKeyTables(dbPath)).toEqual(["agents", "agents"]);
    expect(getAgentCount(dbPath)).toBe(beforeCount);
    expect(getIndexes(dbPath)).toEqual(beforeIndexes);
    expect(getColumns(dbPath, "agents")).not.toContain("harness_type");

    const dbAfterRepair = new Database(dbPath);
    try {
      dbAfterRepair
        .query(
          `
            INSERT INTO agents (
              id, session_id, parent_id, tree_id, level,
              title, project_id, directory, model,
              created_at, updated_at, cloned_from, cloned_at, archived_at
            ) VALUES (
              $id, $session_id, $parent_id, $tree_id, $level,
              $title, $project_id, $directory, $model,
              $created_at, $updated_at, $cloned_from, $cloned_at, $archived_at
            )
          `,
        )
        .run({
          $id: "agent_repair_test",
          $session_id: "ses_repair_test",
          $parent_id: null,
          $tree_id: "agent_repair_test",
          $level: 0,
          $title: "Repair Test",
          $project_id: "project_repair",
          $directory: "/tmp/repair-test",
          $model: "test-model",
          $created_at: 1,
          $updated_at: 1,
          $cloned_from: null,
          $cloned_at: null,
          $archived_at: null,
        });
    } finally {
      dbAfterRepair.close();
    }

    expect(getAgentCount(dbPath)).toBe(beforeCount + 1);
  });
});

// ============================================================================
// small-snapshot.db — smaller real-world DB, same schema
// ============================================================================

describe("runAgentsDbMigrations — small-snapshot.db", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = tempDbPath();
    copyFileSync(join(fixturesDir, "small-snapshot.db"), dbPath);
  });

  test("runs without error on existing schema", async () => {
    await expect(runAgentsDbMigrations(dbPath)).resolves.toBeUndefined();
  });

  test("existing data is intact after migration", async () => {
    await runAgentsDbMigrations(dbPath);
    const db = new Database(dbPath);
    const count = db.query<{ c: number }, []>("SELECT COUNT(*) as c FROM agents").get();
    db.close();
    expect(count?.c).toBeGreaterThan(0);
  });

  test("applies composer_drafts migration to existing DB", async () => {
    await runAgentsDbMigrations(dbPath);
    const migrations = getMigrationNames(dbPath);
    expect(migrations).toEqual([
      "20260320000000_initial_schema",
      "20260321144612_composer_drafts",
      "20260403173314_harness_type",
    ]);
  });

  test("is idempotent — running twice does not error or change state", async () => {
    await runAgentsDbMigrations(dbPath);
    await runAgentsDbMigrations(dbPath);
    const migrations = getMigrationNames(dbPath);
    expect(migrations).toHaveLength(3);
  });
});
