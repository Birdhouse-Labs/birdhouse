// ABOUTME: API service for workspace management operations
// ABOUTME: Handles workspace CRUD operations and directory checking

import { API_ENDPOINT_BASE } from "../config/api";

import type {
  RecentLogsResponse,
  Workspace,
  WorkspaceCheckResponse,
  WorkspaceCreateRequest,
  WorkspaceCreateResponse,
  WorkspaceDeleteResponse,
  WorkspaceHealthResponse,
} from "../types/workspace";

/**
 * Fetch all workspaces
 * @returns Array of workspaces
 */
export async function fetchWorkspaces(): Promise<Workspace[]> {
  const url = `${API_ENDPOINT_BASE}/workspaces`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to fetch workspaces: ${response.statusText}`;

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

    return response.json();
  } catch (error) {
    throw new Error(`Failed to fetch workspaces: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Check if a workspace exists for a given directory
 * @param directory Directory path to check
 * @returns Check response with exists flag and workspace_id if found
 */
export async function checkWorkspace(directory: string): Promise<WorkspaceCheckResponse> {
  const params = new URLSearchParams({ directory });
  const url = `${API_ENDPOINT_BASE}/workspaces/check?${params}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to check workspace: ${response.statusText}`;

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

    return response.json();
  } catch (error) {
    throw new Error(`Failed to check workspace: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Create a new workspace
 * @param request Workspace creation request with directory and optional API keys
 * @returns Response with new workspace_id
 */
export async function createWorkspace(request: WorkspaceCreateRequest): Promise<WorkspaceCreateResponse> {
  const url = `${API_ENDPOINT_BASE}/workspaces/create`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to create workspace: ${response.statusText}`;

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

    return response.json();
  } catch (error) {
    throw new Error(`Failed to create workspace: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Fetch workspace details by ID
 * @param workspaceId Workspace ID to fetch
 * @returns Workspace details
 */
export async function fetchWorkspace(workspaceId: string): Promise<Workspace> {
  const url = `${API_ENDPOINT_BASE}/workspaces/${workspaceId}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to fetch workspace: ${response.statusText}`;

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

    return response.json();
  } catch (error) {
    throw new Error(`Failed to fetch workspace: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Delete a workspace by ID
 * @param workspaceId Workspace ID to delete
 * @returns Delete response with success flag
 */
export async function deleteWorkspace(workspaceId: string): Promise<WorkspaceDeleteResponse> {
  const url = `${API_ENDPOINT_BASE}/workspaces/${workspaceId}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
    });

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to delete workspace: ${response.statusText}`;

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

    return response.json();
  } catch (error) {
    throw new Error(`Failed to delete workspace: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Fetch health status for all workspaces
 * @returns Array of workspace health statuses
 */
export async function fetchWorkspacesHealth(): Promise<WorkspaceHealthResponse[]> {
  const url = `${API_ENDPOINT_BASE}/workspaces/health`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to fetch workspace health: ${response.statusText}`;

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

    return response.json();
  } catch (error) {
    throw new Error(`Failed to fetch workspace health: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Fetch health status for a single workspace
 * @param workspaceId Workspace ID to check
 * @returns Health status for the workspace
 */
export async function fetchWorkspaceHealth(workspaceId: string): Promise<WorkspaceHealthResponse> {
  const url = `${API_ENDPOINT_BASE}/workspaces/${workspaceId}/health`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to fetch workspace health: ${response.statusText}`;

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

    return response.json();
  } catch (error) {
    throw new Error(`Failed to fetch workspace health: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Restart workspace environment
 * @param workspaceId Workspace ID to restart
 * @returns Restart response with success flag
 */
export async function restartWorkspace(workspaceId: string): Promise<{ success: boolean; message?: string }> {
  const url = `${API_ENDPOINT_BASE}/workspaces/${workspaceId}/restart`;

  try {
    const response = await fetch(url, {
      method: "POST",
    });

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to restart workspace: ${response.statusText}`;

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

    return response.json();
  } catch (error) {
    throw new Error(`Failed to restart workspace: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Trigger OpenCode spawn for workspace (fire-and-forget on server side)
 * Returns once the request is accepted (202)
 * @param workspaceId Workspace ID to start
 */
export async function startWorkspace(workspaceId: string): Promise<void> {
  const url = `${API_ENDPOINT_BASE}/workspaces/${workspaceId}/start`;

  try {
    const response = await fetch(url, {
      method: "POST",
    });

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to start workspace: ${response.statusText}`;

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
    throw new Error(`Failed to start workspace: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Fetch recent structured log lines from Birdhouse and optionally OpenCode
 * @param workspaceId Workspace ID to include OpenCode logs (optional)
 * @returns Recent log lines and truncation flag
 */
export async function fetchRecentLogs(workspaceId?: string): Promise<RecentLogsResponse> {
  const params = new URLSearchParams({ limit: "200" });
  if (workspaceId) {
    params.set("workspaceId", workspaceId);
  }
  const url = `${API_ENDPOINT_BASE}/logs/recent?${params}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const responseBody = await response.text();
      let errorMessage = `Failed to fetch logs: ${response.statusText}`;

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

    return response.json();
  } catch (error) {
    throw new Error(`Failed to fetch logs: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
