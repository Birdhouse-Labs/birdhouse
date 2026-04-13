// ABOUTME: Export agent timeline to file for plugin consumption
// ABOUTME: POST endpoint that writes markdown to workspace and returns filepath

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Context } from "hono";
import { type Deps, getHarnessForAgent } from "../../dependencies";
import { formatTimelineItem } from "../api/export-markdown";
import { generateFilenameWithAgentId, generateMarkdownContent } from "./export-helpers";

/**
 * POST /aapi/agents/:id/export - Export agent timeline to file
 * Returns filepath metadata (NOT markdown content to avoid context pollution)
 */
export async function exportMarkdown(c: Context, deps: Pick<Deps, "agentsDB" | "harnesses">) {
  const { agentsDB } = deps;
  const agentId = c.req.param("id");

  try {
    // Parse request body
    const body = await c.req.json();
    const { directory } = body;

    // Validate required parameter
    if (!directory) {
      return c.json({ error: "directory parameter is required" }, 400);
    }

    // Lookup agent
    const agent = agentsDB.getAgentById(agentId);
    if (!agent) {
      return c.json({ error: `Agent ${agentId} not found` }, 404);
    }

    // Generate markdown content using shared helper
    const markdown = await generateMarkdownContent(agent, agentsDB, getHarnessForAgent(deps, agent), {
      formatTimelineItem,
    });

    // Generate filename with agent_id (for idempotent exports)
    const filename = generateFilenameWithAgentId(agent.title, agent.id);

    // Resolve path (absolute vs relative to BIRDHOUSE_WORKSPACE_ROOT)
    const workspaceRoot = process.env.BIRDHOUSE_WORKSPACE_ROOT || process.cwd();
    const resolvedDirectory = path.isAbsolute(directory) ? directory : path.join(workspaceRoot, directory);

    const filepath = path.join(resolvedDirectory, filename);

    // Create directory if needed (mkdir -p behavior)
    await fs.mkdir(resolvedDirectory, { recursive: true });

    // Write markdown to file
    await fs.writeFile(filepath, markdown, "utf-8");

    // Return metadata only (NO markdown content to avoid context pollution)
    return c.json({
      filepath,
      filename,
      agent_id: agentId,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
