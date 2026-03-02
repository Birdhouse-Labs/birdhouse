// ABOUTME: Main adapter that converts server messages (OpenCode) to UI message format
// ABOUTME: Orchestrates part adapters and handles message-level metadata

import type { Part } from "@opencode-ai/sdk";
import type { Message as OCMessage } from "../../../server/src/lib/opencode-client";
import type { ServerMessage, SystemEvent, TimelineItem } from "../../../server/src/types/agent-events";
import type { AgentEventBlock, ContentBlock, Message as UIMessage } from "../types/messages";
import { mapFilePart } from "./part-adapters/file-adapter";
import { mapReasoningPart } from "./part-adapters/reasoning-adapter";
import { mapTextPart } from "./part-adapters/text-adapter";
import { mapToolPart } from "./part-adapters/tool-adapter";
import { parseTimestamp } from "./utils/time-utils";

/**
 * Map a single server message part to a UI ContentBlock
 * Returns null for unknown part types (like step-start) to gracefully skip them
 */
function mapPart(part: Part): ContentBlock | null {
  switch (part.type) {
    case "text":
      return mapTextPart(part);
    case "tool":
      return mapToolPart(part);
    case "reasoning":
      return mapReasoningPart(part);
    case "file":
      return mapFilePart(part);
    default:
      // Unknown part type - skip it gracefully (e.g., step-start, step-end)
      return null;
  }
}

/**
 * Extract plain text content from message parts
 * Concatenates all text parts for the message.content field
 */
function extractTextContent(parts: Part[]): string {
  return parts
    .filter((part): part is Part & { type: "text" } => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
}

/**
 * Map server message (OpenCode) to UI Message
 * Handles both user and assistant messages
 */
function mapServerMessage(serverMessage: ServerMessage): UIMessage {
  const { info, parts } = serverMessage;

  // Map all parts to content blocks, filtering out nulls (unknown types)
  const blocks = parts.map(mapPart).filter((block): block is ContentBlock => block !== null);

  // Extract text content for backward compatibility
  const content = extractTextContent(parts);

  // Build UI message
  const uiMessage: UIMessage = {
    id: info.id,
    role: info.role,
    opencodeMessage: info,
    content,
    blocks,
    timestamp: parseTimestamp(info.time.created),
  };

  // Add assistant-specific fields
  if (info.role === "assistant") {
    uiMessage.model = info.modelID;
    uiMessage.provider = info.providerID;

    // Add token usage data
    uiMessage.tokens = {
      input: info.tokens.input,
      output: info.tokens.output,
      reasoning: info.tokens.reasoning,
      cache: {
        read: info.tokens.cache.read,
        write: info.tokens.cache.write,
      },
    };
  }
  return uiMessage;
}

/**
 * Map a system event to a UI Message with AgentEventBlock
 */
function mapSystemEvent(event: SystemEvent): UIMessage {
  const eventBlock: AgentEventBlock = {
    id: event.id,
    type: "agent_event",
    event_type: event.event_type,
    actor_agent_id: event.actor_agent_id,
    actor_agent_title: event.actor_agent_title,
    source_agent_id: event.source_agent_id,
    source_agent_title: event.source_agent_title,
    target_agent_id: event.target_agent_id,
    target_agent_title: event.target_agent_title,
    timestamp: event.timestamp,
    metadata: event.metadata,
  };

  return {
    id: event.id,
    role: "system",
    opencodeMessage: undefined, // No real OpenCode message
    content: "", // Empty per requirements
    blocks: [eventBlock],
    timestamp: new Date(event.timestamp),
  };
}

/**
 * Map a timeline item (message or event) to UI Message
 */
function mapTimelineItem(item: TimelineItem): UIMessage {
  if (item.item_type === "event") {
    return mapSystemEvent(item.event);
  }
  return mapServerMessage(item.message);
}

/**
 * Map an array of timeline items to UI messages
 * Assumes items are already sorted by timestamp (oldest-first from API)
 * Reverses order for newest-at-top architecture
 */
export function mapMessages(items: TimelineItem[]): UIMessage[] {
  return items.map(mapTimelineItem).reverse();
}

/**
 * Map a single OpenCode message to UI Message
 * Kept for backward compatibility with existing code that expects OCMessage
 */
export function mapMessage(ocMessage: OCMessage): UIMessage {
  return mapServerMessage(ocMessage);
}
