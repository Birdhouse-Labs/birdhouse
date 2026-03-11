// ABOUTME: API service for Pattern Library (Experiment 2)
// ABOUTME: Wraps all pattern-groups endpoints with typed functions

import { API_ENDPOINT_BASE } from "../../../config/api";
import {
  normalizeGroupWithPatternsResponse,
  normalizePatternLibraryResponse,
} from "../../../patterns/utils/patternUiCopy";
import type {
  CreatePatternRequest,
  GroupWithPatternsResponse,
  Pattern,
  PatternLibraryResponse,
  UpdatePatternRequest,
  UpdateTriggerPhrasesRequest,
} from "../types/pattern-library-types";

/**
 * Fetch all pattern groups organized into sections
 */
export async function fetchPatternLibrary(workspaceId: string): Promise<PatternLibraryResponse> {
  const url = `${API_ENDPOINT_BASE}/pattern-groups?workspaceId=${encodeURIComponent(workspaceId)}`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch pattern library: ${response.statusText} - ${text}`);
  }

  return normalizePatternLibraryResponse(await response.json());
}

/**
 * Fetch a single group with its patterns
 */
export async function fetchGroupWithPatterns(
  encodedGroupId: string,
  workspaceId: string,
): Promise<GroupWithPatternsResponse> {
  const url = `${API_ENDPOINT_BASE}/pattern-groups/${encodedGroupId}?workspaceId=${encodeURIComponent(workspaceId)}`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch group: ${response.statusText} - ${text}`);
  }

  return normalizeGroupWithPatternsResponse(await response.json());
}

/**
 * Fetch full pattern details
 */
export async function fetchPattern(encodedGroupId: string, patternId: string, workspaceId: string): Promise<Pattern> {
  const url = `${API_ENDPOINT_BASE}/pattern-groups/${encodedGroupId}/patterns/${patternId}?workspaceId=${encodeURIComponent(workspaceId)}`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch pattern: ${response.statusText} - ${text}`);
  }

  return response.json();
}

/**
 * Create a new pattern in a group
 */
export async function createPattern(
  encodedGroupId: string,
  workspaceId: string,
  data: CreatePatternRequest,
): Promise<Pattern> {
  const url = `${API_ENDPOINT_BASE}/pattern-groups/${encodedGroupId}/patterns?workspaceId=${encodeURIComponent(workspaceId)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create pattern: ${response.statusText} - ${text}`);
  }

  return response.json();
}

/**
 * Update pattern content (title, description, prompt)
 */
export async function updatePattern(
  encodedGroupId: string,
  patternId: string,
  workspaceId: string,
  data: UpdatePatternRequest,
): Promise<Pattern> {
  const url = `${API_ENDPOINT_BASE}/pattern-groups/${encodedGroupId}/patterns/${patternId}?workspaceId=${encodeURIComponent(workspaceId)}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update pattern: ${response.statusText} - ${text}`);
  }

  return response.json();
}

/**
 * Delete a pattern permanently
 */
export async function deletePattern(encodedGroupId: string, patternId: string, workspaceId: string): Promise<void> {
  const url = `${API_ENDPOINT_BASE}/pattern-groups/${encodedGroupId}/patterns/${patternId}?workspaceId=${encodeURIComponent(workspaceId)}`;

  const response = await fetch(url, { method: "DELETE" });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to delete pattern: ${response.statusText} - ${text}`);
  }
}

/**
 * Update trigger phrases for a pattern (works for all scopes including birdhouse)
 */
export async function updateTriggerPhrases(
  encodedGroupId: string,
  patternId: string,
  workspaceId: string,
  data: UpdateTriggerPhrasesRequest,
): Promise<{ id: string; trigger_phrases: string[]; updated_at: string }> {
  const url = `${API_ENDPOINT_BASE}/pattern-groups/${encodedGroupId}/patterns/${patternId}/trigger-phrases?workspaceId=${encodeURIComponent(workspaceId)}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update trigger phrases: ${response.statusText} - ${text}`);
  }

  return response.json();
}
