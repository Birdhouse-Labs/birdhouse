// ABOUTME: Centralized helper for updating agent titles in both Birdhouse and OpenCode
// ABOUTME: Handles OpenCode sync with graceful error handling (best effort, non-blocking)

import type { AgentHarness } from "../harness";
import type { AgentRow, AgentsDB } from "./agents-db";
import { getWorkspaceEventBus } from "./birdhouse-event-bus";
import type { LoggerDeps } from "./logger";

export interface SyncAgentTitleDeps {
  agentsDB: AgentsDB;
  harness: Pick<AgentHarness, "updateSessionTitle">;
  workspaceDir: string;
  log: LoggerDeps;
}

/**
 * Update agent title in Birdhouse DB, sync to OpenCode, and emit SSE event
 *
 * This is the single source of truth for title updates. All code paths should use this.
 *
 * OpenCode sync is best-effort:
 * - If sync fails, logs warning but does NOT throw
 * - Birdhouse DB is source of truth
 * - SSE event fires regardless of OpenCode sync status
 *
 * @param deps - Dependencies (agentsDB, harness, workspaceDir, log)
 * @param agentId - Agent ID to update
 * @param newTitle - New title to set
 * @returns Updated agent row from database
 * @throws Error if Birdhouse DB update fails (NOT if OpenCode sync fails)
 */
export async function syncAgentTitle(deps: SyncAgentTitleDeps, agentId: string, newTitle: string): Promise<AgentRow> {
  const { agentsDB, harness, workspaceDir, log } = deps;

  // 1. Update Birdhouse DB (source of truth)
  const updatedAgent = agentsDB.updateAgentTitle(agentId, newTitle);
  if (!updatedAgent) {
    throw new Error("Failed to update agent title in database");
  }

  // 2. Sync to OpenCode (best effort - don't fail if this breaks)
  try {
    await harness.updateSessionTitle(updatedAgent.session_id, newTitle);
    log.server.debug(
      {
        agentId,
        sessionId: updatedAgent.session_id,
        title: newTitle,
      },
      "OpenCode session title synced successfully",
    );
  } catch (error) {
    // CRITICAL: Log warning but DO NOT throw
    // Birdhouse DB is updated, that's what matters
    log.server.warn(
      {
        agentId,
        sessionId: updatedAgent.session_id,
        title: newTitle,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Failed to sync title to OpenCode - Birdhouse DB updated successfully",
    );
  }

  // 3. Emit SSE event for frontend (always happens, even if OpenCode sync failed)
  const birdhouseEventBus = getWorkspaceEventBus(workspaceDir);
  birdhouseEventBus.emit({
    type: "birdhouse.agent.updated",
    properties: {
      agentId,
      agent: updatedAgent,
    },
  });

  return updatedAgent;
}
