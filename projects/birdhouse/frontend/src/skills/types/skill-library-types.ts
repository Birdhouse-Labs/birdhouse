// ABOUTME: Type definitions for the flat skills-backed library UI shell.
// ABOUTME: Keeps detail behavior intact while simplifying the list side around one visible skills list.

export type SkillScope = "workspace" | "global";
export type SkillListScopeFilter = "all" | SkillScope;

/**
 * Skill metadata shown in the flat library list
 */
export interface SkillMetadata {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  trigger_phrases: string[];
  scope: SkillScope;
  readonly: boolean;
}

/**
 * Flat list response for the current workspace's visible skills
 */
export interface SkillLibraryResponse {
  skills: SkillMetadata[];
}

/**
 * Full skill detail shown in the detail pane
 */
export interface SkillDetail {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  prompt: string;
  trigger_phrases: string[];
  files: string[];
  readonly: boolean;
  scope: SkillScope;
  location: string;
  display_location: string;
}

/**
 * Update trigger phrases request
 */
export interface UpdateTriggerPhrasesRequest {
  trigger_phrases: string[];
}
