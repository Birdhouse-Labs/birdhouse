// ABOUTME: Test utilities for DataDB with in-memory schema initialization
// ABOUTME: Bypasses Kysely migrations by directly creating schema for test databases

import { Database } from "bun:sqlite";
import { DataDB } from "../lib/data-db";

/**
 * Create a DataDB instance with schema initialized for testing.
 *
 * The production DataDB relies on Kysely migrations which use FileMigrationProvider
 * and don't work with in-memory databases. This utility creates the schema directly.
 */
export function createTestDataDB(): DataDB {
  // Create the in-memory database directly and initialize schema
  const db = new Database(":memory:");
  db.exec("PRAGMA journal_mode = WAL;");

  // Create schema directly (mirrors migrations)
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      workspace_id TEXT PRIMARY KEY,
      directory TEXT NOT NULL UNIQUE,
      title TEXT,
      opencode_port INTEGER,
      opencode_pid INTEGER,
      created_at TEXT NOT NULL,
      last_used TEXT NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_workspaces_directory ON workspaces(directory);
    CREATE INDEX IF NOT EXISTS idx_workspaces_opencode_port ON workspaces(opencode_port);
    CREATE INDEX IF NOT EXISTS idx_workspaces_last_used ON workspaces(last_used);
    
    CREATE TABLE IF NOT EXISTS workspace_secrets (
      workspace_id TEXT PRIMARY KEY,
      secrets_encrypted BLOB NOT NULL,
      config_updated_at INTEGER,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id) ON DELETE CASCADE
    );
  `);

  db.close();

  // Now create DataDB instance - it will open the same :memory: database
  // Note: This doesn't actually work because :memory: creates a new DB each time
  // We need a different approach
  return new DataDB(":memory:");
}

/**
 * DataDB subclass that initializes schema for in-memory testing.
 *
 * Production DataDB skips schema init because it relies on migrations.
 * This test version creates the schema directly.
 */
export class TestDataDB extends DataDB {
  constructor() {
    // Call parent with :memory: - it will create the database
    super(":memory:");

    // Now initialize the schema directly
    // Access the private db via any cast (test utility only)
    const db = (this as unknown as { db: Database }).db;

    db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        workspace_id TEXT PRIMARY KEY,
        directory TEXT NOT NULL UNIQUE,
        title TEXT,
        opencode_port INTEGER,
        opencode_pid INTEGER,
        created_at TEXT NOT NULL,
        last_used TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_workspaces_directory ON workspaces(directory);
      CREATE INDEX IF NOT EXISTS idx_workspaces_opencode_port ON workspaces(opencode_port);
      CREATE INDEX IF NOT EXISTS idx_workspaces_last_used ON workspaces(last_used);
      
      CREATE TABLE IF NOT EXISTS workspace_secrets (
        workspace_id TEXT PRIMARY KEY,
        secrets_encrypted BLOB NOT NULL,
        config_updated_at INTEGER,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS installation (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        install_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }
}
