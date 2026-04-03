// ABOUTME: Handles GET /api/agents tree listing with preserved query validation and statuses
// ABOUTME: Keeps route wiring thin while leaving tree assembly behavior unchanged

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import type { AgentNode } from "../../lib/agents-db";
import { loadAllAgentTrees } from "../../lib/agents-db";
import { parseGetAgentsPolicy } from "./agent-list-policy";

export async function getAgents(c: Context, deps: Pick<Deps, "agentsDB" | "harness">) {
  const policy = parseGetAgentsPolicy({
    sortBy: c.req.query("sortBy"),
  });

  if (!policy.ok) {
    return c.json({ error: policy.error }, policy.status);
  }

  const trees = loadAllAgentTrees(deps.agentsDB, policy.sortBy, "desc");
  const sessionStatuses = await deps.harness.getSessionStatus();

  const injectStatus = (node: AgentNode): void => {
    node.status = sessionStatuses[node.session_id] || { type: "idle" };
    node.children.forEach(injectStatus);
  };

  trees.forEach((tree) => {
    injectStatus(tree.root);
  });

  return c.json({ trees });
}
