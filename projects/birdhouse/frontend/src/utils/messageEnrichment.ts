// ABOUTME: Message enrichment utilities for injecting pattern XML blocks
// ABOUTME: Fetches pattern content and generates XML tags for agent consumption

import { fetchPatternById } from "../patterns/services/pattern-groups-api";
import { extractPatternReferences } from "./patternReferences";

/**
 * Generates XML block for a pattern
 * Format: <birdhouse-pattern id="PATTERN_ID">prompt content</birdhouse-pattern>
 *
 * @param patternId Pattern ID (e.g., "pat_xxxxx")
 * @param promptContent The pattern's prompt content
 * @returns XML string ready to be appended to message
 */
export function generatePatternXML(patternId: string, promptContent: string): string {
  return `<birdhouse-pattern id="${patternId}">
${promptContent}
</birdhouse-pattern>`;
}

/**
 * Enriches message with pattern XML blocks
 * Fetches full pattern content for each referenced ID and appends XML blocks to message
 *
 * @param text Original message text with pattern markdown references
 * @param patternIds Array of pattern IDs referenced in message
 * @param workspaceId Workspace ID to fetch patterns from
 * @returns Promise resolving to enriched message with XML blocks appended
 * @throws Error if pattern fetch fails
 */
export async function enrichMessageWithPatterns(
  text: string,
  patternIds: string[],
  workspaceId: string,
): Promise<string> {
  if (patternIds.length === 0) {
    return text; // No patterns - return original message
  }

  // Fetch all patterns in parallel
  const patterns = await Promise.all(patternIds.map((id) => fetchPatternById(id, workspaceId)));

  // Generate XML blocks for each pattern
  const xmlBlocks = patterns.map((pattern) => generatePatternXML(pattern.id, pattern.prompt));

  // Append XML blocks to original message
  return `${text}\n\n${xmlBlocks.join("\n\n")}`;
}

/**
 * Prepares a message for sending to an agent
 * Extracts pattern references and enriches with pattern XML blocks
 *
 * @param message Raw message text with potential pattern references
 * @param workspaceId Workspace ID to fetch patterns from
 * @returns Promise resolving to enriched message ready to send to agent
 * @throws Error if pattern fetch fails
 */
export async function prepareMessageForSending(message: string, workspaceId: string): Promise<string> {
  if (!message) return message;

  const patternIds = extractPatternReferences(message);
  if (patternIds.length === 0) {
    return message; // No patterns - return as-is
  }

  return await enrichMessageWithPatterns(message, patternIds, workspaceId);
}
