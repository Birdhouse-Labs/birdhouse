// ABOUTME: Stops one agent session using the harness resolved from that agent record.
// ABOUTME: Used by /api/agents/:id/stop to abort the active session and refresh timestamps.

import type { Context } from "hono";
import { getHarnessForAgent, type Deps } from "../../dependencies";

/**
 * POST /agents/:id/stop - Send message to agent
 */
export async function stopAgent(c: Context, deps: Pick<Deps, "agentsDB" | "harnesses" | "log">) {
  const { agentsDB, log } = deps;
  const agentId = c.req.param("id");

  const agent = agentsDB.getAgentById(agentId);
  if (!agent) {
    return c.json({ error: `Agent ${agentId} not found` }, 404);
  }

  log.server.info({ agentId, sessionId: agent.session_id, model: agent.model }, "Stopping agent");

  const harness = getHarnessForAgent(deps, agent);
  await harness.abortSession(agent.session_id);

  agentsDB.updateAgentTimestamp(agentId);

  return c.json({});
}
