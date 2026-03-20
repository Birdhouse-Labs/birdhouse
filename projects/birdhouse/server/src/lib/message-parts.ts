// ABOUTME: Builds validated OpenCode prompt parts from Birdhouse request payloads.
// ABOUTME: Keeps text and pasted image attachments aligned with the SDK file-part contract.

import type { FilePartInput, TextPartInput } from "@opencode-ai/sdk/client";

export function parseFileAttachments(value: unknown): FilePartInput[] {
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
      throw new Error(`attachments[${index}].type must be \"file\"`);
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
    } satisfies FilePartInput;
  });
}

export function buildPromptParts(
  text: string,
  attachments: FilePartInput[],
  metadata?: Record<string, unknown>,
): Array<TextPartInput | FilePartInput> {
  const parts: Array<TextPartInput | FilePartInput> = [];

  if (text) {
    parts.push({
      type: "text",
      text,
      ...(metadata ? { metadata } : {}),
    });
  }

  parts.push(...attachments);

  return parts;
}
