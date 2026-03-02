// ABOUTME: Converts OpenCode file parts to UI FileBlock format
// ABOUTME: Handles image/PDF/attachment content with MIME types

import type { FilePart } from "@opencode-ai/sdk";
import { generateUUID } from "../../lib/uuid";
import type { FileBlock } from "../../types/messages";

/**
 * Map OpenCode file part to UI FileBlock
 * Handles images, PDFs, and other file attachments
 */
export function mapFilePart(part: FilePart): FileBlock {
  const block: FileBlock = {
    id: generateUUID(),
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
