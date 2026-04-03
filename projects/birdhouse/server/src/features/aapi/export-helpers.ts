// ABOUTME: Shared helpers for markdown export functionality
// ABOUTME: Used by both /api/export-markdown and /aapi/export-markdown endpoints

import type { BirdhouseMessage as Message } from "../../harness";
import type { AgentRow } from "../../lib/agents-db";
import type { EventType, TimelineItem } from "../../types/agent-events";

/**
 * Generate markdown content from agent timeline
 * Core export logic shared between API and AAPI endpoints
 */
export async function generateMarkdownContent(
  agent: AgentRow,
  agentsDB: { getEventsByAgentId: (id: string) => unknown[] },
  harness: { getMessages: (sessionId: string) => Promise<Message[]> },
  formatters: {
    formatTimelineItem: (item: TimelineItem) => string;
  },
): Promise<string> {
  // Fetch timeline items (messages + events)
  const messages = await harness.getMessages(agent.session_id);
  const events = agentsDB.getEventsByAgentId(agent.id);

  // Convert to TimelineItems
  const messageItems: TimelineItem[] = messages.map((message) => ({
    item_type: "message" as const,
    message,
  }));

  const eventItems: TimelineItem[] = (
    events as Array<{
      id: string;
      event_type: EventType;
      timestamp: number;
      actor_agent_id: string | null;
      actor_agent_title: string | null;
      source_agent_id: string | null;
      source_agent_title: string | null;
      target_agent_id: string | null;
      target_agent_title: string | null;
      metadata: string | null;
    }>
  ).map((event) => ({
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

  // Build markdown
  let markdown = "";

  // Header section
  markdown += `# ${agent.title}\n\n`;
  markdown += `**Agent ID:** ${agent.id}\n`;
  markdown += `**Created:** ${new Date(agent.created_at).toISOString()}\n`;
  markdown += `**Last Updated:** ${new Date(agent.updated_at).toISOString()}\n\n`;
  markdown += "---\n\n";

  // Timeline items
  if (timeline.length === 0) {
    markdown += "_No messages or events yet._\n";
  } else {
    for (const item of timeline) {
      markdown += formatters.formatTimelineItem(item);
    }
  }

  return markdown;
}

/**
 * Slugify title for filename generation
 * Rules: lowercase, replace spaces with hyphens, remove special chars, collapse hyphens
 */
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Generate export filename with timestamp: {title-slug}-{timestamp}.md
 * Used by /api/export for web UI (allows multiple snapshots)
 */
export function generateFilenameWithTimestamp(title: string): string {
  let slug = slugifyTitle(title);

  // Handle empty slug edge case
  if (!slug) {
    slug = "export";
  }

  // Truncate at 50 chars
  if (slug.length > 50) {
    slug = slug.substring(0, 50).replace(/-[^-]*$/, ""); // Truncate at word boundary
  }

  // Generate timestamp: YYYY-MM-DD-HHmm
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const timestamp = `${year}-${month}-${day}-${hours}${minutes}`;

  return `${slug}-${timestamp}.md`;
}

/**
 * Generate export filename with agent ID: {agent_id}.md
 * Used by /aapi/export for plugin (simple format for concatenation)
 */
export function generateFilenameWithAgentId(_title: string, agentId: string): string {
  return `${agentId}.md`;
}
