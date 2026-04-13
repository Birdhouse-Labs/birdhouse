// ABOUTME: Export agent timeline as markdown for human readability and sharing
// ABOUTME: Formats messages, events, and tool calls following the Birdhouse export spec

import type { Context } from "hono";
import { type Deps, getHarnessForAgent } from "../../dependencies";
import type {
  BirdhouseAssistantMessageInfo,
  BirdhousePart as Part,
  BirdhouseUserMessageInfo as UserMessage,
} from "../../harness";
import type { SystemEvent, TimelineItem } from "../../types/agent-events";
import { generateFilenameWithTimestamp, generateMarkdownContent } from "../aapi/export-helpers";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format duration from start/end timestamps
 * @returns "5.4s" or undefined if end time missing
 */
function formatDuration(startMs: number, endMs: number | undefined): string | undefined {
  if (!endMs) return undefined;
  const durationSeconds = (endMs - startMs) / 1000;
  return `${durationSeconds.toFixed(1)}s`;
}

/**
 * Format timestamp as "YYYY-MM-DD HH:mm:ss"
 */
function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Detect if message was sent by an agent (vs human)
 * Checks first text part for metadata.sent_by_agent_id
 */
function detectAgentMessage(parts: Part[]): { agentId: string; agentTitle: string } | null {
  const firstTextPart = parts.find((p) => p.type === "text") as
    | (Part & { type: "text"; metadata?: Record<string, unknown> })
    | undefined;

  if (!firstTextPart?.metadata?.sent_by_agent_id) {
    return null;
  }

  return {
    agentId: firstTextPart.metadata.sent_by_agent_id as string,
    agentTitle: firstTextPart.metadata.sent_by_agent_title as string,
  };
}

/**
 * Format JSON with 2-space indentation
 */
