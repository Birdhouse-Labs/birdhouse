// ABOUTME: SQLite database for storing agent tree structures with optimized loading
// ABOUTME: Supports 50K+ agents with sub-200ms query performance using composite indexes

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { nanoid } from "nanoid";
import { runAgentsDbMigrations, runAgentsDbMigrationsOnDb } from "./agents-db-migrations/run-agents-db-migrations";
import type { SessionStatus } from "./opencode-client";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Agent row as stored in database (flat structure)
 */
export interface AgentRow {
  id: string;
  session_id: string;
  parent_id: string | null;
  tree_id: string;
  level: number;
  title: string;
  project_id: string;
  directory: string;
  model: string;
  created_at: number;
  updated_at: number;
  cloned_from: string | null;
  cloned_at: number | null;
  archived_at: number | null;
}

/**
 * Agent event row as stored in database
 * Tracks timeline events like agent cloning using action-centric model
 */
export interface AgentEventRow {
  id: string;
  agent_id: string;
  event_type: AgentEventType;
  timestamp: number;

  // Actor roles (explicit, self-documenting)
  actor_agent_id: string | null; // Who performed the action (null = human)
  actor_agent_title: string | null;

  source_agent_id: string | null; // Where it came from
  source_agent_title: string | null;

  target_agent_id: string | null; // What was created/affected
  target_agent_title: string | null;

  metadata: string | null;
}

/**
 * Event types for agent timeline (action-centric model)
 * - clone_created: A clone was created (replaces all 4 old clone event types)
 *
 * Future event types:
 * - message_received: Received message from another agent
 * - merge_performed: Merged with another agent
 * - branch_created: Branched exploration
 */
export type AgentEventType = "clone_created";

/**
 * Sort order for loading agents
 * - updated_at: Sort by last activity time
 * - created_at: Sort by creation time
 */
export type SortOrder = "updated_at" | "created_at";

/**
 * Sort direction for loading agents
 * - desc: Descending order (most recent first) - default
 * - asc: Ascending order (oldest first)
 */
export type SortDirection = "asc" | "desc";

/**
 * Agent node with hierarchical children (assembled tree structure)
 */
export interface AgentNode {
  id: string;
  session_id: string;
  parent_id: string | null;
  tree_id: string;
  level: number;
  title: string;
  project_id: string;
  directory: string;
  model: string;
  created_at: number;
  updated_at: number;
  cloned_from: string | null;
  cloned_at: number | null;
  children: AgentNode[]; // The key difference from AgentRow!
  status?: SessionStatus; // Session status from OpenCode (idle/busy/retry)
}

/**
 * Complete agent tree with metadata
 */
export interface AgentTree {
  tree_id: string;
  root: AgentNode;
  count: number; // Total agents in this tree
}

/**
 * Agent database interface
 */
export interface AgentsDB {
  /** Insert a new agent */
  insertAgent(agent: Omit<AgentRow, "id"> & { id?: string }): AgentRow;

  /** Get all agents sorted by specified order */
  getAllAgents(sortBy?: SortOrder, sortDir?: SortDirection): AgentRow[];

  /** Get agent by session_id */
  getAgentBySessionId(sessionId: string): AgentRow | null;

  /** Get agent by our agent_id */
  getAgentById(agentId: string): AgentRow | null;

  /** Search agents by query (fuzzy match on title, id, project_id) - returns all matches */
  searchAgents(query: string): AgentRow[];

  /** Search agents and return full trees containing matches */
  searchAgentsWithTrees(
    query: string,
    sortBy?: SortOrder,
    sortDir?: SortDirection,
  ): { rows: AgentRow[]; matchedAgentIds: string[] };

  /** Update agent's updated_at timestamp (called when messages are sent) */
  updateAgentTimestamp(agentId: string): void;

  /** Update agent's title */
  updateAgentTitle(agentId: string, title: string): AgentRow | null;

  /** Insert a new agent event */
  insertEvent(event: Omit<AgentEventRow, "id"> & { id?: string }): AgentEventRow;

  /** Get all events for an agent sorted by timestamp (oldest first) */
  getEventsByAgentId(agentId: string): AgentEventRow[];

  /** Archive agent and all descendants - returns array of archived agent IDs */
  archiveAgent(agentId: string): string[];

  /** Unarchive agent and all descendants - returns array of unarchived agent IDs */
  unarchiveAgent(agentId: string): string[];

  /** Close database connection */
  close(): void;

