// ABOUTME: Stops every agent session in the selected tree from the current workspace.
// ABOUTME: Resolves the tree from the selected agent and aborts each session once.

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import { getWorkspaceRoot } from "../../dependencies";

export async function stopAgentTree(c: Context, deps: Pick<Deps, "agentsDB" | "opencode" | "log">) {
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
    await client.session.abort({
      path: {
        id: treeAgent.session_id,
      },
      query: {
        directory: workspaceRoot,
      },
    });

    agentsDB.updateAgentTimestamp(treeAgent.id);
  }

  return c.json({});
}
