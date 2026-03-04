// ABOUTME: Converts OpenCode text parts to UI TextBlock format
// ABOUTME: Handles text content with timestamp metadata

import type { Part } from "@opencode-ai/sdk";
import type { TextBlock } from "../../types/messages";

/**
 * Map OpenCode text part to UI TextBlock
 * Preserves metadata (e.g., sender info for agent-to-agent messages)
 */
export function mapTextPart(part: Part & { type: "text" }): TextBlock {
  const block: TextBlock = {
    id: part.id,
    type: "text",
    content: part.text,
    timestamp: new Date(),
    ...(part.metadata && { metadata: part.metadata }),
  };

  return block;
}
