// ABOUTME: API helpers for previewing server-owned skill attachments before send.
// ABOUTME: Reuses the backend matcher so composer previews stay aligned with final prompt enrichment.

import { buildWorkspaceUrl } from "../config/api";

export interface SkillAttachmentPreview {
  name: string;
  content: string;
}

interface SkillAttachmentsPreviewResponse {
  attachments: SkillAttachmentPreview[];
}

export function dedupeSkillAttachmentPreviews(attachments: SkillAttachmentPreview[]): SkillAttachmentPreview[] {
  const seenNames = new Set<string>();

  return attachments.filter((attachment) => {
    if (seenNames.has(attachment.name)) {
      return false;
    }
    seenNames.add(attachment.name);
    return true;
  });
}

export async function previewSkillAttachments(workspaceId: string, text: string): Promise<SkillAttachmentPreview[]> {
  if (!text.trim()) {
    return [];
  }

  const url = buildWorkspaceUrl(workspaceId, "/skills/attachments/preview");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to preview skill attachments: ${response.statusText} - ${body}`);
  }

  const data = (await response.json()) as SkillAttachmentsPreviewResponse;
  return dedupeSkillAttachmentPreviews(data.attachments);
}
