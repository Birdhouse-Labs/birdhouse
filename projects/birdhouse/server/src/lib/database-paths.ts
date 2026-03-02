// ABOUTME: Database and data directory path resolution for workspaces
// ABOUTME: Centralized utilities for locating workspace-specific databases and OpenCode data

import { homedir } from "node:os";
import { join } from "node:path";

const BIRDHOUSE_DATA_ROOT = join(homedir(), "Library/Application Support/Birdhouse");

/**
 * Get the agents database path for a workspace
 *
 * @param workspaceId - The workspace ID
 * @returns Absolute path to agents.db for this workspace
 */
export function getAgentsDbPath(workspaceId: string): string {
  return join(BIRDHOUSE_DATA_ROOT, "workspaces", workspaceId, "agents.db");
}

/**
 * Get the OpenCode data directory for a workspace
 *
 * @param workspaceId - The workspace ID
 * @returns Absolute path to OpenCode data directory for this workspace
 */
export function getOpenCodeDataDir(workspaceId: string): string {
  return join(BIRDHOUSE_DATA_ROOT, "workspaces", workspaceId, "engine");
}

/**
 * Get the workspace data root directory
 *
 * @param workspaceId - The workspace ID
 * @returns Absolute path to workspace root directory
 */
export function getWorkspaceDataRoot(workspaceId: string): string {
  return join(BIRDHOUSE_DATA_ROOT, "workspaces", workspaceId);
}

/**
 * Get the Birdhouse data root directory
 *
 * @returns Absolute path to Birdhouse data root
 */
export function getBirdhouseDataRoot(): string {
  return BIRDHOUSE_DATA_ROOT;
}
