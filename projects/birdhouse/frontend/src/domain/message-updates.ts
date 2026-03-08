// ABOUTME: Pure domain logic for applying streaming part updates to messages
// ABOUTME: Find-or-create pattern for messages and blocks with stable part IDs

import type { SetStoreFunction } from "solid-js/store";
import { produce, reconcile } from "solid-js/store";
import { log } from "../lib/logger";
import type { ContentBlock, Message } from "../types/messages";

/**
 * OpenCode Part structure from streaming events
 * This is the ACTUAL structure from message.part.updated events
 * (not the simplified MessagePart from opencode-client.ts)
 */
export interface StreamingPart {
  id: string; // Stable unique part ID
  sessionID: string;
  messageID: string;
  type: string; // Can be any part type from OpenCode
  time?: {
    start: number;
    end?: number;
  };
  metadata?: Record<string, unknown>; // Part-level metadata (e.g., sender info for text parts)
  // Type-specific fields
  text?: string; // For text/reasoning
  callID?: string; // For tools
  tool?: string; // For tools
  state?: {
    status: "pending" | "running" | "completed" | "error";
    input?: Record<string, unknown>;
    output?: string;
    error?: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }; // For tools
  mime?: string; // For files
  filename?: string; // For files
  url?: string; // For files
}

/**
 * OpenCode part types that we intentionally ignore (don't render, don't log)
 * These are internal/metadata parts that don't need UI representation
 */
const IGNORED_PART_TYPES = new Set([
  "step-start", // Multi-step workflow start marker
  "step-finish", // Multi-step workflow end marker
  "subtask", // Subtask metadata
  "snapshot", // Code snapshot
  "patch", // File changes
  "agent", // Agent switch
  "retry", // Retry attempt
  "compaction", // History compaction
]);

/**
 * Convert OpenCode streaming part to UI ContentBlock
 * Returns null for unknown part types (e.g., step-start, subtask, patch)
 */
export function partToBlock(part: StreamingPart): ContentBlock | null {
  switch (part.type) {
    case "text": {
      const block: ContentBlock = {
        id: part.id,
        type: "text",
        content: part.text || "",
        isStreaming: !part.time?.end, // Streaming if no end time
        ...(part.metadata && { metadata: part.metadata }),
      };
      if (part.time?.start) {
        block.timestamp = new Date(part.time.start);
        block.time = part.time;
      }
      return block;
    }

    case "reasoning": {
      const content = part.text ?? "";
      if (!content.trim()) {
        return null;
      }
      const block: ContentBlock = {
        id: part.id,
        type: "reasoning",
        content,
        isStreaming: !part.time?.end,
      };
      if (part.time?.start) {
        block.timestamp = new Date(part.time.start);
        block.time = part.time;
      }
      return block;
    }

    case "tool": {
      const block: ContentBlock = {
        id: part.id,
        type: "tool",
        callID: part.callID || "",
        name: part.tool || "",
        status: part.state?.status || "pending",
        input: part.state?.input || {},
      };
      if (part.state?.title) block.title = part.state.title;
      if (part.state?.output) block.output = part.state.output;
      if (part.state?.error) block.error = part.state.error;
      if (part.state?.metadata) block.metadata = part.state.metadata;
      if (part.time?.start) {
        block.timestamp = new Date(part.time.start);
        block.time = part.time;
      }
      return block;
    }

    case "file": {
      const block: ContentBlock = {
        id: part.id,
        type: "file",
        mimeType: part.mime || "",
        url: part.url || "",
      };
      if (part.filename) block.filename = part.filename;
      return block;
    }

    default:
      // Check if this is a known-ignorable part type
      if (IGNORED_PART_TYPES.has(part.type)) {
        // Silently skip - these are internal OpenCode parts we don't render
        return null;
      }

      // Unexpected part type - log it so we can add support if needed
      log.api.warn("Unexpected part type received from stream", {
        partType: part.type,
        partId: part.id,
        messageId: part.messageID,
        sessionId: part.sessionID,
        partData: part,
      });
      return null;
  }
}

/**
 * Extract plain text content from blocks for backward compatibility
 */
function extractTextContent(blocks: ContentBlock[]): string {
  return blocks
    .filter((block) => block.type === "text")
    .map((block) => block.content)
    .join("\n\n");
}

/**
 * Incremental delta from OpenCode's message.part.delta event
 * Emitted during streaming to append text/reasoning content character by character
 */
export interface StreamingPartDelta {
  sessionID: string;
  messageID: string;
  partID: string;
  field: string; // "text" for text/reasoning parts
  delta: string;
}

/**
 * Apply an incremental text delta to an existing block.
 * Only handles "text" field deltas — other fields are no-ops.
 * Silently no-ops when message or block don't exist yet.
 */
export function handlePartDelta(
  delta: StreamingPartDelta,
  messages: Message[],
  setMessages: SetStoreFunction<Message[]>,
): void {
  // Only handle text field deltas — other fields don't need incremental UI updates
  if (delta.field !== "text") return;

  const msgIndex = messages.findIndex((m) => m.id === delta.messageID);
  if (msgIndex === -1) return;

  const message = messages[msgIndex];
  if (!message) return;

  const blockIndex = message.blocks?.findIndex((b) => b.id === delta.partID);
  if (blockIndex === undefined || blockIndex === -1) {
    // Block hasn't been created yet via message.part.updated — drop this delta.
    // The subsequent message.part.updated will set the final text content.
    return;
  }

  const block = message.blocks?.[blockIndex];
  if (!block || (block.type !== "text" && block.type !== "reasoning")) return;

  // Use produce to mutate through the union type — the deep path setter
  // can't resolve "content" as valid across all ContentBlock variants
  setMessages(
    produce((draft) => {
      const draftBlock = draft[msgIndex]?.blocks?.[blockIndex];
      if (!draftBlock || (draftBlock.type !== "text" && draftBlock.type !== "reasoning")) return;
      draftBlock.content = (draftBlock.content ?? "") + delta.delta;

      // Keep message-level content field in sync
      const msg = draft[msgIndex];
      if (msg) msg.content = (msg.content ?? "") + delta.delta;
    }),
  );
}

