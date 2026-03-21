// ABOUTME: Tests for agents.db Kysely migration runner
// ABOUTME: Verifies migrations apply correctly to fresh and pre-existing databases

import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAgentsDbMigrations } from "./run-agents-db-migrations";

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
  });

  test("is idempotent — running twice does not error", async () => {
    await runAgentsDbMigrations(dbPath);
    await runAgentsDbMigrations(dbPath);
    const tables = getTables(dbPath);
    expect(tables).toContain("agents");
    expect(tables).toContain("agent_events");
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

  test("no new migrations applied — all were already recorded", async () => {
    await runAgentsDbMigrations(dbPath);
    const migrations = getMigrationNames(dbPath);
    expect(migrations).toEqual(["20260320000000_initial_schema"]);
  });

  test("is idempotent — running twice does not error or change state", async () => {
    await runAgentsDbMigrations(dbPath);
    await runAgentsDbMigrations(dbPath);
    const migrations = getMigrationNames(dbPath);
    expect(migrations).toHaveLength(1);
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

  test("no new migrations applied — all were already recorded", async () => {
    await runAgentsDbMigrations(dbPath);
    const migrations = getMigrationNames(dbPath);
    expect(migrations).toEqual(["20260320000000_initial_schema"]);
  });

  test("is idempotent — running twice does not error or change state", async () => {
    await runAgentsDbMigrations(dbPath);
    await runAgentsDbMigrations(dbPath);
    const migrations = getMigrationNames(dbPath);
    expect(migrations).toHaveLength(1);
  });
});
