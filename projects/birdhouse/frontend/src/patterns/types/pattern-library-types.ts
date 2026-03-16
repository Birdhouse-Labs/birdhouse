// ABOUTME: Type definitions for the flat skills-backed library UI shell.
// ABOUTME: Keeps detail behavior intact while simplifying the list side around one visible skills list.

export type PatternScope = "workspace" | "global";
export type SkillListScopeFilter = "all" | PatternScope;

/**
 * Skill metadata shown in the flat library list
 */
export interface PatternMetadata {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  trigger_phrases: string[];
  scope: PatternScope;
  readonly: boolean;
}

/**
 * Flat list response for the current workspace's visible skills
 */
export interface PatternLibraryResponse {
  skills: PatternMetadata[];
}

/**
 * Full skill detail shown in the detail pane
 */
export interface Pattern {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  prompt: string;
  trigger_phrases: string[];
  files: string[];
  readonly: boolean;
  scope: PatternScope;
  location: string;
  display_location: string;
}

/**
 * Update trigger phrases request
 */
export interface UpdateTriggerPhrasesRequest {
  trigger_phrases: string[];
}