/**
 * Pure function to handle streaming part updates
 * Implements find-or-create pattern for messages and blocks
 *
 * @param part - Streaming part from message.part.updated event
 * @param messages - Current messages array (read-only reference)
 * @param setMessages - Store setter function for granular updates
 */
export function handlePartUpdate(
  part: StreamingPart,
  messages: Message[],
  setMessages: SetStoreFunction<Message[]>,
): void {
  log.api.debug("handlePartUpdate called", {
    partType: part.type,
    partId: part.id,
    messageId: part.messageID,
    currentMessageCount: messages.length,
  });

  // Find existing message
  const msgIndex = messages.findIndex((m) => m.id === part.messageID);

  if (msgIndex === -1) {
    log.api.warn("Received part for non-existent message", {
      messageId: part.messageID,
      partType: part.type,
      monitor: true,
      developerNote:
        "Expected message.updated to arrive before message.part.updated - if this happens frequently, consider adding ghost message fallback",
    });
    // Skip this part - message.updated event will create the message
    return;
  }

  log.api.debug("Updating existing message", {
    msgIndex,
    messageId: part.messageID,
    currentBlocks: messages[msgIndex]?.blocks?.length || 0,
  });

  // Find existing block within message
  const currentMessage = messages[msgIndex];
  if (!currentMessage) return;

  const blockIndex = currentMessage.blocks?.findIndex((b) => b.id === part.id);

  // Ensure blocks array exists
  if (!currentMessage.blocks) {
    setMessages(msgIndex, "blocks", []);
  }

  if (blockIndex === undefined || blockIndex === -1) {
    // New block - convert and insert if supported type
    const newBlock = partToBlock(part);
    if (!newBlock) {
      // Unknown part type - already logged in partToBlock, just skip
      return;
    }

    setMessages(msgIndex, "blocks", (blocks = []) => {
      // RACE-SAFE: Check if block already exists within setter
      // This prevents duplicates when rapid events arrive before state flushes
      const existingIndex = blocks.findIndex((b) => b.id === newBlock.id);
      if (existingIndex !== -1) {
        // Block was already added by a previous event - update it instead
        log.api.debug("Deduped rapid part update", {
          partId: newBlock.id,
          messageId: part.messageID,
          monitor: true,
        });
        // Remove old block and re-insert at correct position to maintain sort order
        const withoutOld = blocks.filter((_, i) => i !== existingIndex);
        const startTime = part.time?.start || 0;

        // Find insertion point in the filtered array
        const insertIdx = withoutOld.findIndex((b) => {
          if (!b || !("time" in b)) return false;
          const blockTime = b.time?.start || 0;
          return blockTime > startTime;
        });

        if (insertIdx === -1) {
          return [...withoutOld, newBlock];
        }

        return [...withoutOld.slice(0, insertIdx), newBlock, ...withoutOld.slice(insertIdx)];
      }

      const startTime = part.time?.start || 0;

      // Find insertion point (keep blocks sorted by start time)
      const insertIdx = blocks.findIndex((b) => {
        if (!b || !("time" in b)) return false;
        const blockTime = b.time?.start || 0;
        return blockTime > startTime;
      });

      if (insertIdx === -1) {
        // Append at end
        return [...blocks, newBlock];
      }

      // Insert at correct position
      return [...blocks.slice(0, insertIdx), newBlock, ...blocks.slice(insertIdx)];
    });
  } else {
    // Update existing block (granular update)
    const updatedBlock = partToBlock(part);
    if (!updatedBlock) {
      // Part type changed to unsupported? Remove the block
      setMessages(msgIndex, "blocks", (blocks = []) => blocks.filter((_, i) => i !== blockIndex));
      return;
    }

    // Check if time changed - if so, need to re-sort
    const oldBlock = currentMessage.blocks?.[blockIndex];
    const oldTime = oldBlock && "time" in oldBlock ? oldBlock.time?.start : undefined;
    const newTime = "time" in updatedBlock ? updatedBlock.time?.start : undefined;

    if (oldTime !== newTime && newTime !== undefined) {
      // Time changed - remove and re-insert to maintain sort order
      setMessages(msgIndex, "blocks", (blocks = []) => {
        const withoutOld = blocks.filter((_, i) => i !== blockIndex);
        const startTime = newTime;

        // Find insertion point
        const insertIdx = withoutOld.findIndex((b) => {
          if (!b || !("time" in b)) return false;
          const blockTime = b.time?.start || 0;
          return blockTime > startTime;
        });

        if (insertIdx === -1) {
          return [...withoutOld, updatedBlock];
        }

        return [...withoutOld.slice(0, insertIdx), updatedBlock, ...withoutOld.slice(insertIdx)];
      });
    } else {
      // Time unchanged - simple reconcile update
      setMessages(msgIndex, "blocks", blockIndex, reconcile(updatedBlock));
    }
  }

  // Update message content field for backward compatibility
  const updatedMessage = messages[msgIndex];
  if (updatedMessage) {
    const updatedBlocks = updatedMessage.blocks || [];
    setMessages(msgIndex, "content", extractTextContent(updatedBlocks));

    // Update streaming status
    const hasStreamingBlocks = updatedBlocks.some((b) => "isStreaming" in b && b.isStreaming);
    setMessages(msgIndex, "isStreaming", hasStreamingBlocks);
  }
}
