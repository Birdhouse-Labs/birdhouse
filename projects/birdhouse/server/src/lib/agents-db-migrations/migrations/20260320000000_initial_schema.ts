// ABOUTME: Complete agents.db schema as of March 2026 — agents, agent_events, all indexes
// ABOUTME: All statements use IF NOT EXISTS so this is safe to run against existing databases

import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  // agents table
  await sql`
    CREATE TABLE IF NOT EXISTS agents (
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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_session_id
      ON agents(session_id)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_agents_directory
      ON agents(directory)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_agents_tree_updated
      ON agents(tree_id DESC, level ASC, updated_at DESC)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_agents_tree_created
      ON agents(tree_id DESC, level ASC, created_at DESC)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_agents_cloned_from
      ON agents(cloned_from)
  `.execute(db);

  // agent_events table
  await sql`
    CREATE TABLE IF NOT EXISTS agent_events (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,

      actor_agent_id TEXT,
      actor_agent_title TEXT,

      source_agent_id TEXT,
      source_agent_title TEXT,

      target_agent_id TEXT,
      target_agent_title TEXT,

      metadata TEXT,

      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
      FOREIGN KEY (source_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
      FOREIGN KEY (target_agent_id) REFERENCES agents(id) ON DELETE SET NULL
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_agent_events_agent_timestamp
      ON agent_events(agent_id, timestamp DESC)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_agent_events_actor
      ON agent_events(actor_agent_id) WHERE actor_agent_id IS NOT NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_agent_events_source
      ON agent_events(source_agent_id) WHERE source_agent_id IS NOT NULL
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_agent_events_target
      ON agent_events(target_agent_id) WHERE target_agent_id IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`DROP TABLE IF EXISTS agent_events`.execute(db);
  await sql`DROP TABLE IF EXISTS agents`.execute(db);
}
