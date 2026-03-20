// ABOUTME: Converts pasted browser File objects into composer attachment previews.
// ABOUTME: Produces data URLs so the send layer can forward OpenCode-style file parts.

import type { ComposerImageAttachment } from "../types/composer-attachments";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function createComposerImageAttachments(files: File[]): Promise<ComposerImageAttachment[]> {
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
