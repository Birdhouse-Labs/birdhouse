// ABOUTME: Converts OpenCode reasoning parts to UI ReasoningBlock format
// ABOUTME: Handles LLM thinking/reasoning content

import type { ReasoningPart } from "@opencode-ai/sdk";
import { generateUUID } from "../../lib/uuid";
import type { ReasoningBlock } from "../../types/messages";

/**
 * Map OpenCode reasoning part to UI ReasoningBlock
 * Used for model's internal reasoning before generating response
 */
export function mapReasoningPart(part: ReasoningPart): ReasoningBlock | null {
  const content = part.text ?? "";
  if (!content.trim()) {
    return null;
  }

  return {
    id: generateUUID(),
    type: "reasoning",
    content,
    timestamp: new Date(),
    time: part.time,
  };
}
