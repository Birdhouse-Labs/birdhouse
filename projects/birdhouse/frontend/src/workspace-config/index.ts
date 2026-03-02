// ABOUTME: Public barrel export for workspace-config module
// ABOUTME: Exposes types, services, and adapters for workspace configuration

// Adapters (useful for testing)
export {
  adaptWorkspaceConfig,
  toWorkspaceConfigUpdateAPI,
} from "./adapters/config-adapter";
// Services
export {
  fetchWorkspaceConfig,
  updateWorkspaceConfig,
  updateWorkspaceTitle,
} from "./services/workspace-config-api";
// Types
export type {
  McpServerConfig,
  McpServers,
  WorkspaceConfig,
  WorkspaceConfigUpdate,
} from "./types/config-types";
export type { ProviderMetadata } from "./types/provider-registry";
export { COMING_SOON_PROVIDERS, PROVIDERS } from "./types/provider-registry";
