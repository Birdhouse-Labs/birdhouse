// ABOUTME: Centralized API configuration
// ABOUTME: Handles API base URLs with automatic detection for network access

/**
 * Determines the API base URL based on environment and current location.
 *
 * Priority:
 * 1. VITE_API_BASE env variable (if set)
 * 2. Production mode: Use window.location.origin (frontend and API on same port)
 * 3. Development mode: Use VITE_SERVER_PORT (Vite dev server on different port)
 */
function getApiBaseUrl(): string {
  // Check for explicit override
  if (import.meta.env["VITE_API_BASE"]) {
    return import.meta.env["VITE_API_BASE"] as string;
  }

  // In production (CLI), frontend and API are served on the same port by the same server
  // Use window.location.origin to automatically match whatever port the server is running on
  if (import.meta.env["PROD"] && typeof window !== "undefined") {
    return window.location.origin;
  }

  // In development, Vite dev server (50120) is separate from API server (50121)
  // Use VITE_SERVER_PORT to point to the API server
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const serverPort = import.meta.env["VITE_SERVER_PORT"] || "50121";
    return `${protocol}//${hostname}:${serverPort}`;
  }

  // Fallback for SSR/build-time (shouldn't happen in practice)
  const serverPort = import.meta.env["VITE_SERVER_PORT"] || "50121";
  return `http://localhost:${serverPort}`;
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
