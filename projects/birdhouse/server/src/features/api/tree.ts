// ABOUTME: Get agent tree visualization as formatted text
// ABOUTME: Shows hierarchical structure with IDs, titles, and models

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import type { AgentNode } from "../../lib/agents-db";

/**
 * Format an agent tree as markdown-friendly text for LLM consumption
 * Uses Birdhouse link format and markdown formatting for rendering
 */
export function formatAgentTree(root: AgentNode, requestingAgentId?: string): string {
  const lines: string[] = [];

  // Recursive function to format nodes
  function formatNode(node: AgentNode, level: number) {
    // Use markdown list format with 2-space indentation per level
    const indentation = "  ".repeat(level);
    const listMarker = level === 0 ? "-" : "-";

    // Extract model name (strip provider prefix if present)
    const modelDisplay = node.model.includes("/") ? node.model.split("/")[1] : node.model;

    // Build markdown line: [Title](birdhouse:agent/id) **LN** `model`
    const title = `[${node.title}](birdhouse:agent/${node.id})`;
    const levelIndicator = `**L${node.level}**`;
    const model = `\`${modelDisplay}\``;

    // Check if this is the requesting agent
    const isYou = node.id === requestingAgentId;
    const youMarker = isYou ? " _This is you_" : "";

    // Format as markdown list item
    lines.push(`${indentation}${listMarker} ${title} ${levelIndicator} ${model}${youMarker}`);

    // Format children
    for (const child of node.children) {
      formatNode(child, level + 1);
    }
  }

  formatNode(root, 0);

  return lines.join("\n");
}

/**
 * GET /agents/:id/tree - Get agent tree visualization
 */
export async function getTree(c: Context, deps: Pick<Deps, "agentsDB" | "log">) {
  const { agentsDB, log } = deps;

  try {
    // 1. Get agent to find tree_id
    const agentId = c.req.param("id");
    const agent = agentsDB.getAgentById(agentId);

    if (!agent) {
      return c.json({ error: `Agent ${agentId} not found` }, 404);
    }

    // 2. Get optional requesting_agent_id from query params (for [THIS IS YOU] marker)
    const requestingAgentId = c.req.query("requesting_agent_id");

    // 3. Load all agents in this tree
    const allAgents = agentsDB.getAllAgents("updated_at");
    const treeAgents = allAgents.filter((a) => a.tree_id === agent.tree_id);

    if (treeAgents.length === 0) {
      return c.json({ error: "Tree not found" }, 404);
    }

    // 4. Build tree structure manually (simple approach for now)
    // Find root
    const root = treeAgents.find((a) => a.level === 0);
    if (!root) {
      return c.json({ error: "Tree root not found" }, 500);
    }

    // Build node map
    const nodeMap = new Map<string, AgentNode>();
    for (const agent of treeAgents) {
      nodeMap.set(agent.id, { ...agent, children: [] });
    }

    // Connect children to parents
    for (const agent of treeAgents) {
      if (agent.parent_id) {
        const parent = nodeMap.get(agent.parent_id);
        const child = nodeMap.get(agent.id);
        if (parent && child) {
          parent.children.push(child);
        }
      }
    }

    const rootNode = nodeMap.get(root.id);
    if (!rootNode) {
      return c.json({ error: "Failed to build tree" }, 500);
    }

    // 5. Format and return
    const formattedTree = formatAgentTree(rootNode, requestingAgentId);

    log.server.info(
      {
        tree_id: agent.tree_id,
        agent_count: treeAgents.length,
        requesting_agent_id: requestingAgentId,
      },
      "Retrieved agent tree",
    );

    return c.text(formattedTree);
  } catch (error) {
    log.server.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Failed to get agent tree",
    );

    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to get agent tree",
      },
      500,
    );
  }
}
