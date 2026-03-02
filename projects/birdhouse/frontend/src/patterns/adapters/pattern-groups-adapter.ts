// ABOUTME: Transforms pattern-groups API responses to UI-friendly types
// ABOUTME: Handles snake_case to camelCase conversion and date parsing

import type { PatternGroupsAPI, PatternGroupsAPIMetadata } from "../types/pattern-groups-api-types";
import type { PatternGroupsMetadata, PatternGroupsPattern } from "../types/pattern-groups-types";

/**
 * Formats a Date object to a display string
 * @param date Date to format
 * @returns Formatted string like "Jan 19, 2026"
 */
function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Transforms API pattern metadata to UI pattern metadata
 * @param apiMetadata Raw API response metadata
 * @returns UI-friendly metadata with parsed dates and camelCase fields
 */
export function adaptPatternGroupsMetadata(apiMetadata: PatternGroupsAPIMetadata): PatternGroupsMetadata {
  const createdAt = new Date(apiMetadata.created_at);
  const updatedAt = new Date(apiMetadata.updated_at);

  const result: PatternGroupsMetadata = {
    id: apiMetadata.id,
    title: apiMetadata.title,
    triggerPhrases: apiMetadata.trigger_phrases,
    createdAt,
    createdAtDisplay: formatDateDisplay(createdAt),
    updatedAt,
    updatedAtDisplay: formatDateDisplay(updatedAt),
  };

  // Add description only if defined
  if (apiMetadata.description !== undefined) {
    result.description = apiMetadata.description;
  }

  return result;
}

/**
 * Transforms full API pattern to UI pattern
 * @param apiPattern Raw API response with content
 * @returns UI-friendly pattern with metadata and content
 */
export function adaptPatternGroupsPattern(apiPattern: PatternGroupsAPI): PatternGroupsPattern {
  return {
    ...adaptPatternGroupsMetadata(apiPattern),
    groupId: apiPattern.group_id,
    prompt: apiPattern.prompt,
    readonly: apiPattern.readonly,
  };
}
