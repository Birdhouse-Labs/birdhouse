// ABOUTME: Central database for workspace configuration and application data
// ABOUTME: SQLite database wrapper with workspace CRUD operations and future extensibility

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { log } from "./logger";
import { runMigrations } from "./migrations/run-migrations";
import { type McpServers, type ProviderCredentials, validateSecrets, type WorkspaceSecretsDecrypted } from "./secrets";

/**
 * Get platform-appropriate data directory for Birdhouse
 * - macOS: ~/Library/Application Support/Birdhouse
 * - Linux: ~/.local/share/birdhouse
 * - Windows: %APPDATA%/Birdhouse (via homedir)
 */
function getDataDir(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return join(homedir(), "Library/Application Support/Birdhouse");
  }
  if (platform === "win32") {
    return join(homedir(), "AppData/Roaming/Birdhouse");
  }
  // Linux and others: use XDG_DATA_HOME or default
  const xdgDataHome = process.env.XDG_DATA_HOME || join(homedir(), ".local/share");
  return join(xdgDataHome, "birdhouse");
}

const DATA_DIR = getDataDir();
const DB_PATH = join(DATA_DIR, "data.db");

export interface Workspace {
  workspace_id: string;
  directory: string;
  title?: string | null;
  opencode_port: number | null;
  opencode_pid: number | null;
  created_at: string;
  last_used: string;
}

export interface WorkspaceSecrets {
  workspace_id: string;
  secrets: string | null;
  config_updated_at?: number | null;
}

export interface UserProfile {
  id: 1;
  name: string;
  created_at: string;
}

/**
 * Central data database for Birdhouse
 * Manages workspaces, secrets, and future application data
 */
export class DataDB {
  private db: Database;

  constructor(dbPath: string = DB_PATH) {
    // Ensure directory exists
    const dir = join(dbPath, "..");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");

    this.initSchema();

    log.server.info({ dbPath }, "Data database initialized");
  }

  private initSchema(): void {
    // NOTE: Schema creation is now handled by Kysely migrations
    // This method is kept for backwards compatibility but does nothing
    // All schema changes should go through migrations in migrations/migrations/
    // We still ensure WAL mode and other pragmas are set
    // (already done in constructor)
  }

  // ==================== Workspace Operations ====================

  getWorkspaceById(workspaceId: string): Workspace | null {
    const stmt = this.db.query<Workspace, [string]>("SELECT * FROM workspaces WHERE workspace_id = ?");
    return stmt.get(workspaceId) || null;
  }

  getWorkspaceByDirectory(directory: string): Workspace | null {
    const stmt = this.db.query<Workspace, [string]>("SELECT * FROM workspaces WHERE directory = ?");
    return stmt.get(directory) || null;
  }

  getAllWorkspaces(): Workspace[] {
    const stmt = this.db.query<Workspace, []>("SELECT * FROM workspaces ORDER BY last_used DESC");
    return stmt.all();
  }

