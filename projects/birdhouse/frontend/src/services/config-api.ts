// ABOUTME: API service for fetching server runtime configuration
// ABOUTME: Retrieves feature flags exposed by the server at startup

import { API_ENDPOINT_BASE } from "../config/api";

export interface ServerConfig {
  playgroundEnabled: boolean;
}

export async function fetchConfig(): Promise<ServerConfig> {
  const response = await fetch(`${API_ENDPOINT_BASE}/config`);
  if (!response.ok) {
    throw new Error(`Failed to fetch server config: ${response.statusText}`);
  }
  return response.json() as Promise<ServerConfig>;
}
