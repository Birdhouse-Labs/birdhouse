// ABOUTME: Converts harness reasoning parts to UI ReasoningBlock format
// ABOUTME: Handles LLM thinking/reasoning content

import type { BirdhouseReasoningPart } from "../../../../server/src/harness/types";
import type { ReasoningBlock } from "../../types/messages";

/**
 * Map harness reasoning part to UI ReasoningBlock
 * Used for model's internal reasoning before generating response
 */
export function mapReasoningPart(part: BirdhouseReasoningPart): ReasoningBlock | null {
  const content = part.text ?? "";
  if (!content.trim()) {
    return null;
  }

  return {
    id: part.id,
    type: "reasoning",
    content,
    ...(part.time?.start !== undefined ? { timestamp: new Date(part.time.start), time: part.time } : {}),
  };
}
