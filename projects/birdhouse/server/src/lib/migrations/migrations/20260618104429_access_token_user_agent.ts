// ABOUTME: Migration to add user_agent column and make device_label nullable on access_tokens.
// ABOUTME: SQLite requires table recreation to change column nullability.

import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  // SQLite cannot ALTER COLUMN to drop NOT NULL — requires table recreation.
  // Rename old table, create replacement with the final name, copy rows, drop old.
  // Wrapped in an explicit transaction because Kysely's SQLite migrator does not
  // use one automatically (supportsTransactionalDdl = false). SQLite supports
  // transactional DDL, so this keeps the database consistent if the process crashes
  // mid-migration.
  return db.transaction().execute(async (trx) => {
    await sql`ALTER TABLE access_tokens RENAME TO access_tokens_old`.execute(trx);

    await sql`
      CREATE TABLE access_tokens (
        token_hash TEXT PRIMARY KEY,
        device_label TEXT,
        created_at TEXT NOT NULL,
        last_used TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        user_agent TEXT
      )
    `.execute(trx);

    await sql`
      INSERT INTO access_tokens (token_hash, device_label, created_at, last_used, is_active, user_agent)
      SELECT token_hash, device_label, created_at, last_used, is_active, NULL
      FROM access_tokens_old
    `.execute(trx);

    await sql`DROP TABLE access_tokens_old`.execute(trx);

    await sql`CREATE INDEX idx_access_tokens_is_active ON access_tokens(is_active)`.execute(trx);
  });
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  // Restore original schema: device_label NOT NULL, no user_agent column.
  // Explicit transaction for the same reason as up().
  return db.transaction().execute(async (trx) => {
    await sql`ALTER TABLE access_tokens RENAME TO access_tokens_old`.execute(trx);

    await sql`
      CREATE TABLE access_tokens (
        token_hash TEXT PRIMARY KEY,
        device_label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used TEXT,
        is_active INTEGER NOT NULL DEFAULT 1
      )
    `.execute(trx);

    await sql`
      INSERT INTO access_tokens (token_hash, device_label, created_at, last_used, is_active)
      SELECT token_hash, COALESCE(device_label, ''), created_at, last_used, is_active
      FROM access_tokens_old
    `.execute(trx);

    await sql`DROP TABLE access_tokens_old`.execute(trx);

    await sql`CREATE INDEX idx_access_tokens_is_active ON access_tokens(is_active)`.execute(trx);
  });
}
