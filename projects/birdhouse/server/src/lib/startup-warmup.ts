// ABOUTME: Starts a small set of recent workspace OpenCode instances during server startup.
// ABOUTME: Runs best-effort warmup in the background so Birdhouse startup stays responsive.

import type { DataDB } from "./data-db";
import { log } from "./logger";
import type { OpenCodeManager } from "./opencode-manager";

const RECENT_WORKSPACE_WARMUP_LIMIT = 5;

type WarmupDataDB = Pick<DataDB, "getAllWorkspaces">;
type WarmupOpenCodeManager = Pick<OpenCodeManager, "getOrSpawnOpenCode">;

export function warmRecentWorkspacesInBackground(
  dataDb: WarmupDataDB,
  opencodeManager: WarmupOpenCodeManager,
  limit = RECENT_WORKSPACE_WARMUP_LIMIT,
): void {
  const workspaces = dataDb.getAllWorkspaces().slice(0, limit);

  if (workspaces.length === 0) {
    log.server.debug("Skipping startup workspace warmup - no workspaces found");
    return;
  }

  queueMicrotask(() => {
    void (async () => {
      log.server.info(
        {
          workspaceCount: workspaces.length,
          workspaceIds: workspaces.map((workspace) => workspace.workspace_id),
        },
        "Starting background OpenCode warmup for recent workspaces",
      );

      for (const workspace of workspaces) {
        try {
          const opencode = await opencodeManager.getOrSpawnOpenCode(workspace.workspace_id);
          log.server.info(
            {
              workspaceId: workspace.workspace_id,
              port: opencode.port,
              pid: opencode.pid,
            },
            "Background OpenCode warmup completed",
          );
        } catch (error) {
          log.server.warn(
            {
              workspaceId: workspace.workspace_id,
              error: error instanceof Error ? error.message : String(error),
            },
            "Background OpenCode warmup failed",
          );
        }
      }

      log.server.info({ workspaceCount: workspaces.length }, "Background OpenCode warmup finished");
    })();
  });
}

export { RECENT_WORKSPACE_WARMUP_LIMIT };
