import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import { getWorkspaceRoot } from "../../dependencies";

/**
 * POST /agents/:id/stop - Send message to agent
 */
export async function stopAgent(c: Context, deps: Pick<Deps, "agentsDB" | "opencode" | "log">) {
  const {
    agentsDB,
    opencode: { client },
    log,
  } = deps;

  const workspace = c.get("workspace");
  const workspaceRoot = workspace?.directory || (await getWorkspaceRoot());
  const agentId = c.req.param("id");

  const agent = agentsDB.getAgentById(agentId);
  if (!agent) {
    return c.json({ error: `Agent ${agentId} not found` }, 404);
  }

  log.server.info({ agentId, sessionId: agent.session_id, model: agent.model }, "Stopping agent");

  await client.session.abort({
    path: {
      id: agent.session_id,
    },
    query: {
      directory: workspaceRoot,
    },
  });

  agentsDB.updateAgentTimestamp(agentId);

  return c.json({});
}
