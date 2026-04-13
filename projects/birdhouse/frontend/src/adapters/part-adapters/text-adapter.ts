// ABOUTME: Converts harness text parts to UI TextBlock format
// ABOUTME: Handles text content with timestamp metadata

import type { BirdhouseTextPart } from "../../../../server/src/harness/types";
import type { TextBlock } from "../../types/messages";

/**
 * Map harness text part to UI TextBlock
 * Preserves metadata (e.g., sender info for agent-to-agent messages)
 */
export function mapTextPart(part: BirdhouseTextPart): TextBlock {
  const block: TextBlock = {
    id: part.id,
    type: "text",
    content: part.text,
    ...(part.time?.start !== undefined ? { timestamp: new Date(part.time.start), time: part.time } : {}),
    ...(part.metadata && { metadata: part.metadata }),
  };

  return block;
}
