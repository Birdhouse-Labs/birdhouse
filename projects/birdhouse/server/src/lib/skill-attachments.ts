// ABOUTME: Server-owned skill attachment matching and XML enrichment helpers.
// ABOUTME: Resolves trigger phrase matches into snapshotted skill attachments for prompts and previews.

export interface SkillAttachmentCandidate {
  name: string;
  content: string;
  trigger_phrases: string[];
}

export interface SkillAttachmentPreview {
  name: string;
  content: string;
}

interface SkillMatch {
  attachment: SkillAttachmentPreview;
  start: number;
}

function findBestMatch(text: string, candidate: SkillAttachmentCandidate): SkillMatch | null {
  const normalizedText = text.toLocaleLowerCase();
  let bestMatch: { start: number; phraseLength: number } | null = null;

  for (const phrase of candidate.trigger_phrases) {
    const normalizedPhrase = phrase.trim().toLocaleLowerCase();
    if (!normalizedPhrase) {
      continue;
    }

    const start = normalizedText.indexOf(normalizedPhrase);
    if (start === -1) {
      continue;
    }

    if (
      bestMatch === null ||
      start < bestMatch.start ||
      (start === bestMatch.start && normalizedPhrase.length > bestMatch.phraseLength)
    ) {
      bestMatch = {
        start,
        phraseLength: normalizedPhrase.length,
      };
    }
  }

  if (bestMatch === null) {
    return null;
  }

  return {
    attachment: {
      name: candidate.name,
      content: candidate.content,
    },
    start: bestMatch.start,
  };
}

export function buildSkillAttachmentPreview(
  text: string,
  candidates: SkillAttachmentCandidate[],
): SkillAttachmentPreview[] {
  if (!text.trim()) {
    return [];
  }

  return candidates
    .flatMap((candidate) => {
      const match = findBestMatch(text, candidate);
      return match ? [match] : [];
    })
    .sort((left, right) => left.start - right.start || left.attachment.name.localeCompare(right.attachment.name))
    .map((match) => match.attachment);
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
