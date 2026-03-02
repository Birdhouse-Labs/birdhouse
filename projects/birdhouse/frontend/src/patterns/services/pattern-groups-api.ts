// ABOUTME: API service for fetching patterns from pattern-groups backend
// ABOUTME: Handles HTTP requests and transforms responses using adapter layer

import { API_ENDPOINT_BASE } from "../../config/api";

import { adaptPatternGroupsMetadata, adaptPatternGroupsPattern } from "../adapters/pattern-groups-adapter";
import { FetchPatternError } from "../types/errors";
import type { PatternGroupsAPI, PatternGroupsAPIMetadata } from "../types/pattern-groups-api-types";
import type { PatternGroupsMetadata, PatternGroupsPattern } from "../types/pattern-groups-types";

/**
 * Fetch all patterns (metadata only) for a workspace
 * @param workspaceId Workspace ID to fetch patterns for
 * @returns Array of UI-ready pattern metadata
 */
export async function fetchAllPatterns(workspaceId: string): Promise<PatternGroupsMetadata[]> {
  const url = `${API_ENDPOINT_BASE}/pattern-groups/patterns?workspaceId=${encodeURIComponent(workspaceId)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to fetch patterns: ${response.statusText}`;

      // Try to extract error from JSON response
      try {
        const errorData = JSON.parse(responseBody);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Response wasn't JSON, use status text
      }

      throw new FetchPatternError(errorMessage, response.status, responseBody, url);
    }

    const data = await response.json();
    const apiPatterns = data.patterns as PatternGroupsAPIMetadata[];

    // Transform API responses to UI types
    return apiPatterns.map(adaptPatternGroupsMetadata);
  } catch (error) {
    // If already FetchPatternError, rethrow
    if (error instanceof FetchPatternError) {
      throw error;
    }

    // Network or other errors - wrap with context
    throw new FetchPatternError(
      `Failed to fetch patterns: ${error instanceof Error ? error.message : "Unknown error"}`,
      0,
      "",
      url,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Fetch a single pattern by ID with full content
 * @param patternId Pattern ID (e.g., "pat_xxxxx")
 * @param workspaceId Workspace ID to search within
 * @returns UI-ready pattern with description and prompt content
 */
export async function fetchPatternById(patternId: string, workspaceId: string): Promise<PatternGroupsPattern> {
  const url = `${API_ENDPOINT_BASE}/pattern-groups/patterns/${encodeURIComponent(patternId)}?workspaceId=${encodeURIComponent(workspaceId)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to fetch pattern: ${response.statusText}`;

      // Try to extract error from JSON response
      try {
        const errorData = JSON.parse(responseBody);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Response wasn't JSON, use status text
      }

      throw new FetchPatternError(errorMessage, response.status, responseBody, url);
    }

    const apiPattern = (await response.json()) as PatternGroupsAPI;

    // Transform API response to UI type
    return adaptPatternGroupsPattern(apiPattern);
  } catch (error) {
    // If already FetchPatternError, rethrow
    if (error instanceof FetchPatternError) {
      throw error;
    }

    // Network or other errors - wrap with context
    throw new FetchPatternError(
      `Failed to fetch pattern ${patternId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      0,
      "",
      url,
      error instanceof Error ? error : undefined,
    );
  }
}
