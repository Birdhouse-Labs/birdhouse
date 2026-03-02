// ABOUTME: Adapter layer for transforming between API and UI types
// ABOUTME: Handles conversion of workspace configuration data structures

import type { WorkspaceConfigResponseAPI, WorkspaceConfigUpdateRequestAPI } from "../types/api-types";
import type { AnthropicOptions, WorkspaceConfig, WorkspaceConfigUpdate } from "../types/config-types";

/**
 * Transform API response to UI-friendly workspace config
 * @param api API response from GET /api/workspace/:id/config
 * @returns UI-friendly workspace config
 */
export function adaptWorkspaceConfig(api: WorkspaceConfigResponseAPI): WorkspaceConfig {
  // Transform provider credentials { providerId: { api_key: "..." } } → Map<providerId, apiKey>
  const providersMap = new Map<string, string>();
  for (const [providerId, credentials] of Object.entries(api.providers)) {
    providersMap.set(providerId, credentials.api_key);
  }

  const anthropicOptions: AnthropicOptions = {
    extended_context: api.providers["anthropic"]?.extended_context ?? false,
  };

  return {
    providers: providersMap,
    anthropicOptions,
    mcpServers: api.mcp, // MCP structure is same in API and UI
  };
}

/**
 * Transform UI workspace config update to API request format
 * @param update UI workspace config update
 * @returns API request body for PUT /api/workspace/:id/config
 */
export function toWorkspaceConfigUpdateAPI(update: WorkspaceConfigUpdate): WorkspaceConfigUpdateRequestAPI {
  const api: WorkspaceConfigUpdateRequestAPI = {};

  if (update.providers || update.anthropicOptions) {
    api.providers = {};
    if (update.providers) {
      for (const [providerId, apiKey] of update.providers) {
        api.providers[providerId] = { api_key: apiKey };
      }
    }
    // Merge anthropic-specific options into the anthropic provider entry
    if (update.anthropicOptions) {
      const existing = api.providers["anthropic"] ?? { api_key: "" };
      api.providers["anthropic"] = {
        ...existing,
        extended_context: update.anthropicOptions.extended_context,
      };
    }
  }

  if (update.mcpServers) {
    api.mcp = update.mcpServers;
  }

  return api;
}
