// ABOUTME: Wait for agent completion through the active harness.
// ABOUTME: Used by /api/agents/:id/wait and /aapi/agents/:id/wait GET endpoints

import type { Context } from "hono";
import { getHarnessForAgent, type Deps } from "../../dependencies";

/**
 * GET /agents/:id/wait - Wait for agent completion (proxies to OpenCode)
 */
export async function wait(c: Context, deps: Pick<Deps, "agentsDB" | "harnesses" | "log">) {
  const { agentsDB, log } = deps;

  const agentId = c.req.param("id");

  try {
    const agent = agentsDB.getAgentById(agentId);
    if (!agent) {
      return c.json({ error: `Agent ${agentId} not found` }, 404);
    }

    const harness = getHarnessForAgent(deps, agent);
    const waitForCompletion = harness.waitForCompletion.bind(harness);

    log.server.info({ agentId, sessionId: agent.session_id }, "Waiting for agent completion");

    await waitForCompletion(agent.session_id);

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
