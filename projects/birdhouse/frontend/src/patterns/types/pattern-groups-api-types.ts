// ABOUTME: API response types for pattern-groups endpoints
// ABOUTME: Defines the raw JSON structure returned from backend /api/pattern-groups

/**
 * Pattern metadata from GET /api/pattern-groups/patterns
 * Raw API response shape with snake_case field names
 */
export interface PatternGroupsAPIMetadata {
  id: string;
  title: string;
  description?: string;
  trigger_phrases: string[];
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Full pattern from GET /api/pattern-groups/patterns/:id
 * Includes description and prompt content
 */
export interface PatternGroupsAPI extends PatternGroupsAPIMetadata {
  group_id: string;
  prompt: string;
  readonly: boolean;
}
