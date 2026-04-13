// ABOUTME: Main adapter that converts server harness messages to UI message format
// ABOUTME: Orchestrates part adapters and handles message-level metadata

import type {
  BirdhouseFilePart,
  BirdhouseMessage,
  BirdhousePart,
  BirdhouseReasoningPart,
  BirdhouseTextPart,
  BirdhouseToolPart,
} from "../../../server/src/harness/types";
import type { ServerMessage, SystemEvent, TimelineItem } from "../../../server/src/types/agent-events";
import type { AgentEventBlock, ContentBlock, Message as UIMessage } from "../types/messages";
import { mapFilePart } from "./part-adapters/file-adapter";
import { mapReasoningPart } from "./part-adapters/reasoning-adapter";
import { mapTextPart } from "./part-adapters/text-adapter";
import { mapToolPart } from "./part-adapters/tool-adapter";
import { parseTimestamp } from "./utils/time-utils";

function isTextPart(part: BirdhousePart): part is BirdhouseTextPart {
  return part.type === "text" && "text" in part;
}

function isToolPart(part: BirdhousePart): part is BirdhouseToolPart {
  return part.type === "tool";
}

function isReasoningPart(part: BirdhousePart): part is BirdhouseReasoningPart {
  return part.type === "reasoning" && "text" in part;
}

function isFilePart(part: BirdhousePart): part is BirdhouseFilePart {
  return part.type === "file" && "mime" in part && "url" in part;
}

/**
 * Map a single server message part to a UI ContentBlock
 * Returns null for unknown part types (like step-start) to gracefully skip them
 */
function mapPart(part: BirdhousePart): ContentBlock | null {
  if (isTextPart(part)) return mapTextPart(part);
  if (isToolPart(part)) return mapToolPart(part);
  if (isReasoningPart(part)) return mapReasoningPart(part);
  if (isFilePart(part)) return mapFilePart(part);

  // Unknown part type - skip it gracefully (e.g., step-start, step-end)
  return null;
}

/**
 * Extract plain text content from message parts
 * Concatenates all text parts for the message.content field
 */
function extractTextContent(parts: BirdhousePart[]): string {
  return parts
    .filter(isTextPart)
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
    messageInfo: info,
    content,
    blocks,
    timestamp: parseTimestamp(info.time.created),
  };

  // Add assistant-specific fields
  if (info.role === "assistant") {
    uiMessage.model = info.modelID;
    uiMessage.provider = info.providerID;

    // Add token usage data
    if (info.tokens) {
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
    messageInfo: undefined,
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
 * Map a single harness message to UI Message
 */
export function mapMessage(message: BirdhouseMessage): UIMessage {
  return mapServerMessage(message);
}