  /** Get underlying database instance (for advanced operations) */
  getDatabase(): Database;
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a new agent ID in the format: agent_xxxxx
 * Uses nanoid for unique identifiers similar to OpenCode's ses_xxx format
 */
export function generateAgentId(): string {
  return `agent_${nanoid(18)}`; // 18 chars matches OpenCode's session IDs
}

/**
 * Generate a new event ID in the format: evt_xxxxx
 * Uses nanoid for unique identifiers
 */
export function generateEventId(): string {
  return `evt_${nanoid(18)}`;
}

// ============================================================================
// Database Creation & Configuration
// ============================================================================

/**
 * Open and configure a SQLite database with optimal settings.
 * Schema is managed by runAgentsDbMigrations() / runAgentsDbMigrationsOnDb().
 */
function createDatabase(dbPath: string): Database {
  if (dbPath !== ":memory:") {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath);

  db.run("PRAGMA journal_mode = WAL"); // Write-Ahead Logging for better concurrency
  db.run("PRAGMA cache_size = -128000"); // 128MB cache
  db.run("PRAGMA temp_store = MEMORY"); // Use memory for temporary tables
  db.run("PRAGMA mmap_size = 134217728"); // 128MB memory-mapped I/O
  db.run("PRAGMA foreign_keys = ON"); // Enforce foreign key constraints

  return db;
}

// Cache of AgentsDB instances keyed by resolved db path
// Ensures migrations run once and the same connection is reused per workspace
const agentsDbCache = new Map<string, AgentsDB>();

/**
 * Initialize an agents database: run migrations then return a ready AgentsDB instance.
 * Subsequent calls with the same path return the cached instance without re-running migrations.
 *
 * For :memory: databases, migrations run on the same connection that will be used
 * for queries — each in-memory database is a fresh isolated connection.
 */
export async function initAgentsDB(dbPath: string): Promise<AgentsDB> {
  const cached = agentsDbCache.get(dbPath);
  if (cached) return cached;

  if (dbPath === ":memory:") {
    // In-memory: open the connection first, migrate on it, then wrap it
    const db = createDatabase(dbPath);
    await runAgentsDbMigrationsOnDb(db);
    const instance = createAgentsDB(dbPath, db);
    // Do not cache :memory: instances — each caller gets a fresh isolated database
    return instance;
  }

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  await runAgentsDbMigrations(dbPath);

  const instance = createAgentsDB(dbPath);
  agentsDbCache.set(dbPath, instance);
  return instance;
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Create agents database instance.
 * Pass an existing Database to reuse an already-open connection (e.g. from initAgentsDB for :memory:).
 */
export function createAgentsDB(dbPath: string, existingDb?: Database): AgentsDB {
  const db = existingDb ?? createDatabase(dbPath);

  // Prepare statements for better performance (Bun's SQLite uses query() for prepared statements)
  const insertQuery = db.query(`
    INSERT INTO agents (
      id, session_id, parent_id, tree_id, level,
      title, project_id, directory, model,
      created_at, updated_at, cloned_from, cloned_at, archived_at
    ) VALUES (
      $id, $session_id, $parent_id, $tree_id, $level,
      $title, $project_id, $directory, $model,
      $created_at, $updated_at, $cloned_from, $cloned_at, $archived_at
    )
  `);

  // Helper function to build dynamic query with sort direction
  const buildGetAllQuery = (sortBy: SortOrder, sortDir: SortDirection): string => {
    const dir = sortDir.toUpperCase();

    if (sortBy === "created_at") {
      return `
        SELECT 
          id, session_id, parent_id, tree_id, level,
          title, project_id, directory, model,
          created_at, updated_at, cloned_from, cloned_at, archived_at
        FROM agents
        WHERE archived_at IS NULL
        ORDER BY 
          (SELECT created_at FROM agents root WHERE root.id = agents.tree_id AND root.archived_at IS NULL) ${dir},
          tree_id ${dir},
          level ASC,
          created_at ${dir}
      `;
    } else {
      return `
        SELECT 
          id, session_id, parent_id, tree_id, level,
          title, project_id, directory, model,
          created_at, updated_at, cloned_from, cloned_at, archived_at
        FROM agents
        WHERE archived_at IS NULL
        ORDER BY 
          (SELECT MAX(updated_at) FROM agents a WHERE a.tree_id = agents.tree_id AND a.archived_at IS NULL) ${dir},
          tree_id ${dir},
          level ASC,
          updated_at ${dir}
      `;
    }
  };

  const getBySessionIdQuery = db.query(`
    SELECT 
      id, session_id, parent_id, tree_id, level,
      title, project_id, directory, model,
      created_at, updated_at, cloned_from, cloned_at, archived_at
    FROM agents
    WHERE session_id = $session_id
  `);

  const getByIdQuery = db.query(`
    SELECT 
      id, session_id, parent_id, tree_id, level,
      title, project_id, directory, model,
      created_at, updated_at, cloned_from, cloned_at, archived_at
    FROM agents
    WHERE id = $id
  `);

  const updateTimestampQuery = db.query(`
    UPDATE agents 
    SET updated_at = $updated_at 
    WHERE id = $id
  `);

  const updateTitleQuery = db.query(`
     UPDATE agents 
     SET title = $title, updated_at = $updated_at 
     WHERE id = $id
   `);

  const updateEventActorTitlesQuery = db.query(`
     UPDATE agent_events
     SET actor_agent_title = $title
     WHERE actor_agent_id = $agent_id
   `);

  const updateEventSourceTitlesQuery = db.query(`
     UPDATE agent_events
     SET source_agent_title = $title
     WHERE source_agent_id = $agent_id
   `);

  const updateEventTargetTitlesQuery = db.query(`
     UPDATE agent_events
     SET target_agent_title = $title
     WHERE target_agent_id = $agent_id
   `);

  const insertEventQuery = db.query(`
    INSERT INTO agent_events (
      id, agent_id, event_type, timestamp,
      actor_agent_id, actor_agent_title,
      source_agent_id, source_agent_title,
      target_agent_id, target_agent_title,
      metadata
    ) VALUES (
      $id, $agent_id, $event_type, $timestamp,
      $actor_agent_id, $actor_agent_title,
      $source_agent_id, $source_agent_title,
      $target_agent_id, $target_agent_title,
      $metadata
    )
  `);

  const getEventsByAgentIdQuery = db.query(`
    SELECT 
      id, agent_id, event_type, timestamp,
      actor_agent_id, actor_agent_title,
      source_agent_id, source_agent_title,
      target_agent_id, target_agent_title,
      metadata
    FROM agent_events
    WHERE agent_id = $agent_id
    ORDER BY timestamp ASC
  `);

  // ============================================================================
  // Query Parsing and Matching
  // ============================================================================

  /**
   * Represents a parsed search term
   */
  interface SearchTerm {
    text: string;
    exact: boolean; // true if quoted (requires exact substring match)
  }

  /**
   * Parse search query into terms
   * Supports quoted phrases for exact matching: "database optimization"
   * Unquoted terms are fuzzy matched
   * Multiple terms are AND'd together (all must match)
   *
   * Examples:
   *   "database" → [{ text: "database", exact: true }]
   *   database agent → [{ text: "database", exact: false }, { text: "agent", exact: false }]
   *   "database" agent pr-123 → [exact "database", fuzzy "agent", fuzzy "pr-123"]
   */
  const parseQuery = (query: string): SearchTerm[] => {
    const terms: SearchTerm[] = [];
    // Match quoted phrases or unquoted words
    const regex = /"([^"]+)"|(\S+)/g;

    let match = regex.exec(query);
    while (match !== null) {
      if (match[1]) {
        // Quoted term - exact match required
        terms.push({ text: match[1], exact: true });
      } else if (match[2]) {
        // Unquoted term - fuzzy match
        terms.push({ text: match[2], exact: false });
      }
      match = regex.exec(query);
    }

    return terms;
  };

