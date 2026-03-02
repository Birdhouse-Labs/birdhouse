// ABOUTME: Workspace middleware for scoped routes
// ABOUTME: Loads workspace context and ensures OpenCode is running before handling requests

import type { Context, Next } from "hono";
import { createAgentsDB } from "../lib/agents-db";
import type { DataDB } from "../lib/data-db";
import { getAgentsDbPath } from "../lib/database-paths";
import { log } from "../lib/logger";
import type { OpenCodeManager } from "../lib/opencode-manager";

/**
 * Middleware to load workspace context for workspace-scoped routes
 *
 * Attaches to context:
 * - workspace: Workspace record from DB
 * - opencodePort: Port OpenCode is running on
 * - opencodeBase: Base URL for OpenCode API
 * - agentsDb: AgentsDB instance for this workspace
 */
export function createWorkspaceMiddleware(opencodeManager: OpenCodeManager, dataDb: DataDB) {
  return async (c: Context, next: Next): Promise<Response | undefined> => {
    const workspaceId = c.req.param("workspaceId");

    if (!workspaceId) {
      return c.json({ error: "workspaceId parameter required" }, 400);
    }

    // Get workspace from database
    const workspace = dataDb.getWorkspaceById(workspaceId);
    if (!workspace) {
      return c.json({ error: `Workspace not found: ${workspaceId}` }, 404);
    }

    // Ensure OpenCode is running for this workspace (spawn if needed)
    try {
      const opencode = await opencodeManager.getOrSpawnOpenCode(workspaceId);

      // Set context for routes
      c.set("workspace", workspace);
      c.set("opencodePort", opencode.port);
      c.set("opencodeBase", `http://127.0.0.1:${opencode.port}`);

      // Open workspace-specific agents.db
      const agentsDbPath = getAgentsDbPath(workspaceId);
      const agentsDb = createAgentsDB(agentsDbPath);
      c.set("agentsDb", agentsDb);

      log.server.debug(
        {
          workspaceId,
          directory: workspace.directory,
          opencodePort: opencode.port,
          opencodePid: opencode.pid,
          requestPath: c.req.path,
          requestMethod: c.req.method,
        },
        "Routing request to OpenCode instance",
      );

      await next();
      return;
    } catch (error) {
      log.server.error(
        {
          workspaceId,
          error: error instanceof Error ? error.message : "Unknown",
        },
        "Failed to load workspace context",
      );

      return c.json(
        {
          error: "Failed to load workspace",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  };
}
