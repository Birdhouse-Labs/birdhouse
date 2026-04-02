// ABOUTME: Workspace management routes for multi-workspace support
// ABOUTME: CRUD operations for workspaces, including creation, listing, and deletion

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { Hono } from "hono";
import type { DataDB } from "../lib/data-db";
import { getOpenCodeDataDir } from "../lib/database-paths";
import { log } from "../lib/logger";
import type { OpenCodeManager } from "../lib/opencode-manager";
import { getWorkspaceStream } from "../lib/opencode-stream";
import { generateWorkspaceId } from "../lib/workspace";

export function createWorkspaceRoutes(dataDb: DataDB, opencodeManager: OpenCodeManager) {
  const app = new Hono();

  /**
   * GET /api/workspaces
   * List all workspaces
   */
  app.get("/", (c) => {
    const workspaces = dataDb.getAllWorkspaces();
    return c.json(workspaces);
  });

  /**
   * POST /api/workspaces/test-provider
   * Test that a provider API key is valid by making a lightweight API call.
   * Must be registered before /:id routes to avoid being consumed as a param.
   *
   * Body: { providerId: string, apiKey: string }
   */
  app.post("/test-provider", async (c) => {
    const body = await c.req.json();
    const { providerId, apiKey } = body;

    if (!providerId || !apiKey) {
      return c.json({ error: "providerId and apiKey are required" }, 400);
    }

    if (providerId === "anthropic") {
      try {
        const response = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          return c.json({ success: true });
        }

        const errorBody = await response.json().catch(() => ({}));
        const message =
          (errorBody as { error?: { message?: string } }).error?.message ||
          `HTTP ${response.status}: ${response.statusText}`;
        return c.json({ success: false, error: message });
      } catch (error) {
        return c.json({
          success: false,
          error: error instanceof Error ? error.message : "Request failed",
        });
      }
    }

    return c.json({ error: `Provider '${providerId}' does not support key testing` }, 400);
  });

  /**
   * GET /api/workspace/check?directory=...
   * Check if workspace exists for a directory
   */
  app.get("/check", (c) => {
    const directory = c.req.query("directory");

    if (!directory) {
      return c.json({ error: "directory parameter required" }, 400);
    }

    const workspace = dataDb.getWorkspaceByDirectory(directory);

    if (workspace) {
      return c.json({
        exists: true,
        workspace_id: workspace.workspace_id,
      });
    }

    return c.json({ exists: false });
  });

  /**
   * POST /api/workspace/create
   * Create a new workspace
   *
   * Body: { directory: string, title?: string, api_keys?: { anthropic?: string, openai?: string } }
   */
  app.post("/create", async (c) => {
    const body = await c.req.json();
    const { directory, title, api_keys } = body;

    if (!directory) {
      return c.json({ error: "directory is required" }, 400);
    }

    // Check if workspace already exists
    const existing = dataDb.getWorkspaceByDirectory(directory);
    if (existing) {
      return c.json(
        {
          error: "Workspace already exists for this directory",
          workspace_id: existing.workspace_id,
        },
        409,
      );
    }

    try {
      // Generate deterministic workspace ID based on directory
      const workspaceId = generateWorkspaceId(directory);
      const now = new Date().toISOString();

      // Create DB entry
      const workspace = {
        workspace_id: workspaceId,
        directory,
        title: title || basename(directory),
        opencode_port: null,
        opencode_pid: null,
        created_at: now,
        last_used: now,
      };

      dataDb.insertWorkspace(workspace);

      // Store API keys if provided
      if (api_keys && Object.keys(api_keys).length > 0) {
        // Convert old format to new provider format
        const providers: Record<string, { api_key: string }> = {};
        if (api_keys.anthropic) {
          providers.anthropic = { api_key: api_keys.anthropic };
        }
        if (api_keys.openai) {
          providers.openai = { api_key: api_keys.openai };
        }

        dataDb.updateWorkspaceProviders(workspace.workspace_id, providers);
        log.server.info({ workspaceId: workspace.workspace_id }, "API keys stored");
      }

      log.server.info({ workspaceId: workspace.workspace_id, directory }, "Workspace created");

      return c.json({
        workspace_id: workspace.workspace_id,
        created_at: workspace.created_at,
      });
    } catch (error) {
      log.server.error(
        { directory, error: error instanceof Error ? error.message : "Unknown" },
        "Failed to create workspace",
      );
      return c.json(
        {
          error: "Failed to create workspace",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  /**
   * POST /api/workspace/register
   * Register a workspace from CLI (simpler endpoint - no API keys)
   *
   * Body: { directory: string, title?: string }
   */
  app.post("/register", async (c) => {
    const body = await c.req.json();
    const { directory, title } = body;

    if (!directory) {
      return c.json({ error: "directory is required" }, 400);
    }

    try {
      // Check if workspace already exists
      let workspace = dataDb.getWorkspaceByDirectory(directory);

      if (workspace) {
        // Update last_used
        const now = new Date().toISOString();
        dataDb.updateWorkspace(workspace.workspace_id, { last_used: now });

        log.server.debug(
          { workspaceId: workspace.workspace_id, directory },
          "Workspace already registered, updated last_used",
        );

        return c.json({
          workspace_id: workspace.workspace_id,
          existed: true,
        });
      }

      // Generate deterministic workspace ID based on directory
      const workspaceId = generateWorkspaceId(directory);
      const now = new Date().toISOString();

      // Create DB entry
      workspace = {
        workspace_id: workspaceId,
        directory,
        title: title || basename(directory),
        opencode_port: null,
        opencode_pid: null,
        created_at: now,
        last_used: now,
      };

      dataDb.insertWorkspace(workspace);

      log.server.info({ workspaceId: workspace.workspace_id, directory }, "Workspace registered");

      return c.json({
        workspace_id: workspace.workspace_id,
        existed: false,
      });
    } catch (error) {
      log.server.error(
        { directory, error: error instanceof Error ? error.message : "Unknown" },
        "Failed to register workspace",
      );
      return c.json(
        {
          error: "Failed to register workspace",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  /**
   * GET /api/workspaces/health
   * Check OpenCode health for all workspaces
   */
  app.get("/health", async (c) => {
    const workspaces = dataDb.getAllWorkspaces();

    const healthStatuses = await Promise.all(
      workspaces.map(async (workspace) => {
        // Check if OpenCode info exists in database
        if (!workspace.opencode_port || !workspace.opencode_pid) {
          return {
            workspaceId: workspace.workspace_id,
            title: workspace.title,
            opencodeRunning: false,
            port: null,
            pid: null,
            error: "Workspace environment not started for this workspace",
            configError: null,
          };
        }

        try {
          // Verify the OpenCode instance is actually valid and responding
          const { healthy: isValid, configError = null } = await opencodeManager.verifyOpenCodeInstance(
            workspace.opencode_port,
            workspace.opencode_pid,
            workspace.workspace_id,
          );

          if (isValid) {
            return {
              workspaceId: workspace.workspace_id,
              title: workspace.title,
              opencodeRunning: true,
              port: workspace.opencode_port,
              pid: workspace.opencode_pid,
              error: null,
              configError: null,
            };
          }

          return {
            workspaceId: workspace.workspace_id,
            title: workspace.title,
            opencodeRunning: false,
            port: workspace.opencode_port,
            pid: workspace.opencode_pid,
            error: "Workspace environment not responding or workspace ID mismatch",
            configError,
          };
        } catch (error) {
          log.server.error(
            {
              workspaceId: workspace.workspace_id,
              error: error instanceof Error ? error.message : "Unknown",
            },
            "Failed to check workspace environment health",
          );

          return {
            workspaceId: workspace.workspace_id,
            title: workspace.title,
            opencodeRunning: false,
            port: workspace.opencode_port,
            pid: workspace.opencode_pid,
            error: error instanceof Error ? error.message : "Unknown error during health check",
            configError: null,
          };
        }
      }),
    );

    return c.json(healthStatuses);
  });

  /**
   * POST /api/workspace/:id/start
   * Trigger OpenCode spawn for workspace (fire-and-forget)
   * Returns 202 immediately; spawn happens in the background
   */
  app.post("/:id/start", (c) => {
    const workspaceId = c.req.param("id");

    const workspace = dataDb.getWorkspaceById(workspaceId);
    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    // Fire and forget — do not await
    opencodeManager.getOrSpawnOpenCode(workspaceId).catch((error) => {
      log.server.warn(
        { workspaceId, error: error instanceof Error ? error.message : "Unknown" },
        "Background OpenCode spawn failed",
      );
    });

    return c.json({ started: true }, 202);
  });

  /**
   * GET /api/workspace/:id/logs
   * Return recent OpenCode log lines for the workspace
   * Dev mode: reads from log file; prod mode: returns available:false
   */
  app.get("/:id/logs", (c) => {
    const workspaceId = c.req.param("id");

    const workspace = dataDb.getWorkspaceById(workspaceId);
    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    const isDevMode = !!process.env.OPENCODE_PATH;

    if (!isDevMode) {
      return c.json({ lines: [], available: false, reason: "logs_in_server_log" });
    }

    const logFile = join(getOpenCodeDataDir(workspaceId), "logs", "opencode.log");

    if (!existsSync(logFile)) {
      return c.json({ lines: [], available: true });
    }

    try {
      const content = readFileSync(logFile, "utf8");
      const allLines = content.split("\n").filter((line) => line.trim().length > 0);
      const lines = allLines.slice(-100);
      return c.json({ lines, available: true });
    } catch (error) {
      log.server.error(
        { workspaceId, logFile, error: error instanceof Error ? error.message : "Unknown" },
        "Failed to read OpenCode log file",
      );
      return c.json({ lines: [], available: true });
    }
  });

  /**
   * GET /api/workspace/:id
   * Get workspace details
   */
  app.get("/:id", (c) => {
    const workspaceId = c.req.param("id");

    const workspace = dataDb.getWorkspaceById(workspaceId);

    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    // Include OpenCode status
    const opencodeBase = opencodeManager.getOpenCodeBase(workspaceId);

    return c.json({
      ...workspace,
      opencode_running: opencodeBase !== null,
      opencode_base: opencodeBase,
    });
  });

  /**
   * GET /api/workspace/:id/health
   * Check OpenCode health for a specific workspace
   */
  app.get("/:id/health", async (c) => {
    const workspaceId = c.req.param("id");

    const workspace = dataDb.getWorkspaceById(workspaceId);

    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    // Check if OpenCode info exists in database
    if (!workspace.opencode_port || !workspace.opencode_pid) {
      return c.json({
        workspaceId,
        opencodeRunning: false,
        port: null,
        pid: null,
        error: "Workspace environment not started for this workspace",
        configError: null,
      });
    }

    try {
      // Verify the OpenCode instance is actually valid and responding
      const { healthy: isValid, configError = null } = await opencodeManager.verifyOpenCodeInstance(
        workspace.opencode_port,
        workspace.opencode_pid,
        workspaceId,
      );

      if (isValid) {
        return c.json({
          workspaceId,
          opencodeRunning: true,
          port: workspace.opencode_port,
          pid: workspace.opencode_pid,
          error: null,
          configError: null,
        });
      }

      return c.json({
        workspaceId,
        opencodeRunning: false,
        port: workspace.opencode_port,
        pid: workspace.opencode_pid,
        error: "Workspace environment not responding or workspace ID mismatch",
        configError,
      });
    } catch (error) {
      log.server.error(
        {
          workspaceId,
          error: error instanceof Error ? error.message : "Unknown",
        },
        "Failed to check workspace environment health",
      );

      return c.json(
        {
          workspaceId,
          opencodeRunning: false,
          port: workspace.opencode_port,
          pid: workspace.opencode_pid,
          error: error instanceof Error ? error.message : "Unknown error during health check",
          configError: null,
        },
        500,
      );
    }
  });

  /**
   * POST /api/workspace/:id/restart
   * Restart OpenCode instance for a workspace
   */
  app.post("/:id/restart", async (c) => {
    const workspaceId = c.req.param("id");

    const workspace = dataDb.getWorkspaceById(workspaceId);

    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    try {
      // Notify connected clients the workspace is about to restart
      // Must fire before restartOpenCode() — the SSE stream is still alive at this point
      const opencodeBase = opencodeManager.getOpenCodeBase(workspaceId);
      if (opencodeBase) {
        getWorkspaceStream(opencodeBase, workspace.directory).emitCustomEvent("birdhouse.workspace.restarting", {
          workspaceId,
        });
      }

      // Use centralized restart method (ensures safety delay and consistent behavior)
      const { port, pid } = await opencodeManager.restartOpenCode(workspaceId);

      log.server.info({ workspaceId, port, pid }, "Workspace environment restarted");

      return c.json({
        success: true,
        message: "Workspace environment restarted",
        port,
        pid,
      });
    } catch (error) {
      log.server.error(
        { workspaceId, error: error instanceof Error ? error.message : "Unknown" },
        "Failed to restart workspace environment",
      );

      return c.json(
        {
          success: false,
          message: error instanceof Error ? error.message : "Failed to restart workspace environment",
        },
        500,
      );
    }
  });

  /**
   * PATCH /api/workspace/:id
   * Update workspace properties
   * Body: { title?: string }
   */
  app.patch("/:id", async (c) => {
    const workspaceId = c.req.param("id");

    const workspace = dataDb.getWorkspaceById(workspaceId);

    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    try {
      const body = await c.req.json();

      // Validate title field if provided
      if (body.title !== undefined) {
        if (typeof body.title !== "string") {
          return c.json({ error: "Title must be a string" }, 400);
        }

        const trimmedTitle = body.title.trim();
        if (!trimmedTitle) {
          return c.json({ error: "Title cannot be empty" }, 400);
        }

        // Update workspace title
        dataDb.updateWorkspace(workspaceId, { title: trimmedTitle });

        log.server.info({ workspaceId, title: trimmedTitle }, "Workspace title updated");
      }

      // Fetch updated workspace
      const updatedWorkspace = dataDb.getWorkspaceById(workspaceId);

      return c.json(updatedWorkspace);
    } catch (error) {
      log.server.error(
        { workspaceId, error: error instanceof Error ? error.message : "Unknown" },
        "Failed to update workspace",
      );
      return c.json(
        {
          error: "Failed to update workspace",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  /**
   * DELETE /api/workspace/:id
   * Delete a workspace
   */
  app.delete("/:id", async (c) => {
    const workspaceId = c.req.param("id");

    const workspace = dataDb.getWorkspaceById(workspaceId);

    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    try {
      // Shutdown OpenCode if running
      await opencodeManager.shutdownOpenCode(workspaceId);

      // Delete from database
      dataDb.deleteWorkspace(workspaceId);

      log.server.info({ workspaceId, directory: workspace.directory }, "Workspace deleted");

      return c.json({ success: true });
    } catch (error) {
      log.server.error(
        { workspaceId, error: error instanceof Error ? error.message : "Unknown" },
        "Failed to delete workspace",
      );
      return c.json(
        {
          error: "Failed to delete workspace",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  /**
   * GET /api/workspace/:id/config
   * Get workspace configuration (providers + MCP)
   * Returns decrypted provider credentials and MCP configuration
   */
  app.get("/:id/config", (c) => {
    const workspaceId = c.req.param("id");

    // Validate workspace exists
    const workspace = dataDb.getWorkspaceById(workspaceId);
    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    const config = dataDb.getWorkspaceConfig(workspaceId);

    if (!config) {
      return c.json({
        providers: {},
        mcp: null,
        env: null,
      });
    }

    // Return actual provider credentials and env vars
    // This is a local desktop app - user has full filesystem access anyway
    return c.json({
      providers: config.providers || {},
      mcp: config.mcp || null,
      env: config.env || null,
    });
  });

  /**
   * PUT /api/workspace/:id/config
   * Update workspace configuration
   * Body: { providers?: ProviderCredentials, mcp?: McpServers }
   */
  app.put("/:id/config", async (c) => {
    const workspaceId = c.req.param("id");
    const body = await c.req.json();

    // DIAGNOSTIC: Log received body
    log.server.info(
      { workspaceId, body: JSON.stringify(body), bodyKeys: Object.keys(body) },
      "PUT /config received body",
    );

    // Validate workspace exists
    const workspace = dataDb.getWorkspaceById(workspaceId);
    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    try {
      // DIAGNOSTIC: Log before update
      log.server.info({ workspaceId }, "Calling updateWorkspaceConfig");

      // Update config (partial update - merges with existing)
      dataDb.updateWorkspaceConfig(workspaceId, body);

      // DIAGNOSTIC: Verify it was actually saved
      const savedConfig = dataDb.getWorkspaceConfig(workspaceId);
      log.server.info(
        {
          workspaceId,
          savedProviders: savedConfig?.providers ? Object.keys(savedConfig.providers) : [],
          hasMcp: !!savedConfig?.mcp,
        },
        "Config saved and verified",
      );

      return c.json({ success: true });
    } catch (error) {
      log.server.error(
        {
          workspaceId,
          error: error instanceof Error ? error.message : "Unknown",
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Failed to update workspace config",
      );
      return c.json(
        {
          error: "Failed to update workspace config",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  return app;
}