  insertWorkspace(workspace: Workspace): void {
    const stmt = this.db.prepare(`
      INSERT INTO workspaces (
        workspace_id, directory, title, opencode_port, opencode_pid,
        created_at, last_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      workspace.workspace_id,
      workspace.directory,
      workspace.title ?? null,
      workspace.opencode_port,
      workspace.opencode_pid,
      workspace.created_at,
      workspace.last_used,
    );

    log.server.info({ workspaceId: workspace.workspace_id, directory: workspace.directory }, "Workspace inserted");
  }

  updateWorkspace(workspaceId: string, updates: Partial<Omit<Workspace, "workspace_id" | "created_at">>): void {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const values: (string | number | null)[] = fields.map((field) => {
      const value = updates[field as keyof typeof updates];
      return value === undefined ? null : value;
    });

    const stmt = this.db.prepare(`UPDATE workspaces SET ${setClause} WHERE workspace_id = ?`);

    stmt.run(...values, workspaceId);

    log.server.debug({ workspaceId, updates }, "Workspace updated");
  }

  deleteWorkspace(workspaceId: string): void {
    const stmt = this.db.prepare("DELETE FROM workspaces WHERE workspace_id = ?");
    stmt.run(workspaceId);

    log.server.info({ workspaceId }, "Workspace deleted");
  }

  // ==================== Workspace Secrets Operations ====================

  getWorkspaceSecrets(workspaceId: string): string | null {
    const stmt = this.db.query<{ secrets: string | null }, [string]>(
      "SELECT secrets FROM workspace_secrets WHERE workspace_id = ?",
    );
    const row = stmt.get(workspaceId);
    return row ? row.secrets : null;
  }

  setWorkspaceSecrets(workspaceId: string, secrets: string): void {
    log.server.debug({ workspaceId }, "setWorkspaceSecrets called");

    const stmt = this.db.prepare(
      "INSERT OR REPLACE INTO workspace_secrets (workspace_id, secrets, config_updated_at) VALUES (?, ?, ?)",
    );

    stmt.run(workspaceId, secrets, Date.now());

    log.server.debug({ workspaceId }, "Workspace secrets stored");
  }

  deleteWorkspaceSecrets(workspaceId: string): void {
    const stmt = this.db.prepare("DELETE FROM workspace_secrets WHERE workspace_id = ?");
    stmt.run(workspaceId);

    log.server.debug({ workspaceId }, "Workspace secrets deleted");
  }

  // ==================== High-Level Secrets API ====================

  /**
   * Get workspace configuration (providers + MCP)
   * Returns null if no secrets exist or JSON is invalid
   */
  getWorkspaceConfig(workspaceId: string): WorkspaceSecretsDecrypted | null {
    const json = this.getWorkspaceSecrets(workspaceId);
    if (!json) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      log.server.warn({ workspaceId }, "Failed to parse workspace secrets JSON");
      return null;
    }

    if (!validateSecrets(parsed)) {
      log.server.warn({ workspaceId }, "Invalid workspace secrets structure");
      return null;
    }

    return parsed;
  }

  /**
   * Update workspace configuration (partial update)
   * Merges with existing config, encrypts, and stores
   */
  updateWorkspaceConfig(workspaceId: string, updates: Partial<WorkspaceSecretsDecrypted>): void {
    // DIAGNOSTIC: Log what we received
    log.server.debug(
      {
        workspaceId,
        updateKeys: Object.keys(updates),
        hasProviders: !!updates.providers,
        providerKeys: updates.providers ? Object.keys(updates.providers) : [],
        hasMcp: "mcp" in updates,
      },
      "updateWorkspaceConfig called",
    );

    // Load existing config or start fresh
    const existing = this.getWorkspaceConfig(workspaceId) || {};

    // Merge updates
    const merged: WorkspaceSecretsDecrypted = {
      ...existing,
    };

    // Handle providers merge — empty string api_key signals deletion, non-empty strings are upserts
    if (updates.providers !== undefined) {
      const base: Record<string, { api_key: string }> = {
        ...(existing.providers as Record<string, { api_key: string }>),
      };
      for (const [id, creds] of Object.entries(updates.providers)) {
        if (creds && creds.api_key === "") {
          delete base[id];
        } else if (creds) {
          base[id] = creds;
        }
      }
      merged.providers = base as ProviderCredentials;
      log.server.debug({ workspaceId, mergedProviders: Object.keys(merged.providers) }, "Merged providers");
    }

    // Handle MCP merge (replace entire MCP config if provided)
    // Note: undefined in updates means "don't change", but we need to handle explicit removal
    if ("mcp" in updates) {
      merged.mcp = updates.mcp;
    }

    // Remove undefined or empty top-level keys
    if (merged.providers !== undefined && Object.keys(merged.providers).length === 0) {
      delete merged.providers;
    }
    if (merged.mcp === undefined) {
      delete merged.mcp;
    }

    // Serialize and store
    this.setWorkspaceSecrets(workspaceId, JSON.stringify(merged));

    log.server.info({ workspaceId }, "Workspace config updated");
  }

  /**
   * Get just the provider credentials for a workspace
   */
  getWorkspaceProviders(workspaceId: string): ProviderCredentials | null {
    const config = this.getWorkspaceConfig(workspaceId);
    return config?.providers || null;
  }

  /**
   * Update just the provider credentials (partial update - merges providers)
   */
  updateWorkspaceProviders(workspaceId: string, providers: Partial<ProviderCredentials>): void {
    this.updateWorkspaceConfig(workspaceId, { providers });
  }

  /**
   * Get just the MCP config for a workspace
   */
  getWorkspaceMcpConfig(workspaceId: string): McpServers | null {
    const config = this.getWorkspaceConfig(workspaceId);
    return config?.mcp || null;
  }

  /**
   * Update just the MCP config for a workspace (replaces entire config)
   */
  updateWorkspaceMcpConfig(workspaceId: string, mcp: McpServers | null): void {
    this.updateWorkspaceConfig(workspaceId, {
      mcp: mcp === null ? undefined : mcp,
    });
  }

  // ==================== Skill Trigger Phrase Operations ====================

  getSkillTriggerPhrases(skillName: string): string[] {
    const row = this.db
      .query<{ trigger_phrases_json: string }, [string]>(
        "SELECT trigger_phrases_json FROM skill_trigger_phrases WHERE skill_name = ?",
      )
      .get(skillName);

    if (!row) {
      return [];
    }

    try {
      const parsed = JSON.parse(row.trigger_phrases_json) as unknown;
      if (Array.isArray(parsed) && parsed.every((value) => typeof value === "string")) {
        return parsed;
      }
    } catch {
      log.server.warn({ skillName }, "Failed to parse skill trigger phrases JSON");
    }

    return [];
  }

  setSkillTriggerPhrases(skillName: string, triggerPhrases: string[]): void {
    if (triggerPhrases.length === 0) {
      this.db.prepare("DELETE FROM skill_trigger_phrases WHERE skill_name = ?").run(skillName);
      log.server.debug({ skillName }, "Deleted skill trigger phrases");
      return;
    }

    const updatedAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO skill_trigger_phrases (skill_name, trigger_phrases_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(skill_name) DO UPDATE SET
           trigger_phrases_json = excluded.trigger_phrases_json,
           updated_at = excluded.updated_at`,
      )
      .run(skillName, JSON.stringify(triggerPhrases), updatedAt);

    log.server.debug({ skillName, triggerPhrasesCount: triggerPhrases.length }, "Stored skill trigger phrases");
  }

