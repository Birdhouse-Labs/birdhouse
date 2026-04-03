// ABOUTME: Handles GET /api/agents/search with preserved flat and tree response behavior
// ABOUTME: Keeps query parsing separate while preserving sorting, totals, and idle fallback semantics

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import type { AgentNode, AgentRow, SortOrder } from "../../lib/agents-db";
import { loadAllAgentTrees } from "../../lib/agents-db";
import { parseSearchAgentsPolicy } from "./agent-list-policy";

export async function searchAgents(c: Context, deps: Pick<Deps, "agentsDB" | "harness">) {
  const policy = parseSearchAgentsPolicy({
    q: c.req.query("q"),
    includeTrees: c.req.query("includeTrees"),
    sortBy: c.req.query("sortBy"),
    order: c.req.query("order"),
  });

  if (!policy.ok) {
    return c.json({ error: policy.error }, policy.status);
  }

  if (policy.includeTrees) {
    const treeSortBy: SortOrder = policy.sortBy === "relevance" ? "updated_at" : policy.sortBy;
    const { rows, matchedAgentIds } = deps.agentsDB.searchAgentsWithTrees(policy.query, treeSortBy, policy.order);
    const trees = loadAllAgentTrees(deps.agentsDB, treeSortBy, policy.order, rows);
    const sessionStatuses = await deps.harness.getSessionStatus();

    const injectStatus = (node: AgentNode): void => {
      node.status = sessionStatuses[node.session_id] || { type: "idle" };
      node.children.forEach(injectStatus);
    };

    for (const tree of trees) {
      injectStatus(tree.root);
    }

    return c.json({ trees, matchedAgentIds, total: matchedAgentIds.length });
  }

  const agents = deps.agentsDB.searchAgents(policy.query);
  let sortedAgents = agents;

  if (policy.sortBy === "updated_at" || policy.sortBy === "created_at") {
    const timestampSortBy: SortOrder = policy.sortBy;
    sortedAgents = [...agents].sort((a, b) => compareAgentsByTimestamp(a, b, timestampSortBy, policy.order));
  }

  const sessionStatuses = await deps.harness.getSessionStatus();
  const agentsWithStatus = sortedAgents.map((agent) => ({
    ...agent,
    children: [],
    status: sessionStatuses[agent.session_id] || { type: "idle" },
  }));

  return c.json({ agents: agentsWithStatus, total: agents.length });
}

function compareAgentsByTimestamp(a: AgentRow, b: AgentRow, sortBy: SortOrder, order: "asc" | "desc") {
  const aValue = sortBy === "updated_at" ? a.updated_at : a.created_at;
  const bValue = sortBy === "updated_at" ? b.updated_at : b.created_at;
  return order === "desc" ? bValue - aValue : aValue - bValue;
}
