// ABOUTME: Centralized API configuration
// ABOUTME: Handles API base URLs with automatic detection for network access

/**
 * Determines the API base URL based on environment and current location.
 *
 * Priority:
 * 1. VITE_API_BASE env variable (if set)
 * 2. Always use window.location.origin — works for both dev and production.
 *    In production, frontend and API share one port.
 *    In dev, Vite proxies /api and /aapi to the backend server, so the
 *    frontend port is the correct target for all API requests.
 */
function getApiBaseUrl(): string {
  // Check for explicit override
  if (import.meta.env["VITE_API_BASE"]) {
    return import.meta.env["VITE_API_BASE"] as string;
  }

  // Use window.location.origin in all cases — the Vite proxy handles routing
  // API requests to the correct backend port in dev mode.
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Fallback for SSR/build-time (shouldn't happen in practice)
  return "http://localhost:50120";
}

/**
 * API base URL (without /api suffix)
 * Examples:
 * - http://localhost:50121
 * - http://192.168.1.223:50121
 * - http://my-machine.local:50121
 */
export const API_BASE_URL = getApiBaseUrl();

/**
 * Full API endpoint base (with /api suffix)
 */
export const API_ENDPOINT_BASE = `${API_BASE_URL}/api`;

/**
 * Build a workspace-scoped API URL
 * @param workspaceId Workspace ID
 * @param path Path after workspace prefix (should start with /)
 * @returns Full URL to workspace-scoped endpoint
 * @example
 * buildWorkspaceUrl('ws_123', '/agents') // => 'http://localhost:50121/api/workspace/ws_123/agents'
 */
export function buildWorkspaceUrl(workspaceId: string, path: string): string {
  return `${API_ENDPOINT_BASE}/workspace/${workspaceId}${path}`;
}
