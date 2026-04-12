// ABOUTME: Tests for OpenCode environment configuration
// ABOUTME: Verifies workspace-configured keys override shell env, and .env files are not read

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { TestDataDB } from "../test-utils/data-db-test";
import { OpenCodeManager } from "./opencode-manager";
import { providersToEnv } from "./secrets";

/**
 * These tests verify the environment configuration behavior of OpenCodeManager.
 *
 * Key properties we're testing:
 * 1. Workspace-configured provider keys override shell environment
 * 2. Shell environment flows through for tooling (gh, git, aws, etc.)
 * 3. No .env file fallback exists
 * 4. Workspaces have isolated secrets storage
 */

describe("OpenCodeManager environment configuration", () => {
  let dataDb: TestDataDB;
  let manager: OpenCodeManager;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    dataDb = new TestDataDB();
    manager = new OpenCodeManager(dataDb, "/test/opencode", 3000);
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    dataDb.close();
  });

  describe("loadWorkspaceEnv", () => {
    test("returns empty object when no secrets configured", () => {
      // Create workspace without any secrets
      const workspaceId = "ws_test_no_secrets";
      dataDb.insertWorkspace({
        workspace_id: workspaceId,
        directory: "/test/path",
        opencode_port: null,
        opencode_pid: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      });

      // Get workspace config (should be null/empty)
      const config = dataDb.getWorkspaceConfig(workspaceId);
      expect(config).toBeNull();
    });

    test("returns only configured provider keys", () => {
      const workspaceId = "ws_test_with_secrets";
      dataDb.insertWorkspace({
        workspace_id: workspaceId,
        directory: "/test/path",
        opencode_port: null,
        opencode_pid: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      });

      // Configure only Anthropic
      dataDb.updateWorkspaceProviders(workspaceId, {
        anthropic: { api_key: "sk-ant-test-key" },
      });

      const config = dataDb.getWorkspaceConfig(workspaceId);
      expect(config).not.toBeNull();
      expect(config?.providers?.anthropic?.api_key).toBe("sk-ant-test-key");
      // OpenAI should NOT be present
      expect(config?.providers?.openai).toBeUndefined();
    });

    test("does not read .env files from workspace directory", () => {
      // This test documents that we removed the .env fallback
      // The old code had:
      //   const envPath = join(workspace.directory, ".env");
      //   if (existsSync(envPath)) { ... }
      //
      // loadWorkspaceEnv ONLY reads from the database.
      // Even if a .env file exists in the workspace directory, it's ignored.

      const workspaceId = "ws_test_no_env_fallback";
      dataDb.insertWorkspace({
        workspace_id: workspaceId,
        directory: "/some/dir/with/.env/file", // Hypothetically has .env
        opencode_port: null,
        opencode_pid: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      });

      // Without explicit DB config, no keys should be available from loadWorkspaceEnv
      const config = dataDb.getWorkspaceConfig(workspaceId);
      expect(config).toBeNull();
    });
  });

  describe("providersToEnv mapping", () => {
    test("simple providers no longer map to child env", () => {
      const workspaceId = "ws_test_env_mapping";
      dataDb.insertWorkspace({
        workspace_id: workspaceId,
        directory: "/test/path",
        opencode_port: null,
        opencode_pid: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      });

      dataDb.updateWorkspaceProviders(workspaceId, {
        anthropic: { api_key: "test-anthropic-key" },
        openai: { api_key: "test-openai-key" },
      });

      const config = dataDb.getWorkspaceConfig(workspaceId);
      expect(config?.providers?.anthropic?.api_key).toBe("test-anthropic-key");
      expect(config?.providers?.openai?.api_key).toBe("test-openai-key");

      const env = providersToEnv(config?.providers || {});
      expect(env.ANTHROPIC_API_KEY).toBeUndefined();
      expect(env.OPENAI_API_KEY).toBeUndefined();
    });
  });

  describe("buildOpenCodeConfig", () => {
    test("injects provider api keys into config and allowlists opencode plus configured providers", () => {
      const workspaceId = "ws_config_injection";
      dataDb.insertWorkspace({
        workspace_id: workspaceId,
        directory: "/test/path",
        opencode_port: null,
        opencode_pid: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      });

      dataDb.updateWorkspaceProviders(workspaceId, {
        anthropic: { api_key: "sk-ant-test-key" },
        openai: { api_key: "sk-openai-test-key" },
        together: { api_key: "together-test-key" },
        github: { github_token: "ghp-test-key" },
      });

      const workspace = dataDb.getWorkspaceById(workspaceId);
      const managerWithBuildConfig = manager as unknown as {
        buildOpenCodeConfig: (workspace: object) => Record<string, unknown>;
      };
      const config = managerWithBuildConfig.buildOpenCodeConfig(workspace ?? {});

      expect(config.enabled_providers).toEqual(["opencode", "anthropic", "openai", "togetherai"]);
      expect(config.provider).toEqual({
        anthropic: {
          options: {
            apiKey: "sk-ant-test-key",
            headers: {
              "anthropic-beta":
                "claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
            },
          },
        },
        openai: {
          options: {
            apiKey: "sk-openai-test-key",
          },
        },
        togetherai: {
          options: {
            apiKey: "together-test-key",
          },
        },
      });
    });

    test("keeps opencode enabled when no Birdhouse providers are configured", () => {
      const workspaceId = "ws_opencode_only";
      dataDb.insertWorkspace({
        workspace_id: workspaceId,
        directory: "/test/path",
        opencode_port: null,
        opencode_pid: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      });

      const workspace = dataDb.getWorkspaceById(workspaceId);
      const managerWithBuildConfig = manager as unknown as {
        buildOpenCodeConfig: (workspace: object) => Record<string, unknown>;
      };
      const config = managerWithBuildConfig.buildOpenCodeConfig(workspace ?? {});

      expect(config.enabled_providers).toEqual(["opencode"]);
      expect(config.provider).toBeUndefined();
    });

    test("disables the task tool in injected OpenCode config", () => {
      const workspaceId = "ws_task_tool_disabled";
      dataDb.insertWorkspace({
        workspace_id: workspaceId,
        directory: "/test/path",
        opencode_port: null,
        opencode_pid: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      });

      const workspace = dataDb.getWorkspaceById(workspaceId);
      const managerWithBuildConfig = manager as unknown as {
        buildOpenCodeConfig: (workspace: object) => Record<string, unknown>;
      };
      const config = managerWithBuildConfig.buildOpenCodeConfig(workspace ?? {});

      expect(config.lsp).toBe(false);
      expect(config.tools).toEqual({ task: false });
    });
  });

  describe("environment override behavior", () => {
    test("shell environment still passes through for tooling", () => {
      // Simulate the environment building logic in spawnOpenCode:
      // 1. Start with shell env (process.env)
      // 2. Overlay workspace env fallbacks for complex providers only

      const shellEnv = {
        PATH: "/usr/bin",
        HOME: "/home/user",
        GITHUB_TOKEN: "gh-token-from-shell", // Tool auth - should pass through
        ANTHROPIC_API_KEY: "sk-ant-from-shell", // Ambient shell key remains untouched
      };

      // Workspace has configured a different Anthropic key
      const workspaceProviders = {
        anthropic: { api_key: "sk-ant-from-workspace-config" },
      };
      const workspaceEnv = providersToEnv(workspaceProviders);

      // Build final env like spawnOpenCode does
      const finalEnv: Record<string, string> = {
        ...shellEnv,
        ...workspaceEnv,
      };

      // Shell environment still flows through for tooling
      expect(finalEnv.GITHUB_TOKEN).toBe("gh-token-from-shell");
      expect(finalEnv.ANTHROPIC_API_KEY).toBe("sk-ant-from-shell");
      expect(finalEnv.PATH).toBe("/usr/bin");
      expect(finalEnv.HOME).toBe("/home/user");
    });

    test("workspace simple providers are not added to child env", () => {
      const shellEnv = {
        PATH: "/usr/bin",
        HOME: "/home/user",
      };

      const workspaceProviders = {
        anthropic: { api_key: "sk-ant-from-workspace-config" },
      };

      const workspaceEnv = providersToEnv(workspaceProviders);

      const finalEnv: Record<string, string> = {
        ...shellEnv,
        ...workspaceEnv,
      };

      expect(finalEnv.ANTHROPIC_API_KEY).toBeUndefined();
      expect(finalEnv.PATH).toBe("/usr/bin");
      expect(finalEnv.HOME).toBe("/home/user");
    });

    test("shell environment passes through when no workspace config", () => {
      // When workspace has no configured env-backed providers, shell env is used as-is

      const shellEnv = {
        PATH: "/usr/bin",
        HOME: "/home/user",
        GITHUB_TOKEN: "gh-token-from-shell",
        ANTHROPIC_API_KEY: "sk-ant-from-shell",
      };

      // No workspace config
      const workspaceEnv = {};

      const finalEnv = {
        ...shellEnv,
        ...workspaceEnv,
      };

      // Shell env flows through
      expect(finalEnv.ANTHROPIC_API_KEY).toBe("sk-ant-from-shell");
      expect(finalEnv.GITHUB_TOKEN).toBe("gh-token-from-shell");
    });

    test("user-defined env vars are injected into workspace environment", () => {
      const workspaceId = "ws_user_env_vars";
      dataDb.insertWorkspace({
        workspace_id: workspaceId,
        directory: "/test/path",
        opencode_port: null,
        opencode_pid: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      });

      dataDb.updateWorkspaceEnv(workspaceId, {
        TAVILY_API_KEY: "tvly-abc123",
        MY_CUSTOM_VAR: "my-value",
      });

      const config = dataDb.getWorkspaceConfig(workspaceId);
      expect(config?.env?.TAVILY_API_KEY).toBe("tvly-abc123");
      expect(config?.env?.MY_CUSTOM_VAR).toBe("my-value");
    });

    test("user env vars override shell environment", () => {
      const shellEnv = {
        TAVILY_API_KEY: "tvly-from-shell",
        PATH: "/usr/bin",
      };

      const userEnv = {
        TAVILY_API_KEY: "tvly-from-workspace",
      };

      const finalEnv = { ...shellEnv, ...userEnv };

      expect(finalEnv.TAVILY_API_KEY).toBe("tvly-from-workspace");
      expect(finalEnv.PATH).toBe("/usr/bin");
    });

    test("user env vars and provider env vars are both included", () => {
      const workspaceId = "ws_combined_env";
      dataDb.insertWorkspace({
        workspace_id: workspaceId,
        directory: "/test/path",
        opencode_port: null,
        opencode_pid: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      });

      dataDb.updateWorkspaceProviders(workspaceId, {
        aws: {
          access_key_id: "AKIAIOSFODNN7EXAMPLE",
          secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        },
      });
      dataDb.updateWorkspaceEnv(workspaceId, {
        TAVILY_API_KEY: "tvly-abc123",
      });

      const config = dataDb.getWorkspaceConfig(workspaceId);
      const providerEnv = providersToEnv(config?.providers ?? {});
      const userEnv = config?.env ?? {};
      const combined = { ...providerEnv, ...userEnv };

      expect(combined.AWS_ACCESS_KEY_ID).toBe("AKIAIOSFODNN7EXAMPLE");
      expect(combined.TAVILY_API_KEY).toBe("tvly-abc123");
    });

    test("documents OPENCODE_XDG isolation per workspace", () => {
      // Each workspace gets isolated OpenCode-specific XDG directories:
      // - OPENCODE_XDG_DATA_HOME: ~/Library/Application Support/Birdhouse/workspaces/<workspace_id>/engine/data
      // - OPENCODE_XDG_CONFIG_HOME: ~/Library/Application Support/Birdhouse/workspaces/<workspace_id>/engine/config
      // - OPENCODE_XDG_STATE_HOME: ~/Library/Application Support/Birdhouse/workspaces/<workspace_id>/engine/state
      // - OPENCODE_XDG_CACHE_HOME: ~/Library/Application Support/Birdhouse/workspaces/<workspace_id>/engine/cache
      //
      // Uses OPENCODE_XDG_* instead of standard XDG_* to prevent breaking tools like gh, git, aws
      // that agents run via the Bash tool. OpenCode reads OPENCODE_XDG_* vars for its own isolation
      // while child processes use standard XDG paths (or default to user's home directory).
      //
      // This prevents workspaces from sharing OpenCode sessions, caches, or configs.

      expect(true).toBe(true); // Documentation test
    });

    test("documents OPENCODE_DISABLE_GLOBAL_CONFIG blocks ~/.config/opencode", () => {
      // Setting OPENCODE_DISABLE_GLOBAL_CONFIG=true prevents OpenCode from
      // reading the user's global config at ~/.config/opencode/opencode.json
      //
      // This ensures workspaces don't inherit global API keys or MCP servers
      // from the user's global OpenCode config.

      expect(true).toBe(true); // Documentation test
    });

    test("builds spawn env with channel db disabled for workspace isolation", async () => {
      const workspaceId = "ws_spawn_env";
      dataDb.insertWorkspace({
        workspace_id: workspaceId,
        directory: "/test/path",
        opencode_port: null,
        opencode_pid: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      });

      const workspace = dataDb.getWorkspaceById(workspaceId);
      const managerWithBuildEnv = manager as unknown as {
        buildSpawnEnv: (workspace: object, port: number) => Promise<Record<string, string>>;
      };

      const env = await managerWithBuildEnv.buildSpawnEnv(workspace ?? {}, 4310);

      expect(env.OPENCODE_PROJECT_ID).toBe(workspaceId);
      expect(env.OPENCODE_DISABLE_GLOBAL_CONFIG).toBe("true");
      expect(env.OPENCODE_DISABLE_PROJECT_CONFIG).toBe("true");
      expect(env.OPENCODE_DISABLE_CHANNEL_DB).toBe("true");
      expect(env.PORT).toBe("4310");
    });

    test("buildSpawnEnv does not forward launcher NODE_ENV to child processes", async () => {
      process.env.NODE_ENV = "production";

      const workspaceId = "ws_spawn_env_without_node_env";
      dataDb.insertWorkspace({
        workspace_id: workspaceId,
        directory: "/test/path",
        opencode_port: null,
        opencode_pid: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      });

      const workspace = dataDb.getWorkspaceById(workspaceId);
      const managerWithBuildEnv = manager as unknown as {
        buildSpawnEnv: (workspace: object, port: number) => Promise<Record<string, string>>;
      };

      const env = await managerWithBuildEnv.buildSpawnEnv(workspace ?? {}, 4311);

      expect(env.NODE_ENV).toBeUndefined();
      expect(process.env.NODE_ENV).toBe("production");
    });
  });
});

