// ABOUTME: API service for fetching pattern bundles from backend
// ABOUTME: Handles HTTP requests for bundle list and individual bundle details

import { API_ENDPOINT_BASE } from "../../config/api";

/**
 * Error class for bundle fetch failures
 */
export class FetchBundleError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody: string,
    public url: string,
    public override cause?: Error,
  ) {
    super(message);
    this.name = "FetchBundleError";
  }
}

/**
 * Bundle metadata from GET /api/bundles
 * Raw API response shape with snake_case field names
 */
export interface BundleAPIMetadata {
  id: string;
  name: string;
  type: "personal" | "workspace" | "marketplace";
  installed: boolean;
  pattern_count: number;
  description: string;
  created_at?: string;
  updated_at?: string;
  author?: string;
  version?: string;
}

/**
 * Pattern info within a bundle (simplified)
 */
export interface PatternInBundle {
  id: string;
  title: string;
  description: string;
  trigger_phrases: string[];
}

/**
 * Full bundle from GET /api/bundles/:bundleId
 * Includes pattern list
 */
export interface BundleAPI extends BundleAPIMetadata {
  patterns: PatternInBundle[];
}

/**
 * Response from GET /api/bundles
 */
interface BundlesListResponse {
  bundles: BundleAPIMetadata[];
}

/**
 * Fetch all bundles for a workspace
 * @param workspaceId Workspace ID
 * @returns Array of bundle metadata
 */
export async function fetchBundles(workspaceId: string): Promise<BundleAPIMetadata[]> {
  const url = `${API_ENDPOINT_BASE}/bundles?workspaceId=${encodeURIComponent(workspaceId)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to fetch bundles: ${response.statusText}`;

      // Try to extract error from JSON response
      try {
        const errorData = JSON.parse(responseBody);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Response wasn't JSON, use status text
      }

      throw new FetchBundleError(errorMessage, response.status, responseBody, url);
    }

    const data = (await response.json()) as BundlesListResponse;
    return data.bundles;
  } catch (error) {
    // If already FetchBundleError, rethrow
    if (error instanceof FetchBundleError) {
      throw error;
    }

    // Network or other errors - wrap with context
    throw new FetchBundleError(
      `Failed to fetch bundles: ${error instanceof Error ? error.message : "Unknown error"}`,
      0,
      "",
      url,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Fetch a single bundle by ID with pattern list
 * @param bundleId Bundle ID
 * @param workspaceId Workspace ID
 * @returns Full bundle with patterns
 */
export async function fetchBundle(bundleId: string, workspaceId: string): Promise<BundleAPI> {
  const url = `${API_ENDPOINT_BASE}/bundles/${bundleId}?workspaceId=${encodeURIComponent(workspaceId)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to fetch bundle: ${response.statusText}`;

      // Try to extract error from JSON response
      try {
        const errorData = JSON.parse(responseBody);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Response wasn't JSON, use status text
      }

      throw new FetchBundleError(errorMessage, response.status, responseBody, url);
    }

    const bundle = (await response.json()) as BundleAPI;
    return bundle;
  } catch (error) {
    // If already FetchBundleError, rethrow
    if (error instanceof FetchBundleError) {
      throw error;
    }

    // Network or other errors - wrap with context
    throw new FetchBundleError(
      `Failed to fetch bundle ${bundleId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      0,
      "",
      url,
      error instanceof Error ? error : undefined,
    );
  }
}