  /**
   * Helper function for fuzzy search scoring
   * Returns score from 0 (no match) to 1 (perfect match)
   */
  const fuzzyScore = (query: string, text: string): number => {
    if (!query) return 1;

    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Exact match
    if (textLower === queryLower) return 1;

    // Prefix match
    if (textLower.startsWith(queryLower)) return 0.9;

    // Contains match
    if (textLower.includes(queryLower)) return 0.7;

    // Fuzzy character match (all query chars in order, but not necessarily consecutive)
    let queryIndex = 0;
    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIndex]) {
        queryIndex++;
      }
    }

    if (queryIndex === queryLower.length) {
      return 0.3 + (1 - queryIndex / textLower.length) * 0.4;
    }

    return 0;
  };

  /**
   * Check if a single term matches an agent (exact or fuzzy)
   * Returns score for the term (0 = no match)
   */
  const matchTerm = (term: SearchTerm, agent: AgentRow): number => {
    if (term.exact) {
      // Exact substring match (case-insensitive)
      const termLower = term.text.toLowerCase();
      const titleMatch = agent.title.toLowerCase().includes(termLower);
      const idMatch = agent.id.toLowerCase().includes(termLower);
      const projectMatch = agent.project_id.toLowerCase().includes(termLower);

      if (titleMatch || idMatch || projectMatch) {
        // Exact matches get high score (equivalent to contains fuzzy match)
        return 0.7;
      }
      return 0;
    } else {
      // Fuzzy match with field weighting
      const titleScore = fuzzyScore(term.text, agent.title);
      const idScore = fuzzyScore(term.text, agent.id);
      const projectScore = fuzzyScore(term.text, agent.project_id);

      // Title weighted 1.5x
      return Math.max(titleScore * 1.5, idScore, projectScore);
    }
  };

  /**
   * Check if agent matches ALL terms (AND logic)
   * Returns combined score if all match, 0 if any term doesn't match
   */
  const matchAllTerms = (terms: SearchTerm[], agent: AgentRow): number => {
    let totalScore = 0;

    for (const term of terms) {
      const score = matchTerm(term, agent);
      if (score === 0) {
        return 0; // Any term fails = reject agent
      }
      totalScore += score;
    }

    // Average score across all terms
    return totalScore / terms.length;
  };

  return {
    insertAgent(agent: Omit<AgentRow, "id"> & { id?: string }): AgentRow {
      // Generate ID if not provided
      const id = agent.id || generateAgentId();

      // CRITICAL: Wrap ancestry check + insert in a transaction to prevent TOCTOU race condition
      // This ensures that if parent is archived between check and insert, we catch it
      try {
        db.run("BEGIN IMMEDIATE"); // Use IMMEDIATE to acquire write lock immediately

        // Check if any ancestor is archived using recursive CTE
        let archived_at = agent.archived_at ?? null;

        if (agent.parent_id && !archived_at) {
          // Walk up ancestry chain to check for archived ancestors
          const ancestryQuery = db.prepare(`
            WITH RECURSIVE ancestry AS (
              SELECT id, parent_id, archived_at, level FROM agents WHERE id = ?
              UNION ALL
              SELECT a.id, a.parent_id, a.archived_at, a.level
              FROM agents a
              JOIN ancestry ON a.id = ancestry.parent_id
            )
            SELECT archived_at FROM ancestry WHERE archived_at IS NOT NULL LIMIT 1
          `);

          const archivedAncestor = ancestryQuery.get(agent.parent_id) as { archived_at: number | null } | undefined;

          if (archivedAncestor?.archived_at) {
            // Auto-archive this agent since an ancestor is archived
            archived_at = Date.now();
          }
        }

        const fullAgent: AgentRow = {
          ...agent,
          id,
          archived_at,
        };

        // Bun's SQLite requires $ prefix for named parameters
        insertQuery.run({
          $id: fullAgent.id,
          $session_id: fullAgent.session_id,
          $parent_id: fullAgent.parent_id,
          $tree_id: fullAgent.tree_id,
          $level: fullAgent.level,
          $title: fullAgent.title,
          $project_id: fullAgent.project_id,
          $directory: fullAgent.directory,
          $model: fullAgent.model,
          $created_at: fullAgent.created_at,
          $updated_at: fullAgent.updated_at,
          $cloned_from: fullAgent.cloned_from,
          $cloned_at: fullAgent.cloned_at,
          $archived_at: fullAgent.archived_at,
        });

        db.run("COMMIT");
        return fullAgent;
      } catch (error) {
        db.run("ROLLBACK");

        // Provide better error messages for common failures
        if (error instanceof Error) {
          if (error.message.includes("UNIQUE constraint failed: agents.session_id")) {
            throw new Error(`Agent with session_id "${agent.session_id}" already exists`);
          }
          if (error.message.includes("FOREIGN KEY constraint failed")) {
            throw new Error(`Parent agent with id "${agent.parent_id}" not found`);
          }
        }
        throw error;
      }
    },

    getAllAgents(sortBy: SortOrder = "updated_at", sortDir: SortDirection = "desc"): AgentRow[] {
      const queryString = buildGetAllQuery(sortBy, sortDir);
      return db.prepare(queryString).all() as AgentRow[];
    },

    getAgentBySessionId(sessionId: string): AgentRow | null {
      const result = getBySessionIdQuery.get({ $session_id: sessionId });
      return (result as AgentRow | undefined) || null;
    },

    getAgentById(agentId: string): AgentRow | null {
      const result = getByIdQuery.get({ $id: agentId });
      return (result as AgentRow | undefined) || null;
    },

    searchAgents(query: string): AgentRow[] {
      // Get all agents and filter in-memory for fuzzy matching
      // SQLite's LIKE is case-insensitive but doesn't support fuzzy matching
      const allAgents = this.getAllAgents("updated_at");

      if (!query.trim()) {
        return allAgents;
      }

      // Parse query into terms (supports quoted exact matches)
      const terms = parseQuery(query);

      if (terms.length === 0) {
        return allAgents;
      }

      // Score and filter agents (ALL terms must match - AND logic)
      const scored = allAgents
        .map((agent) => {
          const score = matchAllTerms(terms, agent);
          return { agent, score };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score);

      return scored.map(({ agent }) => agent);
    },

    searchAgentsWithTrees(
      query: string,
      sortBy: SortOrder = "updated_at",
      sortDir: SortDirection = "desc",
    ): { rows: AgentRow[]; matchedAgentIds: string[] } {
      // 1. Find matching agents using existing fuzzy search
      const matches = this.searchAgents(query);

      if (matches.length === 0) {
        return { rows: [], matchedAgentIds: [] };
      }

      // 2. Extract unique tree_ids and matched agent IDs
      const treeIds = [...new Set(matches.map((a) => a.tree_id))];
      const matchedAgentIds = matches.map((a) => a.id);

      // 3. Load ALL agents from matching trees with proper sorting
      // Build dynamic query with sort direction
      const dir = sortDir.toUpperCase();
      const sortQuery =
        sortBy === "created_at"
          ? `
        SELECT 
          id, session_id, parent_id, tree_id, level,
          title, project_id, directory, model,
          created_at, updated_at, cloned_from, cloned_at, archived_at
        FROM agents
        WHERE tree_id IN (${treeIds.map(() => "?").join(",")})
          AND archived_at IS NULL
        ORDER BY 
          (SELECT created_at FROM agents root WHERE root.id = agents.tree_id AND root.archived_at IS NULL) ${dir},
          tree_id ${dir},
          level ASC,
          created_at ${dir}
      `
          : `
        SELECT 
          id, session_id, parent_id, tree_id, level,
          title, project_id, directory, model,
          created_at, updated_at, cloned_from, cloned_at, archived_at
        FROM agents
        WHERE tree_id IN (${treeIds.map(() => "?").join(",")})
          AND archived_at IS NULL
        ORDER BY 
          (SELECT MAX(updated_at) FROM agents a WHERE a.tree_id = agents.tree_id AND a.archived_at IS NULL) ${dir},
          tree_id ${dir},
          level ASC,
          updated_at ${dir}
      `;

      const rows = db.prepare(sortQuery).all(...treeIds) as AgentRow[];

      return { rows, matchedAgentIds };
    },

    updateAgentTimestamp(agentId: string): void {
      updateTimestampQuery.run({
        $id: agentId,
        $updated_at: Date.now(),
      });
    },

    updateAgentTitle(agentId: string, title: string): AgentRow | null {
      try {
        // Update agent title
        updateTitleQuery.run({
          $id: agentId,
          $title: title,
          $updated_at: Date.now(),
        });

        // Update denormalized titles in agent_events (all three role columns)
        updateEventActorTitlesQuery.run({
          $agent_id: agentId,
          $title: title,
        });

        updateEventSourceTitlesQuery.run({
          $agent_id: agentId,
          $title: title,
        });

        updateEventTargetTitlesQuery.run({
          $agent_id: agentId,
          $title: title,
        });

        // Return the updated agent
        return this.getAgentById(agentId);
      } catch (error) {
        console.error("Error updating agent title:", error);
        return null;
      }
    },

    insertEvent(event: Omit<AgentEventRow, "id"> & { id?: string }): AgentEventRow {
      // Generate ID if not provided
      const id = event.id || generateEventId();

      const fullEvent: AgentEventRow = {
        ...event,
        id,
      };

      try {
        insertEventQuery.run({
          $id: fullEvent.id,
          $agent_id: fullEvent.agent_id,
          $event_type: fullEvent.event_type,
          $timestamp: fullEvent.timestamp,
          $actor_agent_id: fullEvent.actor_agent_id,
          $actor_agent_title: fullEvent.actor_agent_title,
          $source_agent_id: fullEvent.source_agent_id,
          $source_agent_title: fullEvent.source_agent_title,
          $target_agent_id: fullEvent.target_agent_id,
          $target_agent_title: fullEvent.target_agent_title,
          $metadata: fullEvent.metadata,
        });
        return fullEvent;
      } catch (error) {
        // Provide better error messages for common failures
        if (error instanceof Error) {
          if (error.message.includes("FOREIGN KEY constraint failed")) {
            throw new Error(`Agent with id "${event.agent_id}" not found`);
          }
        }
        throw error;
      }
    },

    getEventsByAgentId(agentId: string): AgentEventRow[] {
      return getEventsByAgentIdQuery.all({ $agent_id: agentId }) as AgentEventRow[];
    },

    archiveAgent(agentId: string): string[] {
      // Collect all descendant IDs using recursive CTE
      const descendantsQuery = db.prepare(`
        WITH RECURSIVE descendants AS (
          SELECT id FROM agents WHERE id = ?
          UNION ALL
          SELECT a.id FROM agents a
          JOIN descendants d ON a.parent_id = d.id
        )
        SELECT id FROM descendants
      `);

      const descendants = descendantsQuery.all(agentId) as Array<{ id: string }>;
      const idsToArchive = descendants.map((d) => d.id);

      if (idsToArchive.length === 0) {
        return [];
      }

      // Archive all descendants in a single transaction
      const now = Date.now();
      try {
        db.run("BEGIN TRANSACTION");

        const updateQuery = db.prepare(`
          UPDATE agents 
          SET archived_at = ? 
          WHERE id IN (${idsToArchive.map(() => "?").join(",")})
        `);

        updateQuery.run(now, ...idsToArchive);

        db.run("COMMIT");
        return idsToArchive;
      } catch (error) {
        db.run("ROLLBACK");
        throw error;
      }
    },

    unarchiveAgent(agentId: string): string[] {
      // Collect all descendant IDs using recursive CTE (same logic as archive)
      const descendantsQuery = db.prepare(`
        WITH RECURSIVE descendants AS (
          SELECT id FROM agents WHERE id = ?
          UNION ALL
          SELECT a.id FROM agents a
          JOIN descendants d ON a.parent_id = d.id
        )
        SELECT id FROM descendants
      `);

      const descendants = descendantsQuery.all(agentId) as Array<{ id: string }>;
      const idsToUnarchive = descendants.map((d) => d.id);

      if (idsToUnarchive.length === 0) {
        return [];
      }

      // Unarchive all descendants in a single transaction
      try {
        db.run("BEGIN TRANSACTION");

        const updateQuery = db.prepare(`
          UPDATE agents 
          SET archived_at = NULL 
          WHERE id IN (${idsToUnarchive.map(() => "?").join(",")})
        `);

        updateQuery.run(...idsToUnarchive);

        db.run("COMMIT");
        return idsToUnarchive;
      } catch (error) {
        db.run("ROLLBACK");
        throw error;
      }
    },

    close(): void {
      db.close();
    },

    getDatabase(): Database {
      return db;
    },
  };
}

