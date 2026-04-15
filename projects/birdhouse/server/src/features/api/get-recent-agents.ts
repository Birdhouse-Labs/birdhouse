// ABOUTME: Get recent agents for @@ typeahead — fast DB-only list
// ABOUTME: Returns agents from last 30 days with no message loading; snippets are fetched per-agent separately

import type { Context } from "hono";
import type { Deps } from "../../dependencies";

interface RecentAgentResponse {
  id: string;
  title: string;
  session_id: string;
  parent_id: string | null;
  tree_id: string;
}

/**
 * GET /api/agents/recent - Get recent agents for typeahead
 * Returns agents sorted by updated_at desc. No message loading — callers fetch
 * snippets per-agent via GET /api/agents/:id/messages/snippet.
 */
export async function getRecentAgents(c: Context, deps: Pick<Deps, "agentsDB">) {
  const { agentsDB } = deps;

  try {
    // Parse optional query parameter
    const query = c.req.query("q") || "";

    // Parse optional limit parameter — must be a positive integer when provided
    let limit: number | undefined;
    const limitParam = c.req.query("limit");
    if (limitParam !== undefined) {
      const parsed = Number(limitParam);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return c.json({ error: "limit must be a positive integer" }, 400);
      }
      limit = parsed;
    }

    // Get recent agents from database (filtered by query and limited if provided)
    const agents = agentsDB.getRecentAgents(query, limit);

    const response: RecentAgentResponse[] = agents.map((agent) => ({
      id: agent.id,
      title: agent.title,
      session_id: agent.session_id,
      parent_id: agent.parent_id,
      tree_id: agent.tree_id,
    }));

    return c.json({
      agents: response,
      total: response.length,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
