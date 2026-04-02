// ABOUTME: UI-friendly types for workspace configuration
// ABOUTME: Uses camelCase and structured types optimized for component usage

/**
 * Anthropic-specific provider options (beyond the API key)
 */
export interface AnthropicOptions {
  extended_context: boolean;
}

/**
 * Workspace configuration (UI representation)
 */
export interface WorkspaceConfig {
  providers: Map<string, string>; // providerId → apiKey
  anthropicOptions: AnthropicOptions;
  mcpServers: McpServers | null;
  envVars: Map<string, string>; // varName → varValue
}

/**
 * MCP server configurations (keyed by server name)
 */
export type McpServers = Record<string, McpServerConfig>;

/**
 * Configuration for a single MCP server
 */
export interface McpServerConfig {
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
 * Update payload for workspace configuration
 */
export interface WorkspaceConfigUpdate {
  providers?: Map<string, string>; // providerId → newApiKey
  anthropicOptions?: AnthropicOptions;
  mcpServers?: McpServers;
  envVars?: Map<string, string>; // varName → varValue (empty string = delete)
}
