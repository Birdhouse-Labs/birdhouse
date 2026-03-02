// ABOUTME: API service for file search functionality
// ABOUTME: Handles searching files using glob patterns via backend endpoint

import { buildWorkspaceUrl } from "../config/api";

/**
 * A single file search result (file path)
 */
export interface FileSearchResult {
  path: string;
}

/**
 * Response from the backend file search endpoint
 * Returns an array of file path strings
 */
export interface FileSearchResponse {
  files: string[];
}

/**
 * Search for files using glob patterns
 *
 * @param workspaceId - The workspace ID
 * @param query - Search pattern (e.g., "*.ts", "src/components", "Auto*")
 *                Pattern is used as-is, no automatic wildcards added
 * @param directory - Optional: Limit search to specific directory
 * @param includeDirs - Optional: Whether to include directories in results (default: false)
 * @returns Promise resolving to array of file search results
 *
 * @example
 * // Find all TypeScript files
 * const files = await searchFiles(workspaceId, "*.ts");
 *
 * @example
 * // Find files starting with "Auto" in src/ directory
 * const files = await searchFiles(workspaceId, "Auto*", "src");
 *
 * @example
 * // Find directories in src/components
 * const dirs = await searchFiles(workspaceId, "*", "src/components", true);
 */
export async function searchFiles(
  workspaceId: string,
  query: string,
  directory?: string,
  includeDirs?: boolean,
): Promise<FileSearchResult[]> {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    params.append("query", query);

    if (directory) {
      params.append("directory", directory);
    }

    if (includeDirs !== undefined) {
      params.append("dirs", String(includeDirs));
    }

    const url = `${buildWorkspaceUrl(workspaceId, "/files/find/files")}?${params.toString()}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to search files: ${response.statusText}`;

      // Try to extract error from JSON response
      try {
        const errorData = JSON.parse(responseBody);
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Response wasn't JSON, use status text
      }

      throw new Error(errorMessage);
    }

    // Backend returns a simple array of file path strings
    const filePaths = (await response.json()) as string[];

    // Convert to FileSearchResult objects
    return filePaths.map((path) => ({ path }));
  } catch (error) {
    // Provide user-friendly error messages
    if (error instanceof Error) {
      throw new Error(`File search failed: ${error.message}`);
    }
    throw new Error("File search failed: Unknown error");
  }
}
