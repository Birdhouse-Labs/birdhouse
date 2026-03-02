// ABOUTME: Wait for agent completion by proxying to OpenCode's wait endpoint
// ABOUTME: Used by /api/agents/:id/wait and /aapi/agents/:id/wait GET endpoints

import type { Context } from "hono";
import type { Deps } from "../../dependencies";

/**
 * GET /agents/:id/wait - Wait for agent completion (proxies to OpenCode)
 */
export async function wait(c: Context, deps: Pick<Deps, "agentsDB" | "opencode" | "log">) {
  const {
    agentsDB,
    opencode: { waitForSessionCompletion },
    log,
  } = deps;

  const agentId = c.req.param("id");

  try {
    const agent = agentsDB.getAgentById(agentId);
    if (!agent) {
      return c.json({ error: `Agent ${agentId} not found` }, 404);
    }

    log.server.info({ agentId, sessionId: agent.session_id }, "Waiting for agent completion");

    // Call OpenCode's wait endpoint (blocks until truly complete)
    await waitForSessionCompletion(agent.session_id);

    log.server.info({ agentId }, "Agent completed");

    return c.json({
      status: "completed",
      agentId,
      sessionId: agent.session_id,
    });
  } catch (error) {
    log.server.error({ agentId, error }, "Failed to wait for agent");
    return c.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
