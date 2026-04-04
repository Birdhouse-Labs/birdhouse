// ABOUTME: Clone agent endpoint handler for explicitly cloning from a specific message
// ABOUTME: Emits clone_created timeline events on both source and target agents

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import { cloneAgent as cloneAgentDomain } from "../../domain/agent-lifecycle";
import { getWorkspaceEventBus } from "../../lib/birdhouse-event-bus";

/**
 * POST /api/workspace/:workspaceId/agents/:id/clone
 * Clone an agent from a specific message (or full clone if no messageId provided)
 */
export async function cloneAgent(
  c: Context,
  deps: Pick<Deps, "agentsDB" | "dataDb" | "harness" | "log" | "telemetry">,
) {
  const { agentsDB, log } = deps;
  const agentId = c.req.param("id");

  // Get workspace context for stream creation
  const opencodeBase = c.get("opencodeBase");
  const workspace = c.get("workspace");

  if (!opencodeBase || !workspace?.directory) {
    return c.json({ error: "Workspace context not available" }, 500);
  }

  const workspaceDir = workspace.directory;

  // Lookup source agent
  const sourceAgent = agentsDB.getAgentById(agentId);
  if (!sourceAgent) {
    return c.json({ error: `Agent ${agentId} not found` }, 404);
  }

  try {
    // Parse request body (messageId is optional)
    const body = await c.req.json();
    const { messageId } = body;

    log.server.info(
      {
        source_agent_id: sourceAgent.id,
        source_session: sourceAgent.session_id,
        message_id: messageId,
      },
      "Cloning agent from explicit clone request",
    );

    // Clone the agent
    const birdhouseEventBus = getWorkspaceEventBus(workspaceDir);
    const clonedAgent = await cloneAgentDomain(
      sourceAgent,
      { ...deps, birdhouseEventBus },
      {
        title: sourceAgent.title, // Keep same title
        messageId: messageId || undefined, // Clone from specific message or full clone
      },
    );

    log.server.info(
      {
        source_agent: sourceAgent.id,
        cloned_agent: clonedAgent.id,
        tree_id: clonedAgent.tree_id,
        level: clonedAgent.level,
        from_message_id: messageId,
      },
      "Agent cloned successfully from explicit clone request",
    );

    // Insert timeline events for clone_created (same pattern as clone_and_send)
    try {
      const now = Date.now();

      // Common event data for both events
      const eventData = {
        event_type: "clone_created" as const,
        timestamp: now,
        actor_agent_id: null, // Human performed the action
        actor_agent_title: null,
        source_agent_id: sourceAgent.id,
        source_agent_title: sourceAgent.title,
        target_agent_id: clonedAgent.id,
        target_agent_title: clonedAgent.title,
        metadata: null,
      };

      // Event 1: On source agent's timeline
      const sourceEvent = agentsDB.insertEvent({
        agent_id: sourceAgent.id,
        ...eventData,
      });

      birdhouseEventBus.emit({
        type: "birdhouse.event.created",
        properties: {
          agentId: sourceAgent.id,
          event: {
            id: sourceEvent.id,
            event_type: sourceEvent.event_type,
            timestamp: sourceEvent.timestamp,
            actor_agent_id: sourceEvent.actor_agent_id,
            actor_agent_title: sourceEvent.actor_agent_title,
            source_agent_id: sourceEvent.source_agent_id,
            source_agent_title: sourceEvent.source_agent_title,
            target_agent_id: sourceEvent.target_agent_id,
            target_agent_title: sourceEvent.target_agent_title,
            metadata: sourceEvent.metadata ? JSON.parse(sourceEvent.metadata) : undefined,
          },
        },
      });

      // Event 2: On target agent's timeline
      const targetEvent = agentsDB.insertEvent({
        agent_id: clonedAgent.id,
        ...eventData,
      });

      birdhouseEventBus.emit({
        type: "birdhouse.event.created",
        properties: {
          agentId: clonedAgent.id,
          event: {
            id: targetEvent.id,
            event_type: targetEvent.event_type,
            timestamp: targetEvent.timestamp,
            actor_agent_id: targetEvent.actor_agent_id,
            actor_agent_title: targetEvent.actor_agent_title,
            source_agent_id: targetEvent.source_agent_id,
            source_agent_title: targetEvent.source_agent_title,
            target_agent_id: targetEvent.target_agent_id,
            target_agent_title: targetEvent.target_agent_title,
            metadata: targetEvent.metadata ? JSON.parse(targetEvent.metadata) : undefined,
          },
        },
      });

      log.server.info(
        {
          source_agent: sourceAgent.id,
          cloned_agent: clonedAgent.id,
        },
        "Timeline events inserted and streamed for clone",
      );
    } catch (error) {
      log.server.error(
        {
          source_agent: sourceAgent.id,
          cloned_agent: clonedAgent.id,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to insert timeline events for clone",
      );
      throw error;
    }

    return c.json(clonedAgent, 201);
  } catch (error) {
    log.server.error(
      {
        source_agent_id: sourceAgent.id,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Failed to clone agent",
    );

    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to clone agent",
      },
      500,
    );
  }
}
