// ABOUTME: API service for fetching agents from backend
// ABOUTME: Handles HTTP requests and flattens agent tree for typeahead

import type { BackendAgentNode, BackendAgentTree } from "../adapters/agent-tree-adapter";
import { buildWorkspaceUrl } from "../config/api";

/**
 * A single part of a matched or context message
 */
export type MessagePart =
  | { type: "text"; text: string }
  | { type: "tool"; toolName: string; command?: string; output?: string };

/**
 * A message returned as part of a search result
 */
export interface SearchResultMessage {
  id: string;
  role: string;
  parts: MessagePart[];
}

/**
 * A single agent message search result
 */
export interface AgentMessageSearchResult {
  agentId: string | null;
  sessionId: string;
  title: string;
  matchedMessage: SearchResultMessage;
  contextMessage: SearchResultMessage | null;
  matchedAt: number;
  sessionCreatedAt: number;
  sessionUpdatedAt: number;
}

/**
 * Response from the agent message search endpoint
 */
export interface AgentMessageSearchResponse {
  results: AgentMessageSearchResult[];
}

/**
 * Flattened agent for typeahead display
 */
export interface AgentForTypeahead {
  id: string;
  title: string;
  status?: { type: "idle" | "busy" | "retry" };
}

/**
 * Recent agent row for typeahead
 */
export interface RecentAgentForTypeahead {
  id: string;
  title: string;
  session_id: string;
  parent_id: string | null;
  tree_id: string;
}

/**
 * Recent agent snippet loaded on demand
 */
export interface RecentAgentSnippet {
  lastMessageAt: number | null;
  lastUserMessage: {
    text: string;
    isAgentSent: boolean;
    sentByAgentTitle?: string;
  } | null;
  lastAgentMessage: string | null;
}

/**
 * Response from recent agents endpoint
 */
export interface RecentAgentsResponse {
  agents: RecentAgentForTypeahead[];
  total: number;
}

/**
 * Response from recent agent snippet endpoint
 */
export interface RecentAgentSnippetResponse {
  lastMessageAt: number | null;
  lastUserMessage: {
    text: string;
    isAgentSent: boolean;
    sentByAgentTitle?: string;
  } | null;
  lastAgentMessage: string | null;
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
}

/**
 * Unarchive an agent and all its descendants
 * @param workspaceId The workspace ID
 * @param agentId The agent ID to unarchive
 * @returns Unarchive response with count and IDs of unarchived agents
 */
export async function unarchiveAgent(workspaceId: string, agentId: string): Promise<UnarchiveResponse> {
  const url = buildWorkspaceUrl(workspaceId, `/agents/${agentId}/unarchive`);

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
}

/**
 * Search agent messages by content
 * @param workspaceId The workspace ID
 * @param query Search query text
 * @param limit Maximum number of results to return
 * @returns Search results with matched and context messages
 */
export async function searchAgentMessages(
  workspaceId: string,
  query: string,
  limit?: number,
): Promise<AgentMessageSearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }

  const url = `${buildWorkspaceUrl(workspaceId, "/agents/search")}?${params}`;

  const response = await fetch(url);

  if (!response.ok) {
    const responseBody = await response.text();
    let errorMessage = `Search failed: ${response.statusText}`;

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
}

/**
 * Fetch all agents and flatten them for typeahead
 * @param workspaceId The workspace ID
 * @returns Array of agents with id, title, and status
 */
export async function fetchAgentsForTypeahead(workspaceId: string): Promise<AgentForTypeahead[]> {
  const url = buildWorkspaceUrl(workspaceId, "/agents");

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
}

/**
 * Fetch recent agents for typeahead
 * @param workspaceId The workspace ID
 * @param query Optional search query to filter agents
 * @param limit Optional maximum number of agents to return
 * @returns Array of recent agents
 */
export async function fetchRecentAgentsList(
  workspaceId: string,
  query?: string,
  limit?: number,
): Promise<RecentAgentForTypeahead[]> {
  const params = new URLSearchParams();
  if (query?.trim()) {
    params.set("q", query.trim());
  }
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }

  const url = `${buildWorkspaceUrl(workspaceId, "/agents/recent")}?${params}`;

  const response = await fetch(url);

  if (!response.ok) {
    const responseBody = await response.text();
    let errorMessage = `Failed to fetch recent agents: ${response.statusText}`;

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

  const data = (await response.json()) as RecentAgentsResponse;
  return data.agents;
}

/**
 * Fetch the latest message snippet for one recent agent
 * @param workspaceId The workspace ID
 * @param agentId The agent ID
 * @returns The latest snippet metadata for the agent
 */
export async function fetchRecentAgentSnippet(workspaceId: string, agentId: string): Promise<RecentAgentSnippet> {
  const url = buildWorkspaceUrl(workspaceId, `/agents/${agentId}/messages/snippet`);

  const response = await fetch(url);

  if (!response.ok) {
    const responseBody = await response.text();
    let errorMessage = `Failed to fetch recent agent snippet: ${response.statusText}`;

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

  return (await response.json()) as RecentAgentSnippetResponse;
}
