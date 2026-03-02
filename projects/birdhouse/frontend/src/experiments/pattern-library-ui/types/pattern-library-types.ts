// ABOUTME: Type definitions for Pattern Library UI (Experiment 2)
// ABOUTME: Defines patterns, groups, sections, and API response shapes

export type PatternScope = "user" | "workspace" | "birdhouse";

/**
 * Pattern metadata from group list endpoint
 */
export interface PatternMetadata {
  id: string;
  title: string;
  description?: string;
  trigger_phrases: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Full pattern with content (from detail endpoint)
 */
export interface Pattern {
  id: string;
  group_id: string;
  title: string;
  description?: string;
  prompt: string;
  trigger_phrases: string[];
  readonly: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Pattern group with patterns
 */
export interface PatternGroup {
  id: string; // Encoded group ID from API
  title: string;
  description: string;
  scope: PatternScope;
  workspace_id: string | null;
  pattern_count: number;
  readonly: boolean;
  patterns?: PatternMetadata[]; // Only present when group is fetched with patterns
}

/**
 * Section organizing groups
 */
export interface PatternSection {
  id: string;
  title: string;
  subtitle?: string;
  is_current: boolean;
  groups: PatternGroup[];
}

/**
 * API response for list all groups
 */
export interface PatternLibraryResponse {
  sections: PatternSection[];
}

/**
 * API response for get group with patterns
 */
export interface GroupWithPatternsResponse extends PatternGroup {
  patterns: PatternMetadata[];
}

/**
 * Create pattern request
 */
export interface CreatePatternRequest {
  title: string;
  description?: string;
  prompt: string;
  trigger_phrases?: string[];
}

/**
 * Update pattern content request
 */
export interface UpdatePatternRequest {
  title?: string;
  description?: string;
  prompt?: string;
}

/**
 * Update trigger phrases request
 */
export interface UpdateTriggerPhrasesRequest {
  trigger_phrases: string[];
}
