// ABOUTME: Builds and restores Birdhouse prompt parts for composer flows.
// ABOUTME: Keeps text and accepted composer attachments aligned with harness-owned part types.

import type { BirdhouseFilePart, BirdhouseInputPart, BirdhousePart, BirdhouseTextPart } from "../harness/types";

function isRestorableComposerAttachmentMime(mime: string): boolean {
  return mime.startsWith("image/") || mime === "application/pdf";
}

export function parseFileAttachments(value: unknown): BirdhouseFilePart[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("attachments must be an array if provided");
  }

  return value.map((attachment, index) => {
    if (!attachment || typeof attachment !== "object") {
      throw new Error(`attachments[${index}] must be an object`);
    }

    const typedAttachment = attachment as {
      type?: unknown;
      mime?: unknown;
      filename?: unknown;
      url?: unknown;
    };

    if (typedAttachment.type !== "file") {
      throw new Error(`attachments[${index}].type must be "file"`);
    }

    if (typeof typedAttachment.mime !== "string" || !typedAttachment.mime.trim()) {
      throw new Error(`attachments[${index}].mime must be a non-empty string`);
    }

    if (typeof typedAttachment.url !== "string" || !typedAttachment.url.trim()) {
      throw new Error(`attachments[${index}].url must be a non-empty string`);
    }

    if (typedAttachment.filename !== undefined && typeof typedAttachment.filename !== "string") {
      throw new Error(`attachments[${index}].filename must be a string if provided`);
    }

    return {
      type: "file",
      mime: typedAttachment.mime,
      url: typedAttachment.url,
      ...(typedAttachment.filename ? { filename: typedAttachment.filename } : {}),
    } satisfies BirdhouseFilePart;
  });
}

export function buildPromptParts(
  text: string,
  attachments: BirdhouseFilePart[],
  metadata?: Record<string, unknown>,
): BirdhouseInputPart[] {
  const parts: BirdhouseInputPart[] = [];

  if (text) {
    parts.push({
      type: "text",
      text,
      ...(metadata ? { metadata } : {}),
    } satisfies BirdhouseTextPart);
  }

  parts.push(...attachments);

  return parts;
}

export function extractRestorableComposerFileAttachments(parts: BirdhousePart[]): BirdhouseFilePart[] {
  return parts.flatMap((part) => {
    if (part.type !== "file") {
      return [];
    }

    if (typeof part.mime !== "string" || !isRestorableComposerAttachmentMime(part.mime)) {
      return [];
    }

    if (typeof part.url !== "string" || !part.url) {
      return [];
    }

    return [
      {
        type: "file",
        mime: part.mime,
        url: part.url,
        ...(typeof part.filename === "string" && part.filename ? { filename: part.filename } : {}),
      } satisfies BirdhouseFilePart,
    ];
  });
}
