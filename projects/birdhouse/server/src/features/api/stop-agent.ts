import type { Context } from "hono";
import type { Deps } from "../../dependencies";

/**
 * POST /agents/:id/stop - Send message to agent
 */
export async function stopAgent(c: Context, deps: Pick<Deps, "agentsDB" | "harness" | "log">) {
  const { agentsDB, harness, log } = deps;
  const agentId = c.req.param("id");

  const agent = agentsDB.getAgentById(agentId);
  if (!agent) {
    return c.json({ error: `Agent ${agentId} not found` }, 404);
  }

  log.server.info({ agentId, sessionId: agent.session_id, model: agent.model }, "Stopping agent");

  await harness.abortSession(agent.session_id);

  agentsDB.updateAgentTimestamp(agentId);

  return c.json({});
}
