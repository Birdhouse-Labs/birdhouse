// ABOUTME: Migration to create the access_tokens table in data.db.
// ABOUTME: Stores persistent remote access device credentials with revocation support.

import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`
    CREATE TABLE access_tokens (
      token_hash TEXT PRIMARY KEY,
      device_label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    )
  `.execute(db);

  await sql`CREATE INDEX idx_access_tokens_is_active ON access_tokens(is_active)`.execute(
    db,
  );
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`DROP TABLE IF EXISTS access_tokens`.execute(db);
}
