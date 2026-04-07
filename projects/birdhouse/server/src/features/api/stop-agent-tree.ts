// ABOUTME: Stops every agent session in the selected tree from the current workspace.
// ABOUTME: Resolves the tree from the selected agent and aborts each session once.

import type { Context } from "hono";
import { getHarnessForAgent, type Deps } from "../../dependencies";

export async function stopAgentTree(c: Context, deps: Pick<Deps, "agentsDB" | "harnesses" | "log">) {
  const { agentsDB, log } = deps;

  const agentId = c.req.param("id");

  const agent = agentsDB.getAgentById(agentId);
  if (!agent) {
    return c.json({ error: `Agent ${agentId} not found` }, 404);
  }

  const treeAgents = agentsDB.getAgentsByTreeId(agent.tree_id).filter((treeAgent) => treeAgent.archived_at === null);

  log.server.info(
    {
      agentId,
      treeId: agent.tree_id,
      sessionIds: treeAgents.map((treeAgent) => treeAgent.session_id),
    },
    "Stopping agent tree",
  );

  for (const treeAgent of treeAgents) {
    const harness = getHarnessForAgent(deps, treeAgent);
    await harness.abortSession(treeAgent.session_id);

    agentsDB.updateAgentTimestamp(treeAgent.id);
  }

  return c.json({});
}
