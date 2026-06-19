// ABOUTME: AAPI middleware for plugin routes
// ABOUTME: Loads workspace context from X-Birdhouse-Workspace-ID header for plugin authentication

import type { Context, Next } from "hono";
import { initAgentsDB } from "../lib/agents-db";
import { AUTH_COOKIE_NAME, isValidSessionCookie } from "../lib/auth";
import type { DataDB } from "../lib/data-db";
import { getAgentsDbPath } from "../lib/database-paths";
import { log } from "../lib/logger";
import type { OpenCodeManager } from "../lib/opencode-manager";

/**
 * Parses a cookie string and returns the value for the given name.
 */
function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key.trim() === name) {
      return rest.join("=").trim();
    }
  }
  return null;
}

/**
 * Auth check for AAPI routes.
 *
 * AAPI routes are used by local OpenCode processes which don't have session cookies.
 * The rule is:
 *   1. If the request has a valid session cookie → allow
 *   2. If no cookie AND no X-Forwarded-For header → treat as local process → allow
 *   3. Otherwise → 401
 *
 * The X-Forwarded-For heuristic is used because we cannot access the raw socket IP
 * from within Hono middleware without the Bun server env reference, which is not
 * available in middleware registered via app.use(). In practice:
 *   - Local OpenCode processes connect directly — no X-Forwarded-For header
 *   - Requests through a reverse proxy (remote access) always have X-Forwarded-For
 * This is a weaker check, but acceptable: the worst case is an unauthenticated
 * remote request to an AAPI route still fails at workspace resolution.
 */
export function createAAPIAuthCheck(dataDb: DataDB) {
  return async (c: Context, next: Next): Promise<Response | undefined> => {
    const cookieHeader = c.req.header("Cookie") ?? null;
    const sessionToken = parseCookie(cookieHeader, AUTH_COOKIE_NAME);

    // Path 1: valid cookie
    if (sessionToken) {
      const valid = await isValidSessionCookie(sessionToken, dataDb);
      if (valid) {
        await next();
        return;
      }
      // Invalid cookie with no forwarded header — could still be local, but a
      // tampered cookie is suspicious. Reject it.
      log.server.warn({ path: c.req.path }, "AAPI auth rejected — invalid session cookie");
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Path 2: no cookie — check if request appears local
    const forwardedFor = c.req.header("X-Forwarded-For");
    if (!forwardedFor) {
      // No forwarding header: treat as direct local connection (OpenCode process)
      await next();
      return;
    }

    // Path 3: forwarded request without a cookie — remote and unauthenticated
    log.server.warn({ path: c.req.path, forwardedFor }, "AAPI auth rejected — remote request without session cookie");
    return c.json({ error: "Unauthorized" }, 401);
  };
}

/**
 * Middleware to load workspace context for AAPI routes (plugin-facing)
 *
 * Reads workspace ID from X-Birdhouse-Workspace-ID header (set by OpenCodeManager)
 *
 * Attaches to context:
 * - workspace: Workspace record from DB
 * - opencodePort: Port OpenCode is running on
 * - opencodeBase: Base URL for OpenCode API
 * - agentsDb: AgentsDB instance for this workspace
 */
export function createAAPIMiddleware(opencodeManager: OpenCodeManager, dataDb: DataDB) {
  return async (c: Context, next: Next): Promise<Response | undefined> => {
    const workspaceId = c.req.header("X-Birdhouse-Workspace-ID");

    if (!workspaceId) {
      return c.json({ error: "X-Birdhouse-Workspace-ID header required" }, 400);
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

      // Initialize workspace-specific agents.db (runs migrations once, then cached)
      const agentsDbPath = getAgentsDbPath(workspaceId);
      const agentsDb = await initAgentsDB(agentsDbPath);
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
        "Routing AAPI request to OpenCode instance",
      );

      await next();
      return;
    } catch (error) {
      log.server.error(
        {
          workspaceId,
          error: error instanceof Error ? error.message : "Unknown",
        },
        "Failed to load AAPI workspace context",
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
