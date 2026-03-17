// ABOUTME: Adds Birdhouse-owned trigger phrase storage for visible OpenCode skills.
// ABOUTME: Persists v1 skill metadata by skill name only so multiple workspaces can reuse it.

import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS skill_trigger_phrases (
      skill_name TEXT PRIMARY KEY,
      trigger_phrases_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`DROP TABLE IF EXISTS skill_trigger_phrases`.execute(db);
}