function formatJSON(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

// ============================================================================
// Part Formatters
// ============================================================================

/**
 * Format text part
 */
function formatTextPart(part: Part & { type: "text" }): string {
  // Skip synthetic text parts
  const synthetic = (part as unknown as { synthetic?: boolean }).synthetic;
  if (synthetic) return "";

  return `${part.text}\n\n`;
}

/**
 * Format reasoning part (thinking)
 */
function formatReasoningPart(part: Part & { type: "reasoning" }): string {
  return `_Thinking:_\n\n${part.text}\n\n`;
}

/**
 * Format tool call part
 */
function formatToolPart(part: Part & { type: "tool" }): string {
  const state = part.state as
    | {
        status: "completed" | "error" | "pending" | "running";
        input?: Record<string, unknown>;
        output?: string;
        error?: string;
        title?: string;
      }
    | undefined;

  const toolName = part.tool || "unknown";
  const input = state?.input || {};
  const status = state?.status || "pending";

  let result = "```\n";
  result += `Tool: ${toolName}\n\n`;
  result += "**Input:**\n";
  result += "```json\n";
  result += formatJSON(input);
  result += "\n```\n";

  if (status === "completed" && state?.output) {
    result += "**Output:**\n";
    result += "```\n";
    result += state.output;
    result += "\n```\n";
  } else if (status === "error" && state?.error) {
    result += "**Error:**\n";
    result += "```\n";
    result += state.error;
    result += "\n```\n";
  }

  result += "```\n\n";
  return result;
}

// ============================================================================
// Message Formatters
// ============================================================================

/**
 * Format user message (human or agent-sent)
 */
function formatUserMessage(_message: UserMessage, parts: Part[]): string {
  const agentInfo = detectAgentMessage(parts);

  let result = "";

  if (agentInfo) {
    // Agent-sent message
    result += `## From Agent [${agentInfo.agentTitle}](birdhouse:agent/${agentInfo.agentId})\n\n`;
  } else {
    // Human message
    result += "## User\n\n";
  }

  // Concatenate all text parts
  const textContent = parts
    .filter((p): p is Part & { type: "text" } => p.type === "text")
    .map((p) => formatTextPart(p))
    .join("");

  result += textContent || "_[No content]_\n\n";
  result += "---\n\n";

  return result;
}

/**
 * Format assistant message with parts
 */
function formatAssistantMessage(message: BirdhouseAssistantMessageInfo, parts: Part[]): string {
  const modelID = message.modelID;
  const providerID = message.providerID;
  const duration = formatDuration(message.time.created, message.time.completed);

  let result = "## Assistant (";
  result += modelID;
  result += " · ";
  result += providerID;
  if (duration) {
    result += " · ";
    result += duration;
  }
  result += ")\n\n";

  // Check for error state
  if (message.error) {
    result += `**Error:** ${message.error.name}\n\n`;
    const errorMessage = (message.error.data as { message?: string } | undefined)?.message || "Unknown error";
    result += `${errorMessage}\n\n`;
    result += "---\n\n";
    return result;
  }

  // Process parts in order: text, tools, reasoning
  const textParts = parts.filter((p): p is Part & { type: "text" } => p.type === "text");
  const toolParts = parts.filter((p): p is Part & { type: "tool" } => p.type === "tool");
  const reasoningParts = parts.filter((p): p is Part & { type: "reasoning" } => p.type === "reasoning");

  // Text parts
  const textContent = textParts.map((p) => formatTextPart(p)).join("");
  if (textContent) {
    result += textContent;
  }

  // Tool parts
  for (const part of toolParts) {
    result += formatToolPart(part);
  }

  // Reasoning parts
  for (const part of reasoningParts) {
    result += formatReasoningPart(part);
  }

  // If no content at all, show placeholder
  if (!textContent && toolParts.length === 0 && reasoningParts.length === 0) {
    result += "_[No content]_\n\n";
  }

  result += "---\n\n";
  return result;
}

/**
 * Format system event (clone_created)
 */
function formatSystemEvent(event: SystemEvent): string {
  let result = "## System Event\n\n";

  // Format actor (human or agent)
  const actor = event.actor_agent_id
    ? `**Agent [${event.actor_agent_title}](birdhouse:agent/${event.actor_agent_id})**`
    : "**Human**";

  // Format source agent
  const source = event.source_agent_id
    ? `**[${event.source_agent_title}](birdhouse:agent/${event.source_agent_id})**`
    : `**${event.source_agent_title}**`; // Deleted agent, title only

  // Format target agent
  const target = event.target_agent_id
    ? `**[${event.target_agent_title}](birdhouse:agent/${event.target_agent_id})**`
    : `**${event.target_agent_title}**`; // Deleted agent, title only

  if (event.event_type === "clone_created") {
    result += `${actor} cloned ${source} to create ${target}\n\n`;
  }

  // Add timestamp
  result += `_${formatTimestamp(event.timestamp)}_\n\n`;
  result += "---\n\n";

  return result;
}

/**
 * Format timeline item (message or event)
 */
export function formatTimelineItem(item: TimelineItem): string {
  if (item.item_type === "event") {
    return formatSystemEvent(item.event);
  }

  const { message } = item;
  if (message.info.role === "user") {
    return formatUserMessage(message.info, message.parts);
  }
  if (message.info.role === "assistant") {
    return formatAssistantMessage(message.info, message.parts);
  }

  return ""; // Unknown role, skip
}

// ============================================================================
// Main Export Handler
// ============================================================================

/**
 * GET /agents/:id/export - Export agent timeline as markdown
 */
export async function exportMarkdown(c: Context, deps: Pick<Deps, "agentsDB" | "harnesses">) {
  const { agentsDB } = deps;
  const agentId = c.req.param("id");

  try {
    // Fetch agent metadata
    const agent = agentsDB.getAgentById(agentId);
    if (!agent) {
      return c.json({ error: `Agent ${agentId} not found` }, 404);
    }

    // Generate markdown content using shared helper
    const harness = getHarnessForAgent(deps, agent);
    const markdown = await generateMarkdownContent(agent, agentsDB, harness, {
      formatTimelineItem,
    });

    // Generate filename with timestamp (for web UI - allows multiple snapshots)
    const filename = generateFilenameWithTimestamp(agent.title);

    // Return markdown with download headers
    return c.text(markdown, 200, {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
