// ABOUTME: Utilities for parsing and extracting pattern references from message text
// ABOUTME: Detects markdown links with birdhouse:pattern/[id] format

/**
 * Extract unique pattern IDs from message text
 * Matches: [text](birdhouse:pattern/pattern_xxx)
 * Returns: ['pattern_xxx', 'pattern_yyy']
 */
export function extractPatternReferences(text: string): string[] {
  const pattern = /\[([^\]]+)\]\(birdhouse:pattern\/([^)]+)\)/g;
  const ids = new Set<string>();

  let match: RegExpExecArray | null = pattern.exec(text);
  while (match !== null) {
    const id = match[2];
    if (id) {
      ids.add(id); // Second capture group is the pattern ID
    }
    match = pattern.exec(text);
  }

  return Array.from(ids);
}

/**
 * Count how many unique patterns are referenced in text
 */
export function countPatternReferences(text: string): number {
  return extractPatternReferences(text).length;
}
