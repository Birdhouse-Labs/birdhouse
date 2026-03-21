// ABOUTME: Converts accepted pasted, dropped, and restored files into composer attachment previews.
// ABOUTME: Produces data URLs so the send layer can forward OpenCode-style file parts.

import type { ComposerAttachment, ComposerAttachmentPayload } from "../types/composer-attachments";

export const ACCEPTED_COMPOSER_ATTACHMENT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
] as const;

export function isAcceptedComposerAttachmentType(mime: string): boolean {
  return ACCEPTED_COMPOSER_ATTACHMENT_MIME_TYPES.includes(
    mime as (typeof ACCEPTED_COMPOSER_ATTACHMENT_MIME_TYPES)[number],
  );
}

export function filterAcceptedComposerAttachmentFiles(files: File[]): File[] {
  return files.filter((file) => isAcceptedComposerAttachmentType(file.type));
}

export function getComposerAttachmentError(files: File[]): string | null {
  if (files.length === 0) {
    return null;
  }

  return files.some((file) => !isAcceptedComposerAttachmentType(file.type))
    ? "Only images and PDFs can be attached."
    : null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function createComposerAttachments(files: File[]): Promise<ComposerAttachment[]> {
  const validationError = getComposerAttachmentError(files);
  if (validationError) {
    throw new Error(validationError);
  }

  const attachments = await Promise.all(
    files.map(async (file, index) => ({
      id: `${Date.now()}_${index}_${file.name}`,
      filename: file.name,
      mime: file.type,
      url: await readFileAsDataUrl(file),
    })),
  );

  return attachments;
}

export function restoreComposerImageAttachments(attachments: ComposerAttachmentPayload[]): ComposerAttachment[] {
  return attachments.map((attachment, index) => ({
    id: `${Date.now()}_restored_${index}_${attachment.filename || "attachment"}`,
    filename: attachment.filename || `attachment-${index + 1}`,
    mime: attachment.mime,
    url: attachment.url,
  }));
}

export const createComposerImageAttachments = createComposerAttachments;
export const restoreComposerAttachments = restoreComposerImageAttachments;
