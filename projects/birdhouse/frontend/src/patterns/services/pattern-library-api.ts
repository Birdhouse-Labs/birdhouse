// ABOUTME: Skills library API service for the reused frontend shell.
// ABOUTME: Adapts workspace-scoped /skills endpoints into the existing list/detail contracts.

import { API_ENDPOINT_BASE } from "../../config/api";
import type {
  GroupWithPatternsResponse,
  Pattern,
  PatternGroup,
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
    scope: PatternScope;
    trigger_phrases: string[];
    readonly: boolean;
  }>;
}

interface SkillDetailResponse {
  id: string;
  name: string;
  description: string;
  scope: PatternScope;
  trigger_phrases: string[];
  readonly: boolean;
  content: string;
  files: string[];
  location: string;
}

function toPatternMetadata(skill: SkillsListResponse["skills"][number]): PatternMetadata {
  return {
    id: skill.name,
    title: skill.name,
    description: skill.description,
    trigger_phrases: skill.trigger_phrases,
    scope: skill.scope,
  };
}

function buildGroup(scope: PatternScope, workspaceId: string, patterns: PatternMetadata[]): PatternGroup {
  if (scope === "workspace") {
    return {
      id: "workspace",
      title: "Workspace Skills",
      description: "Skills resolved from inside the current workspace directory.",
      scope,
      workspace_id: workspaceId,
      pattern_count: patterns.length,
      readonly: true,
      patterns,
    };
  }

  return {
    id: "global",
    title: "Shared Skills",
    description: "Skills resolved from outside the current workspace directory.",
    scope,
    workspace_id: null,
    pattern_count: patterns.length,
    readonly: true,
    patterns,
  };
}

function toPatternLibraryResponse(data: SkillsListResponse, workspaceId: string): PatternLibraryResponse {
  const workspacePatterns = data.skills.filter((skill) => skill.scope === "workspace").map(toPatternMetadata);
  const globalPatterns = data.skills.filter((skill) => skill.scope === "global").map(toPatternMetadata);

  return {
    sections: [
      {
        id: "workspace",
        title: "Workspace Skills",
        subtitle: "Installed in this workspace's OpenCode runtime",
        is_current: true,
        groups: [buildGroup("workspace", workspaceId, workspacePatterns)],
      },
      {
        id: "global",
        title: "Shared Skills",
        subtitle: "Installed outside this workspace but visible to its OpenCode runtime",
        is_current: false,
        groups: [buildGroup("global", workspaceId, globalPatterns)],
      },
    ],
  };
}

/**
 * Fetch all visible skills organized into sections for the existing shell
 */
export async function fetchPatternLibrary(workspaceId: string): Promise<PatternLibraryResponse> {
  const url = `${API_ENDPOINT_BASE}/workspace/${encodeURIComponent(workspaceId)}/skills`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch skills library: ${response.statusText} - ${text}`);
  }

  return toPatternLibraryResponse((await response.json()) as SkillsListResponse, workspaceId);
}

/**
 * Fetch a single library group by reusing the list endpoint
 */
export async function fetchGroupWithPatterns(groupId: string, workspaceId: string): Promise<GroupWithPatternsResponse> {
  const library = await fetchPatternLibrary(workspaceId);

  for (const section of library.sections) {
    const group = section.groups.find((candidate) => candidate.id === groupId);
    if (group?.patterns) {
      return {
        ...group,
        patterns: group.patterns,
      };
    }
  }

  throw new Error(`Failed to fetch group: Unknown group ${groupId}`);
}

/**
 * Fetch full skill details for the detail dialog
 */
export async function fetchPattern(groupId: string, patternId: string, workspaceId: string): Promise<Pattern> {
  const url = `${API_ENDPOINT_BASE}/workspace/${encodeURIComponent(workspaceId)}/skills/${encodeURIComponent(patternId)}`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch skill: ${response.statusText} - ${text}`);
  }

  const skill = (await response.json()) as SkillDetailResponse;

  return {
    id: skill.name,
    group_id: groupId,
    title: skill.name,
    description: skill.description,
    prompt: skill.content,
    trigger_phrases: skill.trigger_phrases,
    files: skill.files,
    readonly: skill.readonly,
    scope: skill.scope,
    location: skill.location,
  };
}

/**
 * Update trigger phrases for a visible skill
 */
export async function updateTriggerPhrases(
  _groupId: string,
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
