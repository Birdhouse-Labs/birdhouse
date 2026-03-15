// ABOUTME: Utilities for parsing and extracting attached skill XML from message content.
// ABOUTME: Extracts snapshotted skill payloads and strips XML blocks while preserving visible text.

export interface SkillAttachmentSnapshot {
  name: string;
  content: string;
}

/**
 * Extracts skill snapshots from XML tags in message content.
 */
export function extractSkillsFromXML(content: string): SkillAttachmentSnapshot[] {
  const blockRegex = /<skill\s+[^>]*>[\s\S]*?<\/skill>/g;
  const blocks = content.match(blockRegex) || [];
  const nameRegex = /\bname=["']([^"']+)["']/;
  const snapshots: SkillAttachmentSnapshot[] = [];
  const seenNames = new Set<string>();

  for (const block of blocks) {
    const nameMatch = block.match(nameRegex);
    const name = nameMatch?.[1];
    if (!name || seenNames.has(name)) {
      continue;
    }

    const contentStart = block.indexOf(">") + 1;
    const contentEnd = block.lastIndexOf("</skill>");
    const snapshotContent = block.slice(contentStart, contentEnd).trim();

    snapshots.push({ name, content: snapshotContent });
    seenNames.add(name);
  }

  return snapshots;
}

/**
 * Strips all attached skill XML tags from content.
 */
export function stripSkillXML(content: string): string {
  return content.replace(/<skill\s+[^>]*>[\s\S]*?<\/skill>/g, "").trim();
}
