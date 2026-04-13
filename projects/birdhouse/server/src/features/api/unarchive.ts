// ABOUTME: Unarchive endpoint handler for unarchiving agents and their descendants recursively
// ABOUTME: Emits birdhouse.agent.unarchived SSE event with unarchived count and IDs

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import { getWorkspaceEventBus } from "../../lib/birdhouse-event-bus";

/**
 * PATCH /api/agents/:id/unarchive
 * Unarchive agent and all descendants recursively
 */
export async function unarchive(c: Context, deps: Pick<Deps, "agentsDB">) {
  const { agentsDB } = deps;
  const agentId = c.req.param("id");

  // Check if agent exists
  const agent = agentsDB.getAgentById(agentId);
  if (!agent) {
    return c.json({ error: `Agent ${agentId} not found` }, 404);
  }

  // Check if agent is archived
  if (!agent.archived_at) {
    return c.json({ error: `Agent ${agentId} is not archived` }, 400);
  }

  // Unarchive agent and all descendants
  const unarchivedIds = agentsDB.unarchiveAgent(agentId);

  // Emit SSE event (if workspace context available)
  const opencodeBase = c.get("opencodeBase");
  const workspace = c.get("workspace");
  if (opencodeBase && workspace?.directory) {
    const workspaceDir = workspace.directory;
    const birdhouseEventBus = getWorkspaceEventBus(workspaceDir);
    birdhouseEventBus.emit({
      type: "birdhouse.agent.unarchived",
      properties: {
        agentId,
        unarchivedCount: unarchivedIds.length,
        unarchivedIds,
      },
    });
  }

  return c.json({
    unarchivedCount: unarchivedIds.length,
    unarchivedIds,
  });
}
