// ABOUTME: Skills library API service for the flat frontend shell.
// ABOUTME: Keeps the backend contract stable while adapting it into flat list and detail models.

import { API_ENDPOINT_BASE } from "../../config/api";
import type {
  Pattern,
  PatternLibraryResponse,
  PatternMetadata,
  PatternScope,
  UpdateTriggerPhrasesRequest,
} from "../types/pattern-library-types";

interface SkillsListResponse {
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    scope: PatternScope;
    trigger_phrases: string[];
    readonly: boolean;
  }>;
}

interface SkillDetailResponse {
  id: string;
  name: string;
  description: string;
  tags: string[];
  scope: PatternScope;
  trigger_phrases: string[];
  readonly: boolean;
  content: string;
  files: string[];
  location: string;
  display_location: string;
  metadata: Record<string, unknown>;
}

function compareSkills(a: PatternMetadata, b: PatternMetadata): number {
  return a.title.localeCompare(b.title);
}

function toPatternMetadata(skill: SkillsListResponse["skills"][number]): PatternMetadata {
  return {
    id: skill.name,
    title: skill.name,
    description: skill.description,
    tags: skill.tags,
    trigger_phrases: skill.trigger_phrases,
    scope: skill.scope,
    readonly: skill.readonly,
  };
}

/**
 * Fetch all visible skills as one flat list for the library UI
 */
export async function fetchPatternLibrary(workspaceId: string): Promise<PatternLibraryResponse> {
  const url = `${API_ENDPOINT_BASE}/workspace/${encodeURIComponent(workspaceId)}/skills`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch skills library: ${response.statusText} - ${text}`);
  }

  const data = (await response.json()) as SkillsListResponse;

  return {
    skills: data.skills.map(toPatternMetadata).sort(compareSkills),
  };
}

/**
 * Fetch full skill details for the detail pane
 */
export async function fetchPattern(patternId: string, workspaceId: string): Promise<Pattern> {
  const url = `${API_ENDPOINT_BASE}/workspace/${encodeURIComponent(workspaceId)}/skills/${encodeURIComponent(patternId)}`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch skill: ${response.statusText} - ${text}`);
  }

  const skill = (await response.json()) as SkillDetailResponse;

  return {
    id: skill.name,
    title: skill.name,
    description: skill.description,
    tags: skill.tags,
    metadata: skill.metadata,
    prompt: skill.content,
    trigger_phrases: skill.trigger_phrases,
    files: skill.files,
    readonly: skill.readonly,
    scope: skill.scope,
    location: skill.location,
    display_location: skill.display_location,
  };
}

/**
 * Update trigger phrases for a visible skill
 */
export async function updateTriggerPhrases(
  patternId: string,
  workspaceId: string,
  data: UpdateTriggerPhrasesRequest,
): Promise<{ name: string; trigger_phrases: string[] }> {
  const url = `${API_ENDPOINT_BASE}/workspace/${encodeURIComponent(workspaceId)}/skills/${encodeURIComponent(patternId)}/trigger-phrases`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update skill trigger phrases: ${response.statusText} - ${text}`);
  }

  return response.json();
}

export async function revealSkillLocation(patternId: string, workspaceId: string): Promise<void> {
  const url = `${API_ENDPOINT_BASE}/workspace/${encodeURIComponent(workspaceId)}/skills/${encodeURIComponent(patternId)}/reveal`;

  const response = await fetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to reveal skill location: ${response.statusText} - ${text}`);
  }
}