// ============================================================================
// Tree Loading & Assembly
// ============================================================================

/**
 * Load all agent trees from database and assemble hierarchical structure.
 *
 * Algorithm: O(n) single-pass tree assembly
 * - Parents are guaranteed to appear before children (due to level ordering)
 * - Uses Map for O(1) parent lookup
 * - Detects tree boundaries by tree_id changes
 *
 * @param db - AgentsDB instance
 * @param sortBy - Sort order: 'updated_at' (default) or 'created_at'
 * @param sortDir - Sort direction: 'desc' (default) or 'asc'
 * @param preFilteredRows - Optional pre-filtered rows (e.g., from searchAgentsWithTrees)
 * @returns Array of agent trees, sorted by specified order
 *
 * Performance: 80-190ms for 50K agents
 */
export function loadAllAgentTrees(
  db: AgentsDB,
  sortBy: SortOrder = "updated_at",
  sortDir: SortDirection = "desc",
  preFilteredRows?: AgentRow[],
): AgentTree[] {
  // 1. Get flat sorted rows from database (or use pre-filtered rows)
  const rows = preFilteredRows || db.getAllAgents(sortBy, sortDir);

  // 2. Assemble trees in single O(n) pass
  const trees: AgentTree[] = [];
  let currentTree: AgentTree | null = null;
  const nodeMap = new Map<string, AgentNode>();

  for (const row of rows) {
    // Create node with empty children array
    const node: AgentNode = {
      ...row,
      children: [],
    };

    // Add to lookup map for O(1) parent access
    nodeMap.set(row.id, node);

    // Detect tree boundary (tree_id changed)
    if (!currentTree || currentTree.tree_id !== row.tree_id) {
      // Starting a new tree - this row is the root (level 0)
      currentTree = {
        tree_id: row.tree_id,
        root: node,
        count: 1,
      };
      trees.push(currentTree);
    } else {
      // Same tree - increment count
      currentTree.count++;

      // Attach to parent (guaranteed to exist due to level ordering!)
      if (row.parent_id) {
        const parent = nodeMap.get(row.parent_id);
        if (parent) {
          parent.children.push(node);
        } else {
          // This should never happen with proper level ordering
          console.error(`Parent ${row.parent_id} not found for agent ${row.id}`);
        }
      }
    }
  }

  return trees;
}

