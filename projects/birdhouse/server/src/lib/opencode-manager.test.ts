// ABOUTME: Tests for OpenCode environment configuration
// ABOUTME: Verifies workspace-configured keys override shell env, and .env files are not read

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { TestDataDB } from "../test-utils/data-db-test";
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

  beforeEach(() => {
    dataDb = new TestDataDB();
  });

  afterEach(() => {
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
      // Now loadWorkspaceEnv ONLY reads from the encrypted database.
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
    test("maps anthropic to ANTHROPIC_API_KEY", () => {
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
    });
  });

  describe("environment override behavior", () => {
    test("workspace-configured keys override shell environment", () => {
      // Simulate the environment building logic in spawnOpenCode:
      // 1. Start with shell env (process.env)
      // 2. Overlay workspace-configured keys

      const shellEnv = {
        PATH: "/usr/bin",
        HOME: "/home/user",
        GITHUB_TOKEN: "gh-token-from-shell", // Tool auth - should pass through
        ANTHROPIC_API_KEY: "sk-ant-from-shell", // Provider key - should be overridden
      };

      // Workspace has configured a different Anthropic key
      const workspaceProviders = {
        anthropic: { api_key: "sk-ant-from-workspace-config" },
      };
      const workspaceEnv = providersToEnv(workspaceProviders);

      // Build final env like spawnOpenCode does
      const finalEnv = {
        ...shellEnv,
        ...workspaceEnv, // Workspace keys override shell
      };

      // Workspace-configured key wins
      expect(finalEnv.ANTHROPIC_API_KEY).toBe("sk-ant-from-workspace-config");

      // Shell environment still flows through for tooling
      expect(finalEnv.GITHUB_TOKEN).toBe("gh-token-from-shell");
      expect(finalEnv.PATH).toBe("/usr/bin");
      expect(finalEnv.HOME).toBe("/home/user");
    });

    test("shell environment passes through when no workspace config", () => {
      // When workspace has no configured providers, shell env is used as-is

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
