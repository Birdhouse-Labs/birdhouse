// ABOUTME: Get timeline items (messages + events) for an agent
// ABOUTME: Used by /api/agents/:id/messages GET endpoint - returns TimelineItem[]

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import type { TimelineItem } from "../../types/agent-events";

/**
 * GET /agents/:id/messages - Get timeline items for agent (messages + events)
 * Returns TimelineItem[] - a discriminated union of OpenCode messages and system events
 */
export async function getMessages(c: Context, deps: Pick<Deps, "agentsDB" | "opencode">) {
  const {
    agentsDB,
    opencode: { getMessages: getMessagesFromOpenCode },
  } = deps;

  const agentId = c.req.param("id");

  try {
    // Lookup agent to get session_id
    const agent = agentsDB.getAgentById(agentId);
    if (!agent) {
      return c.json({ error: `Agent ${agentId} not found` }, 404);
    }

    const limitParam = c.req.query("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    // Fetch messages from OpenCode using session_id
    const messages = await getMessagesFromOpenCode(agent.session_id, limit);

    // Fetch events from events database
    const events = agentsDB.getEventsByAgentId(agentId);

    // Convert messages to TimelineItems
    const messageItems: TimelineItem[] = messages.map((message) => ({
      item_type: "message" as const,
      message,
    }));

    // Convert events to TimelineItems
    const eventItems: TimelineItem[] = events.map((event) => ({
      item_type: "event" as const,
      event: {
        id: event.id,
        event_type: event.event_type,
        timestamp: event.timestamp,
        actor_agent_id: event.actor_agent_id,
        actor_agent_title: event.actor_agent_title || "",
        source_agent_id: event.source_agent_id,
        source_agent_title: event.source_agent_title || "",
        target_agent_id: event.target_agent_id,
        target_agent_title: event.target_agent_title || "",
        metadata: event.metadata ? JSON.parse(event.metadata) : undefined,
      },
    }));

    // Merge and sort by timestamp
    const timeline: TimelineItem[] = [...messageItems, ...eventItems];
    timeline.sort((a, b) => {
      const aTime = a.item_type === "message" ? a.message.info.time.created : a.event.timestamp;
      const bTime = b.item_type === "message" ? b.message.info.time.created : b.event.timestamp;
      if (aTime !== bTime) return aTime - bTime;
      // Events before messages on timestamp ties
      return a.item_type === "event" ? -1 : 1;
    });

    return c.json(timeline);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