  // ==================== User Profile Operations ====================

  getUserProfile(): UserProfile | null {
    const stmt = this.db.query<UserProfile, []>("SELECT * FROM user_profile WHERE id = 1");
    return stmt.get() || null;
  }

  getUserName(): string | null {
    const profile = this.getUserProfile();
    return profile?.name ?? null;
  }

  setUserName(name: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_profile (id, name, created_at)
      VALUES (1, ?, ?)
    `);
    stmt.run(name, new Date().toISOString());
    log.server.info({ name }, "User profile name set");
  }

  // ==================== Installation ID ====================

  /**
   * Returns the stable install_id for this Birdhouse installation.
   * Generates and persists a new nanoid if none exists yet.
   */
  getOrCreateInstallId(): string {
    const row = this.db.query<{ install_id: string }, []>("SELECT install_id FROM installation WHERE id = 1").get();

    if (row) {
      return row.install_id;
    }

    const installId = nanoid();
    this.db
      .prepare("INSERT INTO installation (id, install_id, created_at) VALUES (1, ?, ?)")
      .run(installId, new Date().toISOString());

    log.server.info("Installation ID created");
    return installId;
  }

  // ==================== Utility ====================

  close(): void {
    this.db.close();
    log.server.info("Data database closed");
  }
}

// Singleton instance
let dataDb: DataDB | null = null;
let migrationsRun = false;

/**
 * Initialize the database with migrations
 * Must be called once before getDataDB()
 */
export async function initDataDB(): Promise<void> {
  if (migrationsRun) return;

  const dbPath = process.env.BIRDHOUSE_DATA_DB_PATH || DB_PATH;

  // Ensure directory exists
  const dir = join(dbPath, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Run migrations first
  await runMigrations(dbPath);
  migrationsRun = true;

  log.server.info("Database migrations completed");
}

export function getDataDB(): DataDB {
  if (!migrationsRun) {
    throw new Error("Database not initialized. Call await initDataDB() before getDataDB()");
  }

  if (!dataDb) {
    // Allow overriding database path via environment variable
    // Default: ~/Library/Application Support/Birdhouse/data.db
    // Dev:     Set BIRDHOUSE_DATA_DB_PATH to data-dev.db for isolation
    const dbPath = process.env.BIRDHOUSE_DATA_DB_PATH || DB_PATH;
    dataDb = new DataDB(dbPath);
  }
  return dataDb;
}

export { DATA_DIR, DB_PATH as DATA_DB_PATH };
export type { McpServerConfig, McpServers, ProviderCredentials, WorkspaceSecretsDecrypted } from "./secrets";
