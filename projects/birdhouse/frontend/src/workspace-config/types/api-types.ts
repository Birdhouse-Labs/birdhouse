// ABOUTME: Backend API contract types for workspace configuration
// ABOUTME: Uses snake_case to match server response format

/**
 * Response from GET /api/workspace/:id/config
 */
export interface WorkspaceConfigResponseAPI {
  providers: Record<string, ProviderCredentialsAPI>; // providerId → credentials
  mcp: McpServersAPI | null;
}

/**
 * Provider credentials from API (matches backend ProviderCredentials type)
 */
export interface ProviderCredentialsAPI {
  api_key: string;
  extended_context?: boolean;
}

/**
 * MCP server configurations (keyed by server name)
 */
export type McpServersAPI = Record<string, McpServerConfigAPI>;

/**
 * Configuration for a single MCP server
 */
export interface McpServerConfigAPI {
  type: "local" | "remote";
  command?: string | string[]; // Can be array (OpenCode format) or string
  args?: string[]; // Legacy: separate args when command is a string
  url?: string;
  headers?: Record<string, string>; // For remote servers with API keys
  env?: Record<string, string>;
  environment?: Record<string, string>; // Alias for env (OpenCode uses this)
  enabled?: boolean;
}

/**
 * Request body for PUT /api/workspace/:id/config
 */
export interface WorkspaceConfigUpdateRequestAPI {
  providers?: Record<string, ProviderUpdateAPI>;
  mcp?: McpServersAPI;
}

/**
 * Provider update payload (contains API key and optional settings)
 */
export interface ProviderUpdateAPI {
  api_key: string;
  extended_context?: boolean;
}
