// ABOUTME: API service for fetching agents from backend
// ABOUTME: Handles HTTP requests and flattens agent tree for typeahead

import type { BackendAgentNode, BackendAgentTree } from "../adapters/agent-tree-adapter";
import { buildWorkspaceUrl } from "../config/api";

/**
 * Flattened agent for typeahead display
 */
export interface AgentForTypeahead {
  id: string;
  title: string;
  status?: { type: "idle" | "busy" | "retry" };
}

/**
 * Search response from backend
 */
export interface SearchResponse {
  agents?: BackendAgentNode[]; // When includeTrees=false
  trees?: BackendAgentTree[]; // When includeTrees=true
  matchedAgentIds?: string[]; // When includeTrees=true
  total: number;
}

/**
 * Archive response from backend
 */
export interface ArchiveResponse {
  archivedCount: number;
  archivedIds: string[];
}

/**
 * Unarchive response from backend
 */
export interface UnarchiveResponse {
  unarchivedCount: number;
  unarchivedIds: string[];
}

/**
 * Archive an agent and all its descendants
 * @param workspaceId The workspace ID
 * @param agentId The agent ID to archive
 * @returns Archive response with count and IDs of archived agents
 */
export async function archiveAgent(workspaceId: string, agentId: string): Promise<ArchiveResponse> {
  const url = buildWorkspaceUrl(workspaceId, `/agents/${agentId}/archive`);

  try {
    const response = await fetch(url, {
      method: "PATCH",
    });

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to archive agent: ${response.statusText}`;

      // Try to extract error from JSON response
      try {
        const errorData = JSON.parse(responseBody);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Response wasn't JSON, use status text
      }

      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    throw new Error(`Failed to archive agent: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Unarchive an agent and all its descendants
 * @param workspaceId The workspace ID
 * @param agentId The agent ID to unarchive
 * @returns Unarchive response with count and IDs of unarchived agents
 */
export async function unarchiveAgent(workspaceId: string, agentId: string): Promise<UnarchiveResponse> {
  const url = buildWorkspaceUrl(workspaceId, `/agents/${agentId}/unarchive`);

  try {
    const response = await fetch(url, {
      method: "PATCH",
    });

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to unarchive agent: ${response.statusText}`;

      // Try to extract error from JSON response
      try {
        const errorData = JSON.parse(responseBody);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Response wasn't JSON, use status text
      }

      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    throw new Error(`Failed to unarchive agent: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Search agents by title
 * @param workspaceId The workspace ID
 * @param query Search query (empty returns all agents)
 * @param includeTrees Return complete trees vs flat list
 * @returns Search results with agents or trees
 */
export async function searchAgents(workspaceId: string, query: string, includeTrees: boolean): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    includeTrees: String(includeTrees),
  });

  const url = `${buildWorkspaceUrl(workspaceId, "/agents/search")}?${params}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Search failed: ${response.statusText}`;

      // Try to extract error from JSON response
      try {
        const errorData = JSON.parse(responseBody);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Response wasn't JSON, use status text
      }

      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    throw new Error(`Search failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Fetch all agents and flatten them for typeahead
 * @param workspaceId The workspace ID
 * @returns Array of agents with id, title, and status
 */
export async function fetchAgentsForTypeahead(workspaceId: string): Promise<AgentForTypeahead[]> {
  const url = buildWorkspaceUrl(workspaceId, "/agents");

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to fetch agents: ${response.statusText}`;

      // Try to extract error from JSON response
      try {
        const errorData = JSON.parse(responseBody);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Response wasn't JSON, use status text
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    const trees = data.trees as BackendAgentTree[];

    // Flatten all agent trees into a single list
    const agents: AgentForTypeahead[] = [];

    function flattenTree(node: BackendAgentNode) {
      const agent: AgentForTypeahead = {
        id: node.id,
        title: node.title,
      };

      // Include status field if present (satisfies exactOptionalPropertyTypes)
      if (node.status !== undefined) {
        agent.status = node.status;
      }

      agents.push(agent);

      // Recursively add children
      for (const child of node.children) {
        flattenTree(child);
      }
    }

    // Process all trees
    for (const tree of trees) {
      flattenTree(tree.root);
    }

    return agents;
  } catch (error) {
    throw new Error(`Failed to fetch agents: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
