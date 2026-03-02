// ABOUTME: Adapter for mapping backend AgentNode to frontend TreeNode format
// ABOUTME: Handles timestamp conversion and adds default UI state fields

import type { TreeNode } from "../components/TreeView";

/**
 * Backend agent node format (from GET /api/agents)
 */
export interface BackendAgentNode {
  id: string;
  session_id: string;
  parent_id: string | null;
  tree_id: string;
  level: number;
  title: string;
  project_id: string;
  directory: string;
  model: string;
  created_at: number; // Unix milliseconds
  updated_at: number; // Unix milliseconds
  cloned_from: string | null; // ID of agent this was cloned from
  cloned_at: number | null; // Unix milliseconds when cloned
  archived_at: number | null; // Unix milliseconds when archived, null if not archived
  children: BackendAgentNode[];
  status?: { type: "idle" | "busy" | "retry" }; // Session status from OpenCode
}

/**
 * Backend response format from GET /api/agents
 */
export interface BackendAgentTree {
  tree_id: string;
  root: BackendAgentNode;
  count: number;
}

/**
 * Map backend agent node to frontend TreeNode format
 * @param node Backend agent node
 * @param selectedAgentId Currently selected agent ID (to expand its path)
 * @returns Frontend TreeNode
 */
export function mapAgentNode(node: BackendAgentNode, selectedAgentId?: string): TreeNode {
  const result: TreeNode = {
    id: node.id,
    title: node.title,
    level: node.level,
    children: node.children.map((child) => mapAgentNode(child, selectedAgentId)),
    collapsed: false, // Start expanded by default
    createdAt: new Date(node.created_at),
    updatedAt: new Date(node.updated_at),
    clonedFrom: node.cloned_from,
    clonedAt: node.cloned_at ? new Date(node.cloned_at) : null,
    archivedAt: node.archived_at ? new Date(node.archived_at) : null,
    modelName: node.model,

    // Map status to isActivelyWorking
    isActivelyWorking: node.status?.type === "busy" || node.status?.type === "retry",

    hasUnreadMessages: false,
    tokenUsage: 0,
  };

  // Include status field if present (satisfies exactOptionalPropertyTypes)
  if (node.status !== undefined) {
    result.status = node.status;
  }

  return result;
}

/**
 * Map all agent trees from backend response
 * @param trees Array of agent trees from backend
 * @param selectedAgentId Currently selected agent ID
 * @returns Array of root TreeNodes (flattened - each tree's root becomes a top-level node)
 */
export function mapAgentTrees(trees: BackendAgentTree[], selectedAgentId?: string): TreeNode[] {
  return trees.map((tree) => mapAgentNode(tree.root, selectedAgentId));
}