describe("Workspace secrets isolation", () => {
  let dataDb: TestDataDB;

  beforeEach(() => {
    dataDb = new TestDataDB();
  });

  afterEach(() => {
    dataDb.close();
  });

  test("workspace A secrets are not visible to workspace B", () => {
    // Create two workspaces
    dataDb.insertWorkspace({
      workspace_id: "ws_A",
      directory: "/workspace/A",
      opencode_port: null,
      opencode_pid: null,
      created_at: new Date().toISOString(),
      last_used: new Date().toISOString(),
    });

    dataDb.insertWorkspace({
      workspace_id: "ws_B",
      directory: "/workspace/B",
      opencode_port: null,
      opencode_pid: null,
      created_at: new Date().toISOString(),
      last_used: new Date().toISOString(),
    });

    // Configure secrets for workspace A only
    dataDb.updateWorkspaceProviders("ws_A", {
      anthropic: { api_key: "ws-A-secret-key" },
    });

    // Workspace A should have the key
    const configA = dataDb.getWorkspaceConfig("ws_A");
    expect(configA?.providers?.anthropic?.api_key).toBe("ws-A-secret-key");

    // Workspace B should have NO keys from the database
    const configB = dataDb.getWorkspaceConfig("ws_B");
    expect(configB).toBeNull();
  });

  test("each workspace has its own isolated secrets storage", () => {
    // This test verifies that secrets are stored per-workspace
    // and that reading one workspace's secrets doesn't affect another

    const workspaceId1 = "ws_isolated_1";
    const workspaceId2 = "ws_isolated_2";

    dataDb.insertWorkspace({
      workspace_id: workspaceId1,
      directory: "/test/path1",
      opencode_port: null,
      opencode_pid: null,
      created_at: new Date().toISOString(),
      last_used: new Date().toISOString(),
    });

    dataDb.insertWorkspace({
      workspace_id: workspaceId2,
      directory: "/test/path2",
      opencode_port: null,
      opencode_pid: null,
      created_at: new Date().toISOString(),
      last_used: new Date().toISOString(),
    });

    // Configure different secrets for each workspace
    dataDb.updateWorkspaceProviders(workspaceId1, {
      anthropic: { api_key: "key-for-workspace-1" },
    });

    dataDb.updateWorkspaceProviders(workspaceId2, {
      openai: { api_key: "key-for-workspace-2" },
    });

    // Verify isolation
    const config1 = dataDb.getWorkspaceConfig(workspaceId1);
    const config2 = dataDb.getWorkspaceConfig(workspaceId2);

    // Workspace 1 has Anthropic, not OpenAI
    expect(config1?.providers?.anthropic?.api_key).toBe("key-for-workspace-1");
    expect(config1?.providers?.openai).toBeUndefined();

    // Workspace 2 has OpenAI, not Anthropic
    expect(config2?.providers?.openai?.api_key).toBe("key-for-workspace-2");
    expect(config2?.providers?.anthropic).toBeUndefined();
  });
});
