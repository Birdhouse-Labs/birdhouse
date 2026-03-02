// ABOUTME: API service for workspace configuration operations
// ABOUTME: Handles fetching and updating workspace config and title

import { API_ENDPOINT_BASE } from "../../config/api";

import { adaptWorkspaceConfig, toWorkspaceConfigUpdateAPI } from "../adapters/config-adapter";
import type { WorkspaceConfig, WorkspaceConfigUpdate } from "../types/config-types";

/**
 * Fetch workspace configuration
 * @param workspaceId Workspace ID
 * @returns Workspace configuration
 */
export async function fetchWorkspaceConfig(workspaceId: string): Promise<WorkspaceConfig> {
  const url = `${API_ENDPOINT_BASE}/workspaces/${workspaceId}/config`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to fetch workspace config: ${response.statusText}`;

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

    const apiConfig = await response.json();
    return adaptWorkspaceConfig(apiConfig);
  } catch (error) {
    throw new Error(`Failed to fetch workspace config: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Update workspace configuration
 * @param workspaceId Workspace ID
 * @param update Configuration updates to apply
 */
export async function updateWorkspaceConfig(workspaceId: string, update: WorkspaceConfigUpdate): Promise<void> {
  const url = `${API_ENDPOINT_BASE}/workspaces/${workspaceId}/config`;
  const apiUpdate = toWorkspaceConfigUpdateAPI(update);

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiUpdate),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to update workspace config: ${response.statusText}`;

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
  } catch (error) {
    throw new Error(`Failed to update workspace config: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Test a provider API key by making a lightweight call to the provider's API.
 * @param providerId Provider identifier (e.g. "anthropic")
 * @param apiKey API key to test
 * @returns { success: boolean, error?: string }
 */
export async function testProviderKey(
  providerId: string,
  apiKey: string,
): Promise<{ success: boolean; error?: string }> {
  const url = `${API_ENDPOINT_BASE}/workspaces/test-provider`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId, apiKey }),
    });

    const data = await response.json();
    return data as { success: boolean; error?: string };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Request failed" };
  }
}

/**
 * Update workspace title
 * @param workspaceId Workspace ID
 * @param title New workspace title
 */
export async function updateWorkspaceTitle(workspaceId: string, title: string): Promise<void> {
  const url = `${API_ENDPOINT_BASE}/workspaces/${workspaceId}`;

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to update workspace title: ${response.statusText}`;

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
  } catch (error) {
    throw new Error(`Failed to update workspace title: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
