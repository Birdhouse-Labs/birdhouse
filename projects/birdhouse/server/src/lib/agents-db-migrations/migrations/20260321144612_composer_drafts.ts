// ABOUTME: Migration: adds composer_drafts and composer_draft_attachments tables
// ABOUTME: Stores per-surface draft text and attachments (images, PDFs) with ordering

import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS composer_drafts (
      draft_id   TEXT PRIMARY KEY,
      context    TEXT NOT NULL,
      text       TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS composer_draft_attachments (
      id       TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime     TEXT NOT NULL,
      url      TEXT NOT NULL,
      position INTEGER NOT NULL
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_draft_attachments_draft_id
      ON composer_draft_attachments(draft_id, position ASC)
  `.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`DROP TABLE IF EXISTS composer_draft_attachments`.execute(db);
  await sql`DROP TABLE IF EXISTS composer_drafts`.execute(db);
}
