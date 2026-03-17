// ABOUTME: Server-owned skill link parsing and XML enrichment helpers.
// ABOUTME: Resolves explicit birdhouse:skill markdown links into snapshotted skill attachments.

export interface SkillAttachmentCandidate {
  name: string;
  content: string;
}

export interface SkillAttachmentPreview {
  name: string;
  content: string;
}

const SKILL_LINK_REGEX = /\[[^\]]+\]\(birdhouse:skill\/([^)]+)\)/g;

export function extractLinkedSkillNames(text: string): string[] {
  if (!text.trim()) {
    return [];
  }

  const linkedSkillNames: string[] = [];
  const seenSkillNames = new Set<string>();

  let match = SKILL_LINK_REGEX.exec(text);
  while (match !== null) {
    const encodedSkillName = match[1];
    if (encodedSkillName) {
      try {
        const skillName = decodeURIComponent(encodedSkillName);
        if (!seenSkillNames.has(skillName)) {
          linkedSkillNames.push(skillName);
          seenSkillNames.add(skillName);
        }
      } catch {
        // Fail safe: skip malformed or undecodable links.
      }
    }
    match = SKILL_LINK_REGEX.exec(text);
  }

  return linkedSkillNames;
}

export function buildSkillAttachmentPreview(
  text: string,
  candidates: SkillAttachmentCandidate[],
): SkillAttachmentPreview[] {
  const candidateByName = new Map(candidates.map((candidate) => [candidate.name, candidate]));

  return extractLinkedSkillNames(text).flatMap((skillName) => {
    const candidate = candidateByName.get(skillName);
    return candidate
      ? [
          {
            name: candidate.name,
            content: candidate.content,
          },
        ]
      : [];
  });
}

export function generateSkillXML(name: string, content: string): string {
  return `<skill name="${name}">
${content}
</skill>`;
}

export function enrichMessageWithSkillAttachments(text: string, attachments: SkillAttachmentPreview[]): string {
  if (attachments.length === 0) {
    return text;
  }

  const xmlBlocks = attachments.map((attachment) => generateSkillXML(attachment.name, attachment.content));
  return `${text}\n\n${xmlBlocks.join("\n\n")}`;
}
