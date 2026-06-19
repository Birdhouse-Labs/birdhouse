// ABOUTME: Adds origin_host column to access_tokens for device display
// ABOUTME: Stores the Host header from the pairing request (e.g. home.crayment.com:50100)

import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`ALTER TABLE access_tokens ADD COLUMN origin_host TEXT`.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  // SQLite cannot DROP COLUMN before 3.35 — rebuild the table without origin_host
  await sql`DROP TABLE IF EXISTS access_tokens_old`.execute(db);
  await sql`ALTER TABLE access_tokens RENAME TO access_tokens_old`.execute(db);
  await sql`
    CREATE TABLE access_tokens (
      token_hash TEXT PRIMARY KEY,
      device_label TEXT,
      created_at TEXT NOT NULL,
      last_used TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      user_agent TEXT
    )
  `.execute(db);
  await sql`
    INSERT INTO access_tokens (token_hash, device_label, created_at, last_used, is_active, user_agent)
    SELECT token_hash, device_label, created_at, last_used, is_active, user_agent
    FROM access_tokens_old
  `.execute(db);
  await sql`DROP TABLE access_tokens_old`.execute(db);
  await sql`CREATE INDEX idx_access_tokens_is_active ON access_tokens(is_active)`.execute(db);
}
