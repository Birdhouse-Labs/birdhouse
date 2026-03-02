// ABOUTME: Factory helpers for creating test agent records with sensible defaults
// ABOUTME: Reduces boilerplate in tests from ~15 lines per agent to 1-3 lines

import { nanoid } from "nanoid";
import type { AgentRow, AgentsDB } from "../lib/agents-db";

/**
 * Default values for test agents
 * These represent the most common test setup across the codebase
 */
const DEFAULT_AGENT_VALUES = {
  project_id: "test-project",
  directory: "/test",
  model: "anthropic/claude-sonnet-4",
  cloned_from: null,
  cloned_at: null,
  archived_at: null,
} as const;

/**
 * Create a root agent with sensible test defaults
 *
 * Root agents have:
 * - parent_id: null
 * - tree_id: agent.id (self-referencing)
 * - level: 0
 *
 * @param agentsDB - Database instance to insert into
 * @param overrides - Optional field overrides (only specify what you need to change)
 * @returns The created AgentRow
 *
 * @example
 * ```typescript
 * // Minimal usage
 * const root = createRootAgent(agentsDB);
 *
 * // With custom fields
 * const root = createRootAgent(agentsDB, {
 *   title: "Feature Development",
 *   id: "agent_feature"
 * });
 * ```
 */
export function createRootAgent(
  agentsDB: AgentsDB,
  overrides?: Partial<Omit<AgentRow, "parent_id" | "tree_id" | "level">> & { id?: string },
): AgentRow {
  const now = Date.now();
  const id = overrides?.id || `agent_${nanoid(8)}`;

  return agentsDB.insertAgent({
    // Required root-specific fields
    parent_id: null,
    tree_id: id, // Root is its own tree
    level: 0,

    // Common defaults
    session_id: `ses_test_${nanoid(8)}`,
    title: "Test Agent",
    ...DEFAULT_AGENT_VALUES,
    created_at: now,
    updated_at: now,

    // User overrides (including id)
    ...overrides,
    id,
  });
}

/**
 * Create a child agent under an existing parent
 *
 * Automatically:
 * - Sets parent_id to the provided parent
 * - Inherits tree_id from parent
 * - Increments level (parent.level + 1)
 * - Inherits project_id and directory from parent (unless overridden)
 *
 * @param agentsDB - Database instance to insert into
 * @param parentId - ID of the parent agent
 * @param overrides - Optional field overrides
 * @returns The created AgentRow
 *
 * @example
 * ```typescript
 * const root = createRootAgent(agentsDB, { title: "Root" });
 *
 * // Child inherits all parent context
 * const child = createChildAgent(agentsDB, root.id, {
 *   title: "Research task"
 * });
 *
 * // Can override inherited fields
 * const child2 = createChildAgent(agentsDB, root.id, {
 *   title: "Implementation",
 *   model: "anthropic/claude-haiku"
 * });
 * ```
 */
export function createChildAgent(
  agentsDB: AgentsDB,
  parentId: string,
  overrides?: Partial<Omit<AgentRow, "parent_id" | "tree_id" | "level">>,
): AgentRow {
  // Get parent to inherit context
  const parent = agentsDB.getAgentById(parentId);
  if (!parent) {
    throw new Error(`Parent agent with id "${parentId}" not found`);
  }

  const now = Date.now();

  return agentsDB.insertAgent({
    // Structural fields (derived from parent)
    parent_id: parentId,
    tree_id: parent.tree_id,
    level: parent.level + 1,

    // Inherit parent context
    project_id: parent.project_id,
    directory: parent.directory,

    // Common defaults
    session_id: `ses_test_${nanoid(8)}`,
    title: "Test Agent",
    model: DEFAULT_AGENT_VALUES.model,
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
    created_at: now,
    updated_at: now,

    // User overrides
    ...overrides,
  });
}

/**
 * Create a complete tree structure in one call
 *
 * Creates a root agent and optionally multiple children.
 * All agents are created in the database.
 *
 * @param agentsDB - Database instance to insert into
 * @param config - Tree configuration
 * @returns Object with root and children arrays
 *
 * @example
 * ```typescript
 * // Simple root with 2 children
 * const { root, children } = createAgentTree(agentsDB, {
 *   rootTitle: "Feature Development",
 *   childTitles: ["Research API", "Implement endpoints"]
 * });
 *
 * // Root only
 * const { root } = createAgentTree(agentsDB, {
 *   rootTitle: "Quick refactor"
 * });
 *
 * // With overrides for all agents
 * const { root, children } = createAgentTree(agentsDB, {
 *   rootTitle: "Bug investigation",
 *   childTitles: ["Reproduce", "Fix"],
 *   overrides: { model: "anthropic/claude-haiku" }
 * });
 * ```
 */
export function createAgentTree(
  agentsDB: AgentsDB,
  config: {
    rootTitle?: string;
    rootId?: string;
    childTitles?: string[];
    overrides?: Partial<Omit<AgentRow, "parent_id" | "tree_id" | "level" | "title">>;
  } = {},
): { root: AgentRow; children: AgentRow[] } {
  const { rootTitle = "Test Agent", rootId, childTitles = [], overrides = {} } = config;

  // Create root
  const root = createRootAgent(agentsDB, {
    title: rootTitle,
    id: rootId,
    ...overrides,
  });

  // Create children with distinct timestamps to ensure stable ordering
  const baseTimestamp = overrides.created_at ?? Date.now();
  const children = childTitles.map((title, index) =>
    createChildAgent(agentsDB, root.id, {
      title,
      ...overrides,
      // Ensure each child has a unique timestamp for stable ordering in tests
      created_at: baseTimestamp + index,
      updated_at: baseTimestamp + index,
    }),
  );

  return { root, children };
}
