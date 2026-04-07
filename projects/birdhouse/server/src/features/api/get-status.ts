// ABOUTME: Get session status for an agent (idle, busy, retry)
// ABOUTME: Used by /api/agents/:id/status GET endpoint

import type { Context } from "hono";
import type { Deps } from "../../dependencies";

/**
 * GET /agents/:id/status - Get session status for agent
 * Returns OpenCode session status: idle, busy, or retry
 */
export async function getStatus(c: Context, deps: Pick<Deps, "agentsDB" | "harnesses">) {
  const { agentsDB, harnesses } = deps;

  const agentId = c.req.param("id");

  try {
    // Lookup agent to get session_id
    const agent = agentsDB.getAgentById(agentId);
    if (!agent) {
      return c.json({ error: `Agent ${agentId} not found` }, 404);
    }

    // Fetch all session statuses from the harness
    const allStatuses = await harnesses.getSessionStatus();

    // Get status for this specific session (default to idle if not in map)
    const status = allStatuses[agent.session_id] || { type: "idle" };

    return c.json({
      agentId,
      sessionId: agent.session_id,
      status,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
