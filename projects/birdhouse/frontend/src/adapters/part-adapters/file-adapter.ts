// ABOUTME: Converts harness file parts to UI FileBlock format
// ABOUTME: Handles image/PDF/attachment content with MIME types

import type { BirdhouseFilePart } from "../../../../server/src/harness/types";
import type { FileBlock } from "../../types/messages";

/**
 * Map harness file part to UI FileBlock
 * Handles images, PDFs, and other file attachments
 */
export function mapFilePart(part: BirdhouseFilePart): FileBlock {
  const block: FileBlock = {
    id: part.id,
    type: "file",
    mimeType: part.mime,
    url: part.url,
  };

  // Add optional filename only if it exists
  if (part.filename !== undefined) {
    block.filename = part.filename;
  }

  return block;
}
