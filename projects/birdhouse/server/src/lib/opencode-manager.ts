// ABOUTME: OpenCode process manager for multi-workspace support
// ABOUTME: Handles spawning, tracking, and lifecycle management of OpenCode instances per workspace

import { type ChildProcess, type StdioOptions, spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import type { DataDB, Workspace } from "./data-db";
import { getOpenCodeDataDir } from "./database-paths";
import { log } from "./logger";
import { providersToEnv } from "./secrets";

interface OpenCodeInstance {
  port: number;
  pid: number;
  process: ChildProcess | null; // null for reattached instances from previous server run
}

interface OpenCodeHealthResponse {
  healthy: boolean;
  version: string;
  birdhouseWorkspaceId: string | null;
}

export class OpenCodeManager {
  private instances: Map<string, OpenCodeInstance> = new Map();
  private spawning: Map<string, Promise<{ port: number; pid: number }>> = new Map();
  private spawnMutex: Promise<void> = Promise.resolve();
  private dataDb: DataDB;
  private opencodeBinaryPath: string;
  private opencodeSourcePath: string | null;
  private serverPort: number;

  constructor(dataDb: DataDB, opencodeBinaryPath: string, serverPort: number) {
    this.dataDb = dataDb;
    this.opencodeBinaryPath = opencodeBinaryPath;
    this.opencodeSourcePath = process.env.OPENCODE_PATH || null;
    this.serverPort = serverPort;

    // SIGINT/SIGTERM: exit cleanly, leave OpenCode running.
    // The dev launcher (dev.ts) prints running instances and handles shutdown messaging.
    process.on("SIGINT", () => {
      process.exit(0);
    });

    // SIGTERM: exit cleanly, leave OpenCode running (normal shutdown path from launcher).
    process.on("SIGTERM", () => {
      log.server.debug({ signal: "SIGTERM" }, "Shutdown handler triggered");
      process.exit(0);
    });

    // SIGQUIT (Ctrl+\ or kill -QUIT): kill all OpenCode instances then exit.
    // Use from the terminal for a deliberate full teardown, or from agent scripts via kill -QUIT.
    process.on("SIGQUIT", async () => {
      await this.shutdownAll();
      process.exit(0);
    });
  }

  /**
   * Validate all OpenCode instances from database on startup
   * Clears invalid instances (wrong workspace, dead processes, port conflicts)
   */
  async validateAllOpenCodeInstances(): Promise<void> {
    const allWorkspaces = this.dataDb.getAllWorkspaces();
    const workspacesWithOpenCode = allWorkspaces.filter((w) => w.opencode_port !== null && w.opencode_pid !== null);

    if (workspacesWithOpenCode.length === 0) {
      log.server.debug("No OpenCode instances in database to validate");
      return;
    }

    log.server.info({ count: workspacesWithOpenCode.length }, "Validating OpenCode instances from database");

    let validCount = 0;
    let invalidCount = 0;

    for (const workspace of workspacesWithOpenCode) {
      const { workspace_id, opencode_port, opencode_pid } = workspace;

      // TypeScript knows these are non-null due to filter above, but need to assert
      if (opencode_port === null || opencode_pid === null) {
        continue;
      }

      const isValid = await this.verifyOpenCodeInstance(opencode_port, opencode_pid, workspace_id);

      if (isValid) {
        validCount++;
        log.server.info(
          { workspaceId: workspace_id, port: opencode_port, pid: opencode_pid },
          "OpenCode instance validated successfully",
        );
      } else {
        invalidCount++;
        log.server.warn(
          { workspaceId: workspace_id, port: opencode_port, pid: opencode_pid },
          "OpenCode instance invalid - clearing from database",
        );

        // Clear invalid instance from database
        this.dataDb.updateWorkspace(workspace_id, {
          opencode_port: null,
          opencode_pid: null,
        });
      }
    }

    log.server.info(
      { total: workspacesWithOpenCode.length, valid: validCount, invalid: invalidCount },
      "OpenCode instance validation complete",
    );
  }

  /**
   * Get or spawn OpenCode instance for workspace
   * Returns the port and pid of the running OpenCode instance
   */
  async getOrSpawnOpenCode(workspaceId: string): Promise<{ port: number; pid: number }> {
    const workspace = this.dataDb.getWorkspaceById(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Check if OpenCode already running for this workspace
    const existing = this.instances.get(workspaceId);
    if (existing) {
      // Verify process still alive
      if (this.isProcessAlive(existing.pid)) {
        log.server.debug(
          { workspaceId, port: existing.port, pid: existing.pid },
          "Reusing existing OpenCode instance from memory",
        );
        return { port: existing.port, pid: existing.pid };
      }
      // Process died - clean up
      log.server.warn({ workspaceId, pid: existing.pid }, "OpenCode process in memory died - cleaning up");
      this.instances.delete(workspaceId);
      this.dataDb.updateWorkspace(workspaceId, {
        opencode_port: null,
        opencode_pid: null,
      });
    }

    // Check if already spawning - return existing promise to prevent duplicate spawns
    const spawningPromise = this.spawning.get(workspaceId);
    if (spawningPromise) {
      log.server.debug({ workspaceId }, "OpenCode spawn already in progress, waiting for completion");
      return spawningPromise;
    }

    // Check DB for existing OpenCode (could be from previous server run)
    if (workspace.opencode_port && workspace.opencode_pid) {
      const isValid = await this.verifyOpenCodeInstance(workspace.opencode_port, workspace.opencode_pid, workspaceId);

      if (isValid) {
        log.server.info(
          { workspaceId, port: workspace.opencode_port, pid: workspace.opencode_pid },
          "Verified and reusing OpenCode instance from previous server run",
        );
        // Track reattached instance so shutdown/listing can find it
        this.instances.set(workspaceId, {
          port: workspace.opencode_port,
          pid: workspace.opencode_pid,
          process: null,
        });
        return {
          port: workspace.opencode_port,
          pid: workspace.opencode_pid,
        };
      }

      // Invalid - clear from database
      log.server.warn(
        { workspaceId, port: workspace.opencode_port, pid: workspace.opencode_pid },
        "OpenCode instance from database failed validation - will respawn",
      );
      this.dataDb.updateWorkspace(workspaceId, {
        opencode_port: null,
        opencode_pid: null,
      });
    }

    // Create spawn promise serialized through the global mutex to prevent cross-workspace
    // port allocation races (two workspaces calling allocateOpenCodePort concurrently
    // could both read the DB before either writes its reserved port).
    const spawnPromise = new Promise<{ port: number; pid: number }>((resolve, reject) => {
      this.spawnMutex = this.spawnMutex.then(() => this.doSpawnOpenCode(workspaceId, workspace).then(resolve, reject));
    });
    this.spawning.set(workspaceId, spawnPromise);

    try {
      const result = await spawnPromise;
      return result;
    } finally {
      // Clean up spawning tracker
      this.spawning.delete(workspaceId);
    }
  }

  /**
   * Internal method to spawn OpenCode instance
   * Separated from getOrSpawnOpenCode to allow proper promise tracking
   */
  private async doSpawnOpenCode(workspaceId: string, workspace: Workspace): Promise<{ port: number; pid: number }> {
    // Allocate port
    const port = await this.allocateOpenCodePort();

    // Reserve port in database immediately to prevent concurrent allocation conflicts
    this.dataDb.updateWorkspace(workspaceId, {
      opencode_port: port,
      opencode_pid: null, // Will update after spawn
    });

    const proc = await this.spawnOpenCode(workspace, port);

    if (!proc.pid) {
      throw new Error("Failed to get process PID after spawning OpenCode");
    }

    const pid = proc.pid;

    // Update DB with PID
    this.dataDb.updateWorkspace(workspaceId, {
      opencode_port: port,
      opencode_pid: pid,
    });

    // Track process
    this.instances.set(workspaceId, {
      port,
      pid,
      process: proc,
    });

    // Wait for OpenCode to be ready
    await this.waitForOpenCode(port);

    log.server.info({ workspaceId, port, pid }, "OpenCode instance spawned and ready");

    return { port, pid };
  }

  /**
   * Allocate next available OpenCode port
   * Uses serverPort + 10 as base to avoid conflicts between dev/prod instances
   */
  private async allocateOpenCodePort(): Promise<number> {
    const basePort = this.serverPort + 10;
    const increment = 1;

    // Get all active ports from DB
    const allWorkspaces = this.dataDb.getAllWorkspaces();
    const usedPorts = new Set(
      allWorkspaces
        .filter((w): w is Workspace & { opencode_port: number } => w.opencode_port !== null)
        .map((w) => w.opencode_port),
    );

    // Also include ports from in-memory instances (for processes currently spawning)
    for (const instance of this.instances.values()) {
      usedPorts.add(instance.port);
    }

    // Find first available
    for (let i = 0; i < 100; i++) {
      const candidatePort = basePort + i * increment;
      if (!usedPorts.has(candidatePort) && !(await this.isPortInUse(candidatePort))) {
        return candidatePort;
      }
    }

    throw new Error(`No available OpenCode ports (tried ${basePort}-${basePort + 99})`);
  }

  /**
   * Spawn OpenCode process for workspace
   */
  private async spawnOpenCode(workspace: Workspace, port: number): Promise<ChildProcess> {
    const opencodeDataDir = getOpenCodeDataDir(workspace.workspace_id);

    // Ensure data directory structure exists
    if (!existsSync(opencodeDataDir)) {
      mkdirSync(opencodeDataDir, { recursive: true });
    }

    // Load workspace-specific provider API keys from encrypted DB
    const workspaceEnv = await this.loadWorkspaceEnv(workspace);

    // Build OpenCode config (MCP servers + plugin)
    const opencodeConfig = this.buildOpenCodeConfig(workspace);

    // Build environment:
    // 1. Start with user's shell environment (for tooling like gh, git, aws, etc.)
    // 2. Overlay workspace-configured provider keys (explicit config wins over shell env)
    // 3. Add Birdhouse-specific configuration
    const env: Record<string, string> = {
      // User's full shell environment - preserves tool auth (GITHUB_TOKEN, SSH_AUTH_SOCK, etc.)
      ...(process.env as Record<string, string>),
      // Workspace-configured provider API keys override any from shell environment
      ...workspaceEnv,
      // OpenCode-specific XDG directories for isolation per workspace
      // Uses OPENCODE_XDG_* instead of standard XDG_* to avoid breaking child process tools
      OPENCODE_XDG_DATA_HOME: join(opencodeDataDir, "data"), // Sessions, snapshots, bin, logs, auth
      OPENCODE_XDG_CONFIG_HOME: join(opencodeDataDir, "config"), // Configuration files
      OPENCODE_XDG_STATE_HOME: join(opencodeDataDir, "state"), // State files
      OPENCODE_XDG_CACHE_HOME: join(opencodeDataDir, "cache"), // Cache files, models.json
      // Birdhouse-specific env vars
      OPENCODE_CLIENT: "acp",
      OPENCODE_ENABLE_QUESTION_TOOL: "true",
      OPENCODE_WORKSPACE_ROOT: workspace.directory,
      BIRDHOUSE_SERVER: `http://localhost:${this.serverPort}`,
      BIRDHOUSE_WORKSPACE_ID: workspace.workspace_id, // For plugin to know which workspace it's in
      // OpenCode configuration injection
      OPENCODE_DISABLE_GLOBAL_CONFIG: "true", // Block ~/.config/opencode reads
      OPENCODE_DISABLE_AUTOCOMPACT: "true", // Disable automatic message compaction
      OPENCODE_DISABLE_PRUNE: "true", // Disable message pruning
      OPENCODE_PROJECT_ID: workspace.workspace_id, // Workspace identifier for OpenCode
      OPENCODE_CONFIG_CONTENT: JSON.stringify(opencodeConfig), // Programmatic config
      PORT: port.toString(),
    };

    log.server.info(
      {
        workspaceId: workspace.workspace_id,
        directory: workspace.directory,
        port,
        dataDir: opencodeDataDir,
        OPENCODE_XDG_DATA_HOME: env.OPENCODE_XDG_DATA_HOME,
        OPENCODE_XDG_CONFIG_HOME: env.OPENCODE_XDG_CONFIG_HOME,
        OPENCODE_XDG_STATE_HOME: env.OPENCODE_XDG_STATE_HOME,
        OPENCODE_XDG_CACHE_HOME: env.OPENCODE_XDG_CACHE_HOME,
      },
      "Spawning OpenCode process with OPENCODE_XDG environment",
    );

    // Spawn OpenCode: use source path if available (dev mode), otherwise use binary
    // Dev mode (OPENCODE_PATH set): always detach so OpenCode survives bun --watch hard-kills on branch switches.
    // Detached processes can't pipe stdio to the parent (pipes break when parent exits), so we
    // redirect stdout/stderr to a log file in the workspace data dir instead.
    const shouldDetach = this.opencodeSourcePath !== null;
    let stdio: StdioOptions;
    if (shouldDetach) {
      const logDir = join(opencodeDataDir, "logs");
      if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
      const logFile = join(logDir, "opencode.log");
      const logFd = openSync(logFile, "a");
      stdio = ["ignore", logFd, logFd];
    } else {
      stdio = ["ignore", "pipe", "pipe"]; // Attached: pipe stdout/stderr for logging
    }

    const proc = this.opencodeSourcePath
      ? spawn(
          "bun",
          [
            "run",
            "--conditions=browser",
            "src/index.ts",
            "serve",
            "--port",
            port.toString(),
            "--print-logs",
            "--hostname",
            "0.0.0.0",
          ],
          {
            cwd: join(this.opencodeSourcePath, "packages/opencode"),
            env,
            stdio,
            detached: shouldDetach, // Detach from parent process group to survive Ctrl+C
          },
        )
      : spawn(this.opencodeBinaryPath, ["serve", "--port", port.toString(), "--print-logs", "--hostname", "0.0.0.0"], {
          env,
          stdio,
          detached: shouldDetach, // Detach from parent process group to survive Ctrl+C
        });

    // Route OpenCode's stdout and stderr through Birdhouse logger
    // This ensures all OpenCode logs appear in the log file, not just the terminal
    if (proc.stdout) {
      proc.stdout.on("data", (data: Buffer) => {
        const lines = data
          .toString()
          .split("\n")
          .filter((line) => line.trim());
        for (const line of lines) {
          // Parse OpenCode's JSON logs to preserve structure
          try {
            const parsed = JSON.parse(line);
            // Preserve OpenCode's original log level if present
            const level = parsed.level || "info";
            const logFn = log.opencode[level as keyof typeof log.opencode] || log.opencode.info;
            if (typeof logFn === "function") {
              logFn.call(
                log.opencode,
                {
                  workspaceId: workspace.workspace_id,
                  opencodePort: port,
                  source: "stdout",
                  ...parsed,
                },
                parsed.msg || "OpenCode log",
              );
            }
          } catch {
            // Not JSON, log as plain text
            log.opencode.info(
              {
                workspaceId: workspace.workspace_id,
                opencodePort: port,
                source: "stdout",
              },
              line,
            );
          }
        }
      });
    }

    if (proc.stderr) {
      proc.stderr.on("data", (data: Buffer) => {
        const lines = data
          .toString()
          .split("\n")
          .filter((line) => line.trim());
        for (const line of lines) {
          // stderr includes debug markers like [OPENCODE-GLOBAL-INIT]
          // Use debug level since stderr isn't always errors
          log.opencode.debug(
            {
              workspaceId: workspace.workspace_id,
              opencodePort: port,
              source: "stderr",
            },
            line,
          );
        }
      });
    }

    if (!proc.pid) {
      throw new Error("Failed to spawn OpenCode process");
    }

    log.server.info(
      {
        workspaceId: workspace.workspace_id,
        pid: proc.pid,
        port,
        detached: shouldDetach,
      },
      "OpenCode process spawned successfully",
    );

    // If detached, unref so parent can exit without waiting for child
    if (shouldDetach) {
      proc.unref();
      log.server.debug({ workspaceId: workspace.workspace_id, pid: proc.pid }, "OpenCode process detached and unref'd");
    }

    // Handle process exit
    proc.on("exit", (code) => {
      log.server.warn({ workspaceId: workspace.workspace_id, code }, "OpenCode process exited");

      // Clean up tracking
      this.instances.delete(workspace.workspace_id);
      this.dataDb.updateWorkspace(workspace.workspace_id, {
        opencode_port: null,
        opencode_pid: null,
      });
    });

    return proc;
  }

  /**
   * Load workspace-specific environment variables from encrypted secrets DB only.
   * No fallbacks - OpenCode sees ONLY what's explicitly configured for this workspace.
   */
  private async loadWorkspaceEnv(workspace: Workspace): Promise<Record<string, string>> {
    const config = this.dataDb.getWorkspaceConfig(workspace.workspace_id);

    if (!config?.providers) {
      log.server.debug({ workspaceId: workspace.workspace_id }, "No provider API keys configured for workspace");
      return {};
    }

    const providerEnv = providersToEnv(config.providers);
    log.server.debug(
      { workspaceId: workspace.workspace_id, keysCount: Object.keys(providerEnv).length },
      "Loaded provider API keys from encrypted database",
    );

    return providerEnv;
  }

  /**
   * Build OpenCode configuration including MCP servers and provider options.
   *
   * We always inject the full Anthropic beta header string here so we control it
   * explicitly. When updating our OpenCode fork, sync this list with the hardcoded
   * value in opencode/packages/opencode/src/provider/provider.ts (CUSTOM_LOADERS.anthropic).
   */
  private buildOpenCodeConfig(workspace: Workspace): Record<string, unknown> {
    // Birdhouse plugin is now built-in to OpenCode - just use the name
    const config: Record<string, unknown> = {
      plugin: ["birdhouse"],
      permission: {
        external_directory: "allow",
      },
    };

    // Load workspace config from encrypted database
    const secrets = this.dataDb.getWorkspaceConfig(workspace.workspace_id);

    // Load MCP config
    if (secrets?.mcp) {
      config.mcp = secrets.mcp;
      log.server.debug(
        { workspaceId: workspace.workspace_id, serverCount: Object.keys(secrets.mcp).length },
        "Loaded MCP config from encrypted database",
      );
    }

    // Build Anthropic provider config.
    // Standard betas kept in sync with OpenCode's hardcoded list in CUSTOM_LOADERS.anthropic.
    const standardBetas = [
      "claude-code-20250219",
      "interleaved-thinking-2025-05-14",
      "fine-grained-tool-streaming-2025-05-14",
    ];

    const extendedContext = secrets?.providers?.anthropic?.extended_context ?? false;

    if (extendedContext) {
      const allBetas = ["context-1m-2025-08-07", ...standardBetas].join(",");

      // Models that support 1M context - update when Anthropic expands support
      const contextLimit = { context: 1000000, output: 64000 };
      const extendedContextModels = [
        "claude-sonnet-4-5",
        "claude-sonnet-4-5-20250929",
        "claude-sonnet-4-6",
        "claude-opus-4-6",
      ];

      const modelOverrides: Record<string, { limit: { context: number; output: number } }> = {};
      for (const modelId of extendedContextModels) {
        modelOverrides[modelId] = { limit: contextLimit };
      }

      config.provider = {
        anthropic: {
          options: { headers: { "anthropic-beta": allBetas } },
          models: modelOverrides,
        },
      };

      log.server.info({ workspaceId: workspace.workspace_id }, "Extended context (1M) enabled for Anthropic");
    } else if (secrets?.providers?.anthropic?.api_key) {
      // Only add provider config if there's an API key configured
      // This prevents OpenCode from listing providers that aren't actually usable
      config.provider = {
        anthropic: {
          options: { headers: { "anthropic-beta": standardBetas.join(",") } },
        },
      };
    }

    return config;
  }

  /**
   * Wait for OpenCode to be ready (health check)
   */
  private async waitForOpenCode(port: number): Promise<void> {
    const maxAttempts = 60; // 30 seconds
    const delayMs = 500;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${port}/global/health`, {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) {
          return;
        }
      } catch (_error) {
        // Not ready yet, continue waiting
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error(`OpenCode failed to start on port ${port} within ${(maxAttempts * delayMs) / 1000}s`);
  }

  /**
   * Verify OpenCode instance is running correctly for expected workspace
   * Public method - used by health check API endpoint
   */
  async verifyOpenCodeInstance(port: number, pid: number, expectedWorkspaceId: string): Promise<boolean> {
    // Check if process is alive
    if (!this.isProcessAlive(pid)) {
      log.server.debug({ port, pid, expectedWorkspaceId }, "OpenCode process not alive");
      return false;
    }

    // Try to hit health endpoint
    try {
      const response = await fetch(`http://localhost:${port}/global/health`, {
        signal: AbortSignal.timeout(1000),
      });

      if (!response.ok) {
        log.server.debug({ port, pid, expectedWorkspaceId, status: response.status }, "OpenCode health check failed");
        return false;
      }

      const health = (await response.json()) as OpenCodeHealthResponse;

      // Verify workspace ID matches
      if (health.birdhouseWorkspaceId !== expectedWorkspaceId) {
        log.server.warn(
          {
            port,
            pid,
            expectedWorkspaceId,
            actualWorkspaceId: health.birdhouseWorkspaceId,
          },
          "OpenCode workspace ID mismatch - wrong workspace on this port",
        );
        return false;
      }

      // All checks passed
      return true;
    } catch (error) {
      log.server.debug(
        { port, pid, expectedWorkspaceId, error: error instanceof Error ? error.message : String(error) },
        "Failed to connect to OpenCode health endpoint",
      );
      return false;
    }
  }

  /**
   * Check if process is alive
   */
  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0); // Signal 0 checks if process exists
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if port is in use by attempting to connect to health endpoint
   */
  private async isPortInUse(port: number): Promise<boolean> {
    try {
      const _response = await fetch(`http://localhost:${port}/global/health`, {
        signal: AbortSignal.timeout(500),
      });
      // If we get any response, port is in use
      return true;
    } catch {
      // No response means port is free
      return false;
    }
  }

  /**
   * Shutdown OpenCode instance for workspace
   */
  async shutdownOpenCode(workspaceId: string): Promise<void> {
    const instance = this.instances.get(workspaceId);

    // If in memory, use process handle if available, otherwise fall back to PID kill
    if (instance) {
      log.server.info({ workspaceId, port: instance.port, pid: instance.pid }, "Shutting down OpenCode from memory");

      if (instance.process) {
        // Send SIGTERM for graceful shutdown
        instance.process.kill("SIGTERM");

        // Wait for graceful shutdown
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            // Force kill if still alive
            if (this.isProcessAlive(instance.pid)) {
              log.server.warn({ workspaceId, pid: instance.pid }, "OpenCode did not exit gracefully, force killing");
              instance.process!.kill("SIGKILL");
            }
            resolve();
          }, 5000);

          instance.process!.once("exit", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      } else {
        // Reattached instance — no process handle, kill by PID directly
        if (this.isProcessAlive(instance.pid)) {
          try {
            process.kill(instance.pid, "SIGTERM");
            let attempts = 0;
            while (attempts < 50 && this.isProcessAlive(instance.pid)) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              attempts++;
            }
            if (this.isProcessAlive(instance.pid)) {
              log.server.warn({ workspaceId, pid: instance.pid }, "OpenCode did not exit gracefully, force killing");
              process.kill(instance.pid, "SIGKILL");
            }
          } catch (error) {
            log.server.error(
              { workspaceId, pid: instance.pid, error: error instanceof Error ? error.message : "Unknown" },
              "Failed to kill reattached OpenCode process",
            );
          }
        }
      }

      this.instances.delete(workspaceId);
      this.dataDb.updateWorkspace(workspaceId, {
        opencode_port: null,
        opencode_pid: null,
      });
      return;
    }

    // Not in memory - check database for reused process from previous server run
    const workspace = this.dataDb.getWorkspaceById(workspaceId);
    if (!workspace || !workspace.opencode_port || !workspace.opencode_pid) {
      log.server.debug({ workspaceId }, "No OpenCode instance to shutdown");
      return;
    }

    const { opencode_port, opencode_pid } = workspace;

    log.server.info(
      { workspaceId, port: opencode_port, pid: opencode_pid },
      "Shutting down OpenCode from previous server run (no process handle)",
    );

    // Kill by PID since we don't have ChildProcess handle
    if (this.isProcessAlive(opencode_pid)) {
      try {
        // Send SIGTERM
        process.kill(opencode_pid, "SIGTERM");

        // Wait up to 5 seconds for graceful shutdown
        let attempts = 0;
        while (attempts < 50 && this.isProcessAlive(opencode_pid)) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }

        // Force kill if still alive
        if (this.isProcessAlive(opencode_pid)) {
          log.server.warn({ workspaceId, pid: opencode_pid }, "OpenCode did not exit gracefully, force killing");
          process.kill(opencode_pid, "SIGKILL");
        }

        log.server.info({ workspaceId, pid: opencode_pid }, "OpenCode process terminated");
      } catch (error) {
        log.server.error(
          { workspaceId, pid: opencode_pid, error: error instanceof Error ? error.message : "Unknown" },
          "Failed to kill OpenCode process",
        );
      }
    }

    // Clear from database
    this.dataDb.updateWorkspace(workspaceId, {
      opencode_port: null,
      opencode_pid: null,
    });
  }

  /**
   * Restart OpenCode instance for workspace
   * Used when configuration changes (MCP servers, API keys, etc.)
   *
   * This is the canonical way to restart OpenCode - ensures clean shutdown,
   * port release, and fresh config loading.
   */
  async restartOpenCode(workspaceId: string): Promise<{ port: number; pid: number }> {
    log.server.info({ workspaceId }, "Restarting OpenCode instance");

    // Shutdown existing instance (clears DB fields, kills process)
    await this.shutdownOpenCode(workspaceId);

    // Wait for port to be fully released (prevents EADDRINUSE errors)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Spawn new instance with updated config from database
    return this.getOrSpawnOpenCode(workspaceId);
  }

  /**
   * Shutdown all OpenCode instances
   */
  async shutdownAll(): Promise<void> {
    const workspaceIds = Array.from(this.instances.keys());

    if (workspaceIds.length === 0) {
      return;
    }

    log.server.info({ count: workspaceIds.length }, "Shutting down all OpenCode instances");

    await Promise.all(workspaceIds.map((id) => this.shutdownOpenCode(id)));
  }

  /**
   * Get OpenCode base URL for workspace
   */
  getOpenCodeBase(workspaceId: string): string | null {
    const instance = this.instances.get(workspaceId);
    if (instance) {
      return `http://127.0.0.1:${instance.port}`;
    }

    // Check DB for port (if OpenCode running from previous server)
    const workspace = this.dataDb.getWorkspaceById(workspaceId);
    if (workspace?.opencode_port) {
      return `http://127.0.0.1:${workspace.opencode_port}`;
    }

    return null;
  }
}
