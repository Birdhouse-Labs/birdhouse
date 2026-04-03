// ABOUTME: Export entire agent tree as markdown files (tree structure + individual agents)
// ABOUTME: Used by /aapi/agents/:id/export-tree POST endpoint

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import type { AgentNode, AgentRow } from "../../lib/agents-db";
import { formatTimelineItem } from "../api/export-markdown";
import { formatAgentTree } from "../api/tree";
import { generateMarkdownContent } from "./export-helpers";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Collect all agents in a tree in depth-first order
 * Converts AgentNode to AgentRow by looking up full agent data
 */
function collectAgentsDepthFirst(
  node: AgentNode,
  agentsDB: { getAgentById: (id: string) => AgentRow | null },
): AgentRow[] {
  const agents: AgentRow[] = [];

  // Look up full agent data (includes archived_at field)
  const agentRow = agentsDB.getAgentById(node.id);
  if (agentRow) {
    agents.push(agentRow);
  }

  // Recursively add children in depth-first order
  for (const child of node.children) {
    agents.push(...collectAgentsDepthFirst(child, agentsDB));
  }

  return agents;
}

/**
 * Sanitize title for pipe-delimited format
 * Replaces | with fullwidth pipe ｜ and removes newlines
 */
function sanitizeTitleForPipeDelimited(title: string): string {
  return title
    .replace(/\|/g, "｜") // Replace pipe with fullwidth pipe
    .replace(/\n/g, " ") // Replace newlines with spaces
    .replace(/\r/g, ""); // Remove carriage returns
}

/**
 * Generate agent_data.txt content (pipe-delimited agent list)
 */
function generateAgentDataFile(agents: AgentRow[]): string {
  return `${agents.map((agent) => `${sanitizeTitleForPipeDelimited(agent.title)}|${agent.id}`).join("\n")}\n`;
}

/**
 * Build tree structure from agents array
 * Returns root node with children populated and sorted by created_at
 */
function buildTreeStructure(treeAgents: AgentRow[]): AgentNode {
  // Find root
  const root = treeAgents.find((a) => a.level === 0);
  if (!root) {
    throw new Error("Tree root not found");
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

  // Sort children by created_at for deterministic ordering
  function sortChildren(node: AgentNode) {
    node.children.sort((a, b) => a.created_at - b.created_at);
    for (const child of node.children) {
      sortChildren(child);
    }
  }

  const rootNode = nodeMap.get(root.id);
  if (!rootNode) {
    throw new Error("Failed to build tree");
  }

  sortChildren(rootNode);

  return rootNode;
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * POST /aapi/agents/:id/export-tree - Export entire agent tree
 */
export async function exportTree(c: Context, deps: Pick<Deps, "agentsDB" | "harness" | "log">) {
  const { agentsDB, harness, log } = deps;
  const agentId = c.req.param("id");

  try {
    // Parse request body
    const { directory } = await c.req.json();

    // Validate required parameter
    if (!directory) {
      return c.json({ error: "directory parameter is required" }, 400);
    }

    // Get agent to find tree_id
    const agent = agentsDB.getAgentById(agentId);
    if (!agent) {
      return c.json({ error: `Agent ${agentId} not found` }, 404);
    }

    log.server.info({ agent_id: agentId, tree_id: agent.tree_id, directory }, "Starting tree export");

    // Load all agents in this tree
    const allAgents = agentsDB.getAllAgents("updated_at");
    const treeAgents = allAgents.filter((a) => a.tree_id === agent.tree_id);

    if (treeAgents.length === 0) {
      return c.json({ error: "Tree not found" }, 404);
    }

    // Build tree structure
    const rootNode = buildTreeStructure(treeAgents);

    // Collect agents in depth-first order
    const agentsInOrder = collectAgentsDepthFirst(rootNode, agentsDB);

    log.server.info({ agent_count: agentsInOrder.length }, "Collected agents in depth-first order");

    // Resolve directory path (absolute vs relative)
    const workspaceRoot = process.env.BIRDHOUSE_WORKSPACE_ROOT || process.cwd();
    const resolvedDirectory = path.isAbsolute(directory) ? directory : path.join(workspaceRoot, directory);

    // Create directory if needed
    await fs.mkdir(resolvedDirectory, { recursive: true });

    log.server.info({ resolved_directory: resolvedDirectory }, "Created export directory");

    // Generate and write tree.md
    const treeMarkdown = formatAgentTree(rootNode);
    const treePath = path.join(resolvedDirectory, "tree.md");
    await fs.writeFile(treePath, treeMarkdown, "utf-8");

    log.server.info("Wrote tree.md");

    // Generate and write agent_data.txt
    const agentDataContent = generateAgentDataFile(agentsInOrder);
    const agentDataPath = path.join(resolvedDirectory, "agent_data.txt");
    await fs.writeFile(agentDataPath, agentDataContent, "utf-8");

    log.server.info("Wrote agent_data.txt");

    // Export individual agents with error handling
    const results = {
      success: [] as string[],
      failed: [] as { agent_id: string; error: string }[],
    };

    for (const agentToExport of agentsInOrder) {
      try {
        log.server.info({ agent_id: agentToExport.id }, "Exporting agent");

        // Generate markdown content
        const markdown = await generateMarkdownContent(agentToExport, agentsDB, harness, { formatTimelineItem });

        // Generate filename with agent_id
        const filename = `${agentToExport.id}.md`;
        const filepath = path.join(resolvedDirectory, filename);

        // Write file
        await fs.writeFile(filepath, markdown, "utf-8");

        results.success.push(filename);
        log.server.info({ agent_id: agentToExport.id, filename }, "Agent exported successfully");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.failed.push({
          agent_id: agentToExport.id,
          error: errorMessage,
        });
        log.server.error({ agent_id: agentToExport.id, error: errorMessage }, "Failed to export agent");
      }
    }

    log.server.info(
      {
        total_agents: agentsInOrder.length,
        exported: results.success.length,
        failed: results.failed.length,
      },
      "Tree export completed",
    );

    // Return summary
    return c.json({
      success: true,
      directory: resolvedDirectory,
      files_created: {
        tree: "tree.md",
        agent_data: "agent_data.txt",
        agents: results.success,
      },
      summary: {
        total_agents: agentsInOrder.length,
        exported_count: results.success.length,
        failed_count: results.failed.length,
        failures: results.failed,
      },
    });
  } catch (error) {
    log.server.error(
      {
        agent_id: agentId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Tree export failed",
    );

    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
