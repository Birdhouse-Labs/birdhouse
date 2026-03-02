// ABOUTME: Utilities for parsing and extracting pattern XML tags from message content
// ABOUTME: Extracts pattern IDs and strips XML blocks while preserving markdown links

/**
 * Extracts pattern IDs from XML tags in message content
 * Matches: <birdhouse-pattern id="PATTERN_ID">...</birdhouse-pattern>
 * Returns: ['pattern_debug001', 'pattern_tdd002']
 *
 * Handles attributes in any order and both quote styles
 *
 * @param content Message content with potential pattern XML tags
 * @returns Array of unique pattern IDs found in XML tags
 */
export function extractPatternsFromXML(content: string): string[] {
  // Step 1: Find all <birdhouse-pattern> blocks
  const blockRegex = /<birdhouse-pattern\s+[^>]*>[\s\S]*?<\/birdhouse-pattern>/g;
  const blocks = content.match(blockRegex) || [];

  // Step 2: Extract id attribute from each block
  const idRegex = /\bid=["']([^"']+)["']/;
  const ids = new Set<string>();

  for (const block of blocks) {
    const idMatch = block.match(idRegex);
    if (idMatch?.[1]) {
      ids.add(idMatch[1]);
    }
  }

  return Array.from(ids);
}

/**
 * Strips all pattern XML tags from content
 * Leaves markdown links intact
 * Returns: Clean content without XML blocks
 *
 * @param content Message content with potential pattern XML tags
 * @returns Content with XML blocks removed and trimmed
 */
export function stripPatternXML(content: string): string {
  return content.replace(/<birdhouse-pattern\s+[^>]*>[\s\S]*?<\/birdhouse-pattern>/g, "").trim();
}
