// ABOUTME: Migration: add harness_type to agents with an opencode default.
// ABOUTME: Recreates the agents table on rollback to preserve existing indexes and constraints.

import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`ALTER TABLE agents ADD COLUMN harness_type TEXT NOT NULL DEFAULT 'opencode'`.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`DROP TABLE IF EXISTS agents_broken`.execute(db);
  await sql`ALTER TABLE agents RENAME TO agents_broken`.execute(db);
  await sql`
    CREATE TABLE agents (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      parent_id TEXT,
      tree_id TEXT NOT NULL,
      level INTEGER NOT NULL,
      title TEXT NOT NULL,
      project_id TEXT NOT NULL,
      directory TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      cloned_from TEXT REFERENCES agents(id) ON DELETE SET NULL,
      cloned_at INTEGER,
      archived_at INTEGER,
      FOREIGN KEY (parent_id) REFERENCES agents(id) ON DELETE CASCADE
    )
  `.execute(db);
  await sql`
    INSERT INTO agents
    SELECT id, session_id, parent_id, tree_id, level, title, project_id,
           directory, model, created_at, updated_at, cloned_from, cloned_at, archived_at
    FROM agents_broken
  `.execute(db);
  await sql`DROP TABLE agents_broken`.execute(db);
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_session_id ON agents(session_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_agents_directory ON agents(directory)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_agents_tree_updated ON agents(tree_id DESC, level ASC, updated_at DESC)`.execute(
    db,
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_agents_tree_created ON agents(tree_id DESC, level ASC, created_at DESC)`.execute(
    db,
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_agents_cloned_from ON agents(cloned_from)`.execute(db);
}
