// ABOUTME: Message filtering for plugin/agent consumption - removes internal IDs and metadata
// ABOUTME: Keeps only information useful for agents learning from other agents' work

import type { Message } from "../../../lib/opencode-client";

/**
 * Filtered message info - removes IDs, cost, tokens, mode, agent
 */
export interface FilteredMessageInfo {
  role: "user" | "assistant";
  time: { created: number; completed?: number };
  modelID?: string;
  providerID?: string;
  model?: { providerID: string; modelID: string };
  finish?: string;
  path?: { cwd: string; root: string };
  summary?: string;
  error?: { name: string; message?: string; data?: { message: string } };
}

/**
 * Filtered message part - removes IDs, metadata, step markers
 */
export interface FilteredMessagePart {
  type: string;
  text?: string;
  time?: { start: number; end: number };
  tool?: string;
  state?: Record<string, unknown>;
  mime?: string;
  filename?: string;
  url?: string;
}

/**
 * Filtered message structure for plugin/agent consumption
 */
export interface FilteredMessage {
  info: FilteredMessageInfo;
  parts: FilteredMessagePart[];
}

/**
 * Filter a single message to remove internal IDs, cost data, and UI-only metadata.
 *
 * Removes:
 * - All IDs (sessionID, messageID, parentID, callID)
 * - Cost and token data
 * - Mode and agent fields
 * - Step markers (step-start, step-finish)
 * - Tool metadata field
 *
 * Keeps:
 * - Role, time, model info
 * - Finish reason, path, summary
 * - Text, reasoning, tool calls (with input/output)
 * - File attachments
 */
export function filterMessage(message: Message): FilteredMessage {
  // Filter info object - keep useful fields, remove internal IDs and cost data
  const filteredInfo: FilteredMessageInfo = {
    role: message.info.role,
    time: message.info.time,
  };

  // Add model info for assistant messages
  if ("modelID" in message.info) {
    filteredInfo.modelID = message.info.modelID;
    filteredInfo.providerID = message.info.providerID;
  }

  // Add model info for user messages (nested structure)
  if ("model" in message.info) {
    filteredInfo.model = message.info.model;
  }

  // Include optional fields if present (but not mode, agent, cost, tokens)
  if ("finish" in message.info) filteredInfo.finish = message.info.finish as string | undefined;
  if ("path" in message.info) filteredInfo.path = message.info.path as { cwd: string; root: string } | undefined;
  if ("summary" in message.info) filteredInfo.summary = message.info.summary as string | undefined;
  if ("error" in message.info)
    filteredInfo.error = message.info.error as
      | { name: string; message?: string; data?: { message: string } }
      | undefined;

  // Filter parts array
  const filteredParts = message.parts
    .filter((p) => {
      // Remove step markers (UI only) - these exist in DB but not in typed MessagePart
      const partType = (p as Record<string, unknown>).type;
      if (partType === "step-start" || partType === "step-finish") return false;
      return true;
    })
    .map((p): FilteredMessagePart => {
      // Treat part as a generic record to access fields that may or may not exist
      const part = p as Record<string, unknown>;
      const filtered: FilteredMessagePart = {
        type: part.type as string,
      };

      // Include relevant fields based on part type
      if ("text" in part) filtered.text = part.text as string;
      if ("time" in part) filtered.time = part.time as { start: number; end: number };
      if ("tool" in part) filtered.tool = part.tool as string;

      // Filter tool state - keep everything except metadata
      if ("state" in part && typeof part.state === "object" && part.state !== null) {
        const { metadata, ...stateWithoutMetadata } = part.state as Record<string, unknown> & {
          metadata?: unknown;
        };
        filtered.state = stateWithoutMetadata;
      }

      // Include other content types
      if ("mime" in part) filtered.mime = part.mime as string;
      if ("filename" in part) filtered.filename = part.filename as string;
      if ("url" in part) filtered.url = part.url as string;

      return filtered;
    });

  return {
    info: filteredInfo,
    parts: filteredParts,
  };
}

/**
 * Filter an array of messages for plugin consumption
 */
export function filterMessages(messages: Message[]): FilteredMessage[] {
  return messages.map(filterMessage);
}
