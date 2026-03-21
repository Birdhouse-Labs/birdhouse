// ABOUTME: Tests for data.db Kysely migration runner
// ABOUTME: Verifies migrations apply correctly to fresh and pre-existing databases

import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMigrations } from "./run-migrations";

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

function getMigrationNames(dbPath: string): string[] {
  const db = new Database(dbPath);
  const rows = db.query<{ name: string }, []>("SELECT name FROM kysely_migration ORDER BY name").all();
  db.close();
  return rows.map((r) => r.name);
}

function tempDbPath(): string {
  return join(tmpdir(), `data-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

const fixturesDir = join(import.meta.dir, "__fixtures__");

// ============================================================================
// Fresh database
// ============================================================================

describe("runMigrations — fresh database", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = tempDbPath();
  });

  test("creates all expected tables", async () => {
    await runMigrations(dbPath);
    const tables = getTables(dbPath);
    expect(tables).toContain("workspaces");
    expect(tables).toContain("workspace_secrets");
    expect(tables).toContain("user_profile");
    expect(tables).toContain("installation");
    expect(tables).toContain("skill_trigger_phrases");
  });

  test("workspaces table has all expected columns", async () => {
    await runMigrations(dbPath);
    const cols = getColumns(dbPath, "workspaces");
    expect(cols).toContain("workspace_id");
    expect(cols).toContain("directory");
    expect(cols).toContain("title");
    expect(cols).toContain("opencode_port");
    expect(cols).toContain("opencode_pid");
    expect(cols).toContain("created_at");
    expect(cols).toContain("last_used");
  });

  test("workspace_secrets uses plaintext secrets column (not encrypted blob)", async () => {
    await runMigrations(dbPath);
    const cols = getColumns(dbPath, "workspace_secrets");
    expect(cols).toContain("secrets");
    expect(cols).not.toContain("secrets_encrypted");
  });

  test("skill_trigger_phrases table has expected columns", async () => {
    await runMigrations(dbPath);
    const cols = getColumns(dbPath, "skill_trigger_phrases");
    expect(cols).toContain("skill_name");
    expect(cols).toContain("trigger_phrases_json");
    expect(cols).toContain("updated_at");
  });

  test("records all three migrations in kysely_migration table", async () => {
    await runMigrations(dbPath);
    const migrations = getMigrationNames(dbPath);
    expect(migrations).toContain("2026-02-28_000_initial_schema");
    expect(migrations).toContain("2026-03-03_001_plaintext_secrets");
    expect(migrations).toContain("2026-03-14_002_skill_trigger_phrases");
  });

  test("is idempotent — running twice does not error", async () => {
    await runMigrations(dbPath);
    await runMigrations(dbPath);
    const tables = getTables(dbPath);
    expect(tables).toContain("workspaces");
  });
});

// ============================================================================
// data-dev-snapshot.db — real-world DB with all three migrations already applied
// ============================================================================

describe("runMigrations — data-dev-snapshot.db", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = tempDbPath();
    copyFileSync(join(fixturesDir, "data-dev-snapshot.db"), dbPath);
  });

  test("runs without error on existing schema", async () => {
    await expect(runMigrations(dbPath)).resolves.toBeUndefined();
  });

  test("existing data is intact after migration", async () => {
    await runMigrations(dbPath);
    const db = new Database(dbPath);
    // kysely_migration should still have all three applied migrations
    const migrations = db.query<{ name: string }, []>("SELECT name FROM kysely_migration ORDER BY name").all();
    db.close();
    expect(migrations).toHaveLength(3);
  });

  test("schema matches expected state — no regressions", async () => {
    await runMigrations(dbPath);
    const cols = getColumns(dbPath, "workspace_secrets");
    expect(cols).toContain("secrets");
    expect(cols).not.toContain("secrets_encrypted");
    expect(getColumns(dbPath, "skill_trigger_phrases")).toContain("trigger_phrases_json");
  });

  test("no new migrations applied — all were already recorded", async () => {
    await runMigrations(dbPath);
    const migrations = getMigrationNames(dbPath);
    // Exactly the three known migrations, nothing more
    expect(migrations).toEqual([
      "2026-02-28_000_initial_schema",
      "2026-03-03_001_plaintext_secrets",
      "2026-03-14_002_skill_trigger_phrases",
    ]);
  });

  test("is idempotent — running twice does not error or change state", async () => {
    await runMigrations(dbPath);
    await runMigrations(dbPath);
    const migrations = getMigrationNames(dbPath);
    expect(migrations).toHaveLength(3);
  });
});