// ============================================================================
// Test Data Fixture
// ============================================================================

/**
 * Insert sample test data for development and testing
 * Creates 3-5 trees with proper parent-child relationships
 */
export function insertTestData(agentsDB: AgentsDB): void {
  const now = Date.now();

  // Tree 1: Simple tree (1 root, 2 children)
  const tree1Root = agentsDB.insertAgent({
    session_id: "ses_tree1_root",
    parent_id: null,
    tree_id: "agent_tree1",
    level: 0,
    title: "Tree 1 Root - Feature Development",
    project_id: "birdhouse-playground",
    directory: "/Users/test/projects/birdhouse",
    model: "anthropic/claude-sonnet-4",
    created_at: now - 3600000, // 1 hour ago
    updated_at: now - 1800000, // 30 min ago
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
    id: "agent_tree1",
  });

  agentsDB.insertAgent({
    session_id: "ses_tree1_child1",
    parent_id: tree1Root.id,
    tree_id: tree1Root.tree_id,
    level: 1,
    title: "Research API patterns",
    project_id: "birdhouse-playground",
    directory: "/Users/test/projects/birdhouse",
    model: "anthropic/claude-sonnet-4",
    created_at: now - 3000000,
    updated_at: now - 1200000,
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
  });

  agentsDB.insertAgent({
    session_id: "ses_tree1_child2",
    parent_id: tree1Root.id,
    tree_id: tree1Root.tree_id,
    level: 1,
    title: "Implement endpoints",
    project_id: "birdhouse-playground",
    directory: "/Users/test/projects/birdhouse",
    model: "anthropic/claude-sonnet-4",
    created_at: now - 2400000,
    updated_at: now - 900000,
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
  });

  // Tree 2: Deeper tree (1 root, 2 children, 1 grandchild)
  const tree2Root = agentsDB.insertAgent({
    session_id: "ses_tree2_root",
    parent_id: null,
    tree_id: "agent_tree2",
    level: 0,
    title: "Tree 2 Root - Bug Investigation",
    project_id: "birdhouse-playground",
    directory: "/Users/test/projects/birdhouse",
    model: "anthropic/claude-sonnet-4",
    created_at: now - 7200000, // 2 hours ago
    updated_at: now - 600000, // 10 min ago (recently updated)
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
    id: "agent_tree2",
  });

  const tree2Child1 = agentsDB.insertAgent({
    session_id: "ses_tree2_child1",
    parent_id: tree2Root.id,
    tree_id: tree2Root.tree_id,
    level: 1,
    title: "Reproduce issue",
    project_id: "birdhouse-playground",
    directory: "/Users/test/projects/birdhouse",
    model: "anthropic/claude-sonnet-4",
    created_at: now - 6600000,
    updated_at: now - 3600000,
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
  });

  agentsDB.insertAgent({
    session_id: "ses_tree2_child2",
    parent_id: tree2Root.id,
    tree_id: tree2Root.tree_id,
    level: 1,
    title: "Fix memory leak",
    project_id: "birdhouse-playground",
    directory: "/Users/test/projects/birdhouse",
    model: "anthropic/claude-sonnet-4",
    created_at: now - 5400000,
    updated_at: now - 1800000,
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
  });

  // Grandchild
  agentsDB.insertAgent({
    session_id: "ses_tree2_grandchild1",
    parent_id: tree2Child1.id,
    tree_id: tree2Root.tree_id,
    level: 2,
    title: "Write regression test",
    project_id: "birdhouse-playground",
    directory: "/Users/test/projects/birdhouse",
    model: "anthropic/claude-haiku",
    created_at: now - 4800000,
    updated_at: now - 2400000,
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
  });

  // Tree 3: Single agent tree
  agentsDB.insertAgent({
    session_id: "ses_tree3_root",
    parent_id: null,
    tree_id: "agent_tree3",
    level: 0,
    title: "Tree 3 Root - Quick refactor",
    project_id: "birdhouse-playground",
    directory: "/Users/test/projects/birdhouse",
    model: "anthropic/claude-haiku",
    created_at: now - 900000, // 15 min ago
    updated_at: now - 300000, // 5 min ago
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
    id: "agent_tree3",
  });

  // Tree 4: Larger tree with multiple levels
  const tree4Root = agentsDB.insertAgent({
    session_id: "ses_tree4_root",
    parent_id: null,
    tree_id: "agent_tree4",
    level: 0,
    title: "Tree 4 Root - Database optimization",
    project_id: "birdhouse-playground",
    directory: "/Users/test/projects/birdhouse",
    model: "anthropic/claude-sonnet-4",
    created_at: now - 10800000, // 3 hours ago
    updated_at: now - 120000, // 2 min ago (most recently updated)
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
    id: "agent_tree4",
  });

  const tree4Child1 = agentsDB.insertAgent({
    session_id: "ses_tree4_child1",
    parent_id: tree4Root.id,
    tree_id: tree4Root.tree_id,
    level: 1,
    title: "Analyze slow queries",
    project_id: "birdhouse-playground",
    directory: "/Users/test/projects/birdhouse",
    model: "anthropic/claude-sonnet-4",
    created_at: now - 9600000,
    updated_at: now - 4800000,
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
  });

  const tree4Child2 = agentsDB.insertAgent({
    session_id: "ses_tree4_child2",
    parent_id: tree4Root.id,
    tree_id: tree4Root.tree_id,
    level: 1,
    title: "Design new indexes",
    project_id: "birdhouse-playground",
    directory: "/Users/test/projects/birdhouse",
    model: "anthropic/claude-sonnet-4",
    created_at: now - 8400000,
    updated_at: now - 3600000,
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
  });

  // Level 2 children
  agentsDB.insertAgent({
    session_id: "ses_tree4_grandchild1",
    parent_id: tree4Child1.id,
    tree_id: tree4Root.tree_id,
    level: 2,
    title: "Benchmark current performance",
    project_id: "birdhouse-playground",
    directory: "/Users/test/projects/birdhouse",
    model: "anthropic/claude-haiku",
    created_at: now - 7200000,
    updated_at: now - 3000000,
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
  });

  agentsDB.insertAgent({
    session_id: "ses_tree4_grandchild2",
    parent_id: tree4Child2.id,
    tree_id: tree4Root.tree_id,
    level: 2,
    title: "Test index performance",
    project_id: "birdhouse-playground",
    directory: "/Users/test/projects/birdhouse",
    model: "anthropic/claude-haiku",
    created_at: now - 6000000,
    updated_at: now - 1800000,
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
  });

  // Tree 5: Different project
  agentsDB.insertAgent({
    session_id: "ses_tree5_root",
    parent_id: null,
    tree_id: "agent_tree5",
    level: 0,
    title: "Tree 5 Root - Documentation update",
    project_id: "other-project",
    directory: "/Users/test/projects/other",
    model: "anthropic/claude-haiku",
    created_at: now - 14400000, // 4 hours ago
    updated_at: now - 7200000, // 2 hours ago
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
    id: "agent_tree5",
  });

  agentsDB.insertAgent({
    session_id: "ses_tree5_child1",
    parent_id: "agent_tree5",
    tree_id: "agent_tree5",
    level: 1,
    title: "Update API docs",
    project_id: "other-project",
    directory: "/Users/test/projects/other",
    model: "anthropic/claude-haiku",
    created_at: now - 12600000,
    updated_at: now - 6000000,
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
  });
}

