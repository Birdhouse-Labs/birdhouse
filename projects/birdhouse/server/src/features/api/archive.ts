// ABOUTME: Archive endpoint handler for archiving agents and their descendants recursively
// ABOUTME: Emits birdhouse.agent.archived SSE event with archived count and IDs

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import { getWorkspaceStream } from "../../lib/opencode-stream";

/**
 * PATCH /api/agents/:id/archive
 * Archive agent and all descendants recursively
 */
export async function archive(c: Context, deps: Pick<Deps, "agentsDB">) {
  const { agentsDB } = deps;
  const agentId = c.req.param("id");

  // Check if agent exists
  const agent = agentsDB.getAgentById(agentId);
  if (!agent) {
    return c.json({ error: `Agent ${agentId} not found` }, 404);
  }

  // Check if agent is already archived
  if (agent.archived_at) {
    return c.json({ error: `Agent ${agentId} is already archived` }, 400);
  }

  // Archive agent and all descendants
  const archivedIds = agentsDB.archiveAgent(agentId);

  // Emit SSE event (if workspace context available)
  const opencodeBase = c.get("opencodeBase");
  const workspace = c.get("workspace");
  if (opencodeBase && workspace?.directory) {
    const workspaceDir = workspace.directory;
    const stream = getWorkspaceStream(opencodeBase, workspaceDir);
    stream.emitCustomEvent("birdhouse.agent.archived", {
      agentId,
      archivedCount: archivedIds.length,
      archivedIds,
    });
  }

  return c.json({
    archivedCount: archivedIds.length,
    archivedIds,
  });
}
