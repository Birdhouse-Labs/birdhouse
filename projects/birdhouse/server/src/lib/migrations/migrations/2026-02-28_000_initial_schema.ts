// ABOUTME: Complete current database schema for Birdhouse data.db
// ABOUTME: All tables use IF NOT EXISTS so this is safe to run against existing databases

import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  // workspaces table
  await sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      workspace_id TEXT PRIMARY KEY,
      directory TEXT NOT NULL UNIQUE,
      title TEXT,
      opencode_port INTEGER,
      opencode_pid INTEGER,
      created_at TEXT NOT NULL,
      last_used TEXT NOT NULL
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_workspaces_directory
    ON workspaces(directory)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_workspaces_opencode_port
    ON workspaces(opencode_port)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_workspaces_last_used
    ON workspaces(last_used)
  `.execute(db);

  // workspace_secrets table
  await sql`
    CREATE TABLE IF NOT EXISTS workspace_secrets (
      workspace_id TEXT PRIMARY KEY,
      secrets_encrypted BLOB NOT NULL,
      config_updated_at INTEGER,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id) ON DELETE CASCADE
    )
  `.execute(db);

  // user_profile table — single row keyed on id=1
  await sql`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `.execute(db);

  // installation table — single row keyed on id=1
  await sql`
    CREATE TABLE IF NOT EXISTS installation (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      install_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`DROP TABLE IF EXISTS workspace_secrets`.execute(db);
  await sql`DROP TABLE IF EXISTS workspaces`.execute(db);
  await sql`DROP TABLE IF EXISTS user_profile`.execute(db);
  await sql`DROP TABLE IF EXISTS installation`.execute(db);
}