// ============================================================================
// Default Database Path
// ============================================================================

/** App name for data directory (matches logger convention) */
const APP_NAME = "Birdhouse";

/**
 * Get default database path
 * In production: ~/Library/Application Support/Birdhouse/agents.db (macOS)
 * In tests: :memory: (in-memory database)
 *
 * Follows macOS best practices: stores app data in Application Support directory
 * with app-specific subdirectory matching our bundle identifier pattern.
 */
export function getDefaultDatabasePath(workspaceId?: string): string {
  const isTest = process.env.NODE_ENV === "test" || (typeof Bun !== "undefined" && Bun?.main?.includes(".test."));

  if (isTest) {
    return ":memory:";
  }

  // macOS standard location: ~/Library/Application Support/AppName
  const home = homedir();
  if (home && process.platform === "darwin") {
    if (workspaceId) {
      // Workspace-specific database path
      return join(home, "Library", "Application Support", APP_NAME, "workspaces", workspaceId, "agents.db");
    }
    return join(home, "Library", "Application Support", APP_NAME, "agents.db");
  }

  // Fallback for other platforms or if home not available
  if (workspaceId) {
    return join(process.cwd(), "data", "workspaces", workspaceId, "agents.db");
  }
  return join(process.cwd(), "data", "agents.db");
}
