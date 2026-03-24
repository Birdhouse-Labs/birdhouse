// ABOUTME: TypeScript types for workspace management
// ABOUTME: Matches backend API response shapes for workspace operations

/**
 * Workspace representation from backend
 */
export interface Workspace {
  workspace_id: string;
  directory: string;
  title?: string | null;
  created_at: number;
  last_used: number;
  opencode_running?: boolean;
  opencode_base?: string;
}

/**
 * Response from workspace check endpoint
 * Used to verify if a workspace exists before creation
 */
export interface WorkspaceCheckResponse {
  exists: boolean;
  workspace_id?: string;
}

/**
 * Request body for creating a new workspace
 */
export interface WorkspaceCreateRequest {
  directory: string;
  title?: string;
  api_keys?: Record<string, string>;
}

/**
 * Response from workspace creation endpoint
 */
export interface WorkspaceCreateResponse {
  workspace_id: string;
}

/**
 * Response from workspace deletion endpoint
 */
export interface WorkspaceDeleteResponse {
  success: boolean;
}

/**
 * Health status for a single workspace
 */
export interface WorkspaceHealthResponse {
  workspaceId: string;
  title: string | null;
  opencodeRunning: boolean;
  port: number | null;
  pid: number | null;
  error: string | null;
  /** Set when OpenCode is running but has an invalid config (e.g. broken MCP server) */
  configError: string | null;
}

/**
 * Client-side cached health status with timestamp
 */
export interface WorkspaceHealthStatus extends WorkspaceHealthResponse {
  lastChecked: number; // timestamp in ms
}

/**
 * Response from workspace logs endpoint
 */
export interface WorkspaceLogsResponse {
  lines: string[];
  available: boolean;
  reason?: string;
}

/**
 * A single structured log line from the recent logs endpoint
 */
export interface LogLine {
  time: string;
  level: string;
  subsystem: string;
  msg: string;
  raw: string;
  source: "birdhouse" | "opencode";
}

/**
 * Response from GET /api/logs/recent
 */
export interface RecentLogsResponse {
  lines: LogLine[];
  truncated: boolean;
}
