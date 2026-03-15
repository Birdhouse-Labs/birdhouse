// ABOUTME: Type definitions for the skills-backed library UI shell.
// ABOUTME: Keeps the existing shell contracts while mapping them to read-only skill data.

export type PatternScope = "workspace" | "global";

/**
 * Skill metadata shown in the library list
 */
export interface PatternMetadata {
  id: string;
  title: string;
  description?: string;
  trigger_phrases: string[];
  scope?: PatternScope;
  location?: string;
}

/**
 * Full skill detail shown in the detail dialog
 */
export interface Pattern {
  id: string;
  group_id: string;
  title: string;
  description?: string;
  metadata: Record<string, unknown>;
  prompt: string;
  trigger_phrases: string[];
  files: string[];
  readonly: boolean;
  scope: PatternScope;
  location: string;
}

/**
 * Skill group used by the reused library shell
 */
export interface PatternGroup {
  id: string;
  title: string;
  description: string;
  scope: PatternScope;
  workspace_id: string | null;
  pattern_count: number;
  readonly: boolean;
  patterns?: PatternMetadata[];
}

/**
 * Section organizing groups in the left navigation
 */
export interface PatternSection {
  id: string;
  title: string;
  subtitle?: string;
  is_current: boolean;
  groups: PatternGroup[];
}

/**
 * Library response for the current workspace's visible skills
 */
export interface PatternLibraryResponse {
  sections: PatternSection[];
}

/**
 * Group detail response for the right-hand library pane
 */
export interface GroupWithPatternsResponse extends PatternGroup {
  patterns: PatternMetadata[];
}

/**
 * Update trigger phrases request
 */
export interface UpdateTriggerPhrasesRequest {
  trigger_phrases: string[];
}
