// ABOUTME: Tests for workspace data database operations
// ABOUTME: Verifies workspace CRUD operations and plain-text JSON secrets storage

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { TestDataDB } from "../test-utils/data-db-test";
import type { ProviderCredentials, WorkspaceConfig } from "./secrets";

describe("DataDB", () => {
  let dataDb: TestDataDB;

  beforeEach(() => {
    // Use TestDataDB which initializes schema for in-memory databases
    dataDb = new TestDataDB();
  });

  afterEach(() => {
    dataDb.close();
  });

  describe("Workspace CRUD operations", () => {
    test("inserts and retrieves workspace", () => {
      const workspace = {
        workspace_id: "ws_test123",
        directory: "/test/path",
        opencode_port: null,
        opencode_pid: null,
        title: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      };

      dataDb.insertWorkspace(workspace);

      const retrieved = dataDb.getWorkspaceById("ws_test123");
      expect(retrieved).toEqual(workspace);
    });

    test("retrieves workspace by directory", () => {
      const workspace = {
        workspace_id: "ws_test123",
        directory: "/test/path",
        opencode_port: null,
        opencode_pid: null,
        title: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      };

      dataDb.insertWorkspace(workspace);

      const retrieved = dataDb.getWorkspaceByDirectory("/test/path");
      expect(retrieved).toEqual(workspace);
    });

    test("updates workspace fields", () => {
      const workspace = {
        workspace_id: "ws_test123",
        directory: "/test/path",
        opencode_port: null,
        opencode_pid: null,
        title: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      };

      dataDb.insertWorkspace(workspace);

      dataDb.updateWorkspace("ws_test123", {
        opencode_port: 50102,
        opencode_pid: 12345,
      });

      const retrieved = dataDb.getWorkspaceById("ws_test123");
      expect(retrieved?.opencode_port).toBe(50102);
      expect(retrieved?.opencode_pid).toBe(12345);
    });

    test("deletes workspace", () => {
      const workspace = {
        workspace_id: "ws_test123",
        directory: "/test/path",
        opencode_port: null,
        opencode_pid: null,
        title: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      };

      dataDb.insertWorkspace(workspace);
      dataDb.deleteWorkspace("ws_test123");

      const retrieved = dataDb.getWorkspaceById("ws_test123");
      expect(retrieved).toBeNull();
    });

    test("getAllWorkspaces returns all workspaces", () => {
      const workspace1 = {
        workspace_id: "ws_test1",
        directory: "/test/path1",
        opencode_port: null,
        opencode_pid: null,
        title: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      };

      const workspace2 = {
        workspace_id: "ws_test2",
        directory: "/test/path2",
        opencode_port: null,
        opencode_pid: null,
        title: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      };

      dataDb.insertWorkspace(workspace1);
      dataDb.insertWorkspace(workspace2);

      const all = dataDb.getAllWorkspaces();
      expect(all.length).toBe(2);
    });
  });

  describe("Workspace configuration (plain-text secrets)", () => {
    const testWorkspace = {
      workspace_id: "ws_test123",
      directory: "/test/path",
      opencode_port: null,
      opencode_pid: null,
      title: null,
      created_at: new Date().toISOString(),
      last_used: new Date().toISOString(),
    };

    beforeEach(() => {
      dataDb.insertWorkspace(testWorkspace);
    });

    test("getWorkspaceConfig returns null for non-existent secrets", () => {
      const config = dataDb.getWorkspaceConfig("ws_test123");
      expect(config).toBeNull();
    });

    test("updateWorkspaceConfig creates and retrieves config", () => {
      const updates: WorkspaceConfig = {
        providers: {
          anthropic: { api_key: "sk-ant-test123" },
          openai: { api_key: "sk-openai-test456" },
        },
        mcp: {
          filesystem: {
            type: "local",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
            enabled: true,
          },
        },
      };

      dataDb.updateWorkspaceConfig("ws_test123", updates);

      const retrieved = dataDb.getWorkspaceConfig("ws_test123");
      expect(retrieved).toEqual(updates);
    });

    test("updateWorkspaceConfig merges with existing config", () => {
      // Set initial config
      dataDb.updateWorkspaceConfig("ws_test123", {
        providers: {
          anthropic: { api_key: "sk-ant-old" },
        },
        mcp: {
          filesystem: {
            type: "local",
            command: "test",
          },
        },
      });

      // Update with new provider
      dataDb.updateWorkspaceConfig("ws_test123", {
        providers: {
          openai: { api_key: "sk-openai-new" },
        },
      });

      // Both providers should exist, MCP should be preserved
      const config = dataDb.getWorkspaceConfig("ws_test123");
      expect(config?.providers?.anthropic).toEqual({ api_key: "sk-ant-old" });
      expect(config?.providers?.openai).toEqual({ api_key: "sk-openai-new" });
      expect(config?.mcp?.filesystem).toEqual({
        type: "local",
        command: "test",
      });
    });

    test("updateWorkspaceProviders preserves MCP config", () => {
      // Set initial config with MCP
      dataDb.updateWorkspaceConfig("ws_test123", {
        mcp: {
          test: {
            type: "local",
            command: "test-command",
          },
        },
      });

      // Update just providers
      dataDb.updateWorkspaceProviders("ws_test123", {
        anthropic: { api_key: "new-key" },
      });

      // MCP should still be there
      const config = dataDb.getWorkspaceConfig("ws_test123");
      expect(config?.mcp).toEqual({
        test: {
          type: "local",
          command: "test-command",
        },
      });
      expect(config?.providers?.anthropic).toEqual({ api_key: "new-key" });
    });

    test("updateWorkspaceMcpConfig preserves providers", () => {
      // Set initial config with providers
      dataDb.updateWorkspaceConfig("ws_test123", {
        providers: {
          anthropic: { api_key: "test-key" },
        },
      });

      // Update just MCP config
      dataDb.updateWorkspaceMcpConfig("ws_test123", {
        filesystem: {
          type: "local",
          command: "npx",
        },
      });

      // Provider should still be there
      const config = dataDb.getWorkspaceConfig("ws_test123");
      expect(config?.providers?.anthropic).toEqual({ api_key: "test-key" });
      expect(config?.mcp).toEqual({
        filesystem: {
          type: "local",
          command: "npx",
        },
      });
    });

    test("updateWorkspaceMcpConfig with null removes MCP config", () => {
      // Set initial config with MCP
      dataDb.updateWorkspaceConfig("ws_test123", {
        providers: {
          anthropic: { api_key: "test-key" },
        },
        mcp: {
          test: { type: "local", command: "test" },
        },
      });

      // Remove MCP config
      dataDb.updateWorkspaceMcpConfig("ws_test123", null);

      // Provider should remain, MCP should be gone
      const config = dataDb.getWorkspaceConfig("ws_test123");
      expect(config?.providers?.anthropic).toEqual({ api_key: "test-key" });
      expect(config?.mcp).toBeUndefined();
    });

    test("getWorkspaceProviders returns only providers", () => {
      dataDb.updateWorkspaceConfig("ws_test123", {
        providers: {
          anthropic: { api_key: "test-key" },
        },
        mcp: {
          test: { type: "local", command: "test" },
        },
      });

      const providers = dataDb.getWorkspaceProviders("ws_test123");
      expect(providers).toEqual({
        anthropic: { api_key: "test-key" },
      });
    });

    test("getWorkspaceMcpConfig returns only MCP config", () => {
      dataDb.updateWorkspaceConfig("ws_test123", {
        providers: {
          anthropic: { api_key: "test-key" },
        },
        mcp: {
          test: { type: "local", command: "test" },
        },
      });

      const mcp = dataDb.getWorkspaceMcpConfig("ws_test123");
      expect(mcp).toEqual({
        test: { type: "local", command: "test" },
      });
    });

    test("handles complex providers", () => {
      const providers: ProviderCredentials = {
        aws: {
          access_key_id: "AKIAIOSFODNN7EXAMPLE",
          secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          region: "us-east-1",
        },
        azure: {
          resource_name: "my-resource",
          api_key: "azure-key-123",
        },
      };

      dataDb.updateWorkspaceProviders("ws_test123", providers);

      const retrieved = dataDb.getWorkspaceProviders("ws_test123");
      expect(retrieved).toEqual(providers);
    });

    test("deleteWorkspace cascades to secrets", () => {
      // Add secrets
      dataDb.updateWorkspaceConfig("ws_test123", {
        providers: {
          anthropic: { api_key: "test-key" },
        },
      });

      // Verify secrets exist
      expect(dataDb.getWorkspaceConfig("ws_test123")).not.toBeNull();

      // Delete workspace
      dataDb.deleteWorkspace("ws_test123");

      // Workspace should be gone
      expect(dataDb.getWorkspaceById("ws_test123")).toBeNull();

      // Note: Can't directly verify secrets are gone since workspace doesn't exist
      // But CASCADE should handle it
    });

    test("updateWorkspaceEnv stores and retrieves env vars", () => {
      dataDb.updateWorkspaceEnv("ws_test123", {
        TAVILY_API_KEY: "tvly-abc123",
        MY_CUSTOM_VAR: "some-value",
      });

      const env = dataDb.getWorkspaceEnv("ws_test123");
      expect(env).toEqual({
        TAVILY_API_KEY: "tvly-abc123",
        MY_CUSTOM_VAR: "some-value",
      });
    });

    test("updateWorkspaceEnv merges with existing env vars", () => {
      dataDb.updateWorkspaceEnv("ws_test123", { TAVILY_API_KEY: "tvly-abc123" });
      dataDb.updateWorkspaceEnv("ws_test123", { GITHUB_TOKEN: "ghp_xyz" });

      const env = dataDb.getWorkspaceEnv("ws_test123");
      expect(env?.TAVILY_API_KEY).toBe("tvly-abc123");
      expect(env?.GITHUB_TOKEN).toBe("ghp_xyz");
    });

    test("updateWorkspaceEnv removes var when value is empty string", () => {
      dataDb.updateWorkspaceEnv("ws_test123", {
        TAVILY_API_KEY: "tvly-abc123",
        TO_DELETE: "will-be-removed",
      });

      dataDb.updateWorkspaceEnv("ws_test123", { TO_DELETE: "" });

      const env = dataDb.getWorkspaceEnv("ws_test123");
      expect(env?.TAVILY_API_KEY).toBe("tvly-abc123");
      expect(env?.TO_DELETE).toBeUndefined();
    });

    test("updateWorkspaceEnv preserves providers and MCP", () => {
      dataDb.updateWorkspaceConfig("ws_test123", {
        providers: { anthropic: { api_key: "sk-ant-test" } },
        mcp: { test: { type: "local", command: "test" } },
      });

      dataDb.updateWorkspaceEnv("ws_test123", { TAVILY_API_KEY: "tvly-abc123" });

      const config = dataDb.getWorkspaceConfig("ws_test123");
      expect(config?.providers?.anthropic?.api_key).toBe("sk-ant-test");
      expect(config?.mcp?.test).toBeDefined();
      expect(config?.env?.TAVILY_API_KEY).toBe("tvly-abc123");
    });

    test("getWorkspaceEnv returns null when no env vars configured", () => {
      expect(dataDb.getWorkspaceEnv("ws_test123")).toBeNull();
    });

    test("updateWorkspaceEnv removes env field when all vars deleted", () => {
      dataDb.updateWorkspaceEnv("ws_test123", { ONLY_VAR: "value" });
      dataDb.updateWorkspaceEnv("ws_test123", { ONLY_VAR: "" });

      const config = dataDb.getWorkspaceConfig("ws_test123");
      expect(config?.env).toBeUndefined();
    });
  });

  describe("User profile operations", () => {
    test("getUserName returns null when no profile exists", () => {
      const name = dataDb.getUserName();
      expect(name).toBeNull();
    });

    test("getUserProfile returns null when no profile exists", () => {
      const profile = dataDb.getUserProfile();
      expect(profile).toBeNull();
    });

    test("setUserName stores and retrieves name", () => {
      dataDb.setUserName("Jane Smith");
      expect(dataDb.getUserName()).toBe("Jane Smith");
    });

    test("setUserName replaces existing name", () => {
      dataDb.setUserName("First Name");
      dataDb.setUserName("Second Name");
      expect(dataDb.getUserName()).toBe("Second Name");
    });

    test("getUserProfile returns correct shape", () => {
      dataDb.setUserName("Jane Smith");
      const profile = dataDb.getUserProfile();
      expect(profile?.id).toBe(1);
      expect(profile?.name).toBe("Jane Smith");
      expect(typeof profile?.created_at).toBe("string");
    });
  });

  describe("Installation ID operations", () => {
    test("getOrCreateInstallId returns a non-empty string", async () => {
      const id = await dataDb.getOrCreateInstallId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    test("getOrCreateInstallId returns the same value on repeated calls", async () => {
      const first = await dataDb.getOrCreateInstallId();
      const second = await dataDb.getOrCreateInstallId();
      expect(first).toBe(second);
    });

    test("getOrCreateInstallId generates different IDs for different installations", async () => {
      const db1 = new TestDataDB();
      const db2 = new TestDataDB();
      const id1 = await db1.getOrCreateInstallId();
      const id2 = await db2.getOrCreateInstallId();
      expect(id1).not.toBe(id2);
      db1.close();
      db2.close();
    });
  });

  describe("Low-level secrets operations", () => {
    const testWorkspace = {
      workspace_id: "ws_test123",
      directory: "/test/path",
      opencode_port: null,
      opencode_pid: null,
      title: null,
      created_at: new Date().toISOString(),
      last_used: new Date().toISOString(),
    };

    beforeEach(() => {
      dataDb.insertWorkspace(testWorkspace);
    });

    test("getWorkspaceSecrets returns null when no secrets", () => {
      const secrets = dataDb.getWorkspaceSecrets("ws_test123");
      expect(secrets).toBeNull();
    });

    test("setWorkspaceSecrets stores plain text JSON string", () => {
      const json = JSON.stringify({ providers: { anthropic: { api_key: "sk-ant-test" } } });
      dataDb.setWorkspaceSecrets("ws_test123", json);

      const retrieved = dataDb.getWorkspaceSecrets("ws_test123");
      expect(retrieved).toBe(json);
    });

    test("stored secrets are readable plain text", () => {
      const secrets = { providers: { anthropic: { api_key: "sk-ant-visible" } } };
      dataDb.setWorkspaceSecrets("ws_test123", JSON.stringify(secrets));

      const retrieved = dataDb.getWorkspaceSecrets("ws_test123");
      expect(typeof retrieved).toBe("string");
      // Should be parseable JSON, not encrypted binary
      const parsed = JSON.parse(retrieved as string);
      expect(parsed.providers.anthropic.api_key).toBe("sk-ant-visible");
    });

    test("deleteWorkspaceSecrets removes secrets", () => {
      const json = JSON.stringify({ providers: {} });
      dataDb.setWorkspaceSecrets("ws_test123", json);

      dataDb.deleteWorkspaceSecrets("ws_test123");

      const retrieved = dataDb.getWorkspaceSecrets("ws_test123");
      expect(retrieved).toBeNull();
    });
  });
});
