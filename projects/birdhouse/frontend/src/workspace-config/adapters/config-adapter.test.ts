// ABOUTME: Unit tests for workspace config adapter transformations
// ABOUTME: Tests bidirectional mapping between API and UI formats

import { describe, expect, it } from "vitest";
import type { McpServersAPI, WorkspaceConfigResponseAPI } from "../types/api-types";
import type { McpServers, WorkspaceConfigUpdate } from "../types/config-types";
import { adaptWorkspaceConfig, toWorkspaceConfigUpdateAPI } from "./config-adapter";

describe("adaptWorkspaceConfig", () => {
  describe("providers transformation", () => {
    it("converts providers Record to Map with API keys", () => {
      const api: WorkspaceConfigResponseAPI = {
        providers: {
          openai: { api_key: "sk-test-123" },
          anthropic: { api_key: "sk-ant-456" },
        },
        mcp: null,
        env: null,
      };

      const result = adaptWorkspaceConfig(api);

      expect(result.providers).toBeInstanceOf(Map);
      expect(result.providers.size).toBe(2);
      expect(result.providers.get("openai")).toBe("sk-test-123");
      expect(result.providers.get("anthropic")).toBe("sk-ant-456");
    });

    it("handles empty providers object", () => {
      const api: WorkspaceConfigResponseAPI = {
        providers: {},
        mcp: null,
        env: null,
      };

      const result = adaptWorkspaceConfig(api);

      expect(result.providers).toBeInstanceOf(Map);
      expect(result.providers.size).toBe(0);
    });

    it("handles multiple providers", () => {
      const api: WorkspaceConfigResponseAPI = {
        providers: {
          openai: { api_key: "sk-openai-test" },
          anthropic: { api_key: "sk-ant-test" },
          google: { api_key: "google-key" },
          mistral: { api_key: "mistral-key" },
          perplexity: { api_key: "perplexity-key" },
        },
        mcp: null,
        env: null,
      };

      const result = adaptWorkspaceConfig(api);

      expect(result.providers.size).toBe(5);
      expect(result.providers.get("openai")).toBe("sk-openai-test");
      expect(result.providers.get("anthropic")).toBe("sk-ant-test");
      expect(result.providers.get("google")).toBe("google-key");
      expect(result.providers.get("mistral")).toBe("mistral-key");
      expect(result.providers.get("perplexity")).toBe("perplexity-key");
    });
  });

  describe("mcpServers transformation", () => {
    it("passes through mcpServers as-is when present", () => {
      const mcpServers: McpServersAPI = {
        filesystem: {
          type: "local",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
          enabled: true,
        },
        github: {
          type: "remote",
          url: "http://localhost:3001",
          enabled: false,
        },
      };

      const api: WorkspaceConfigResponseAPI = {
        providers: {},
        mcp: mcpServers,
        env: null,
      };

      const result = adaptWorkspaceConfig(api);

      expect(result.mcpServers).toBe(mcpServers);
      expect(result.mcpServers).toEqual(mcpServers);
    });

    it("handles null mcp field", () => {
      const api: WorkspaceConfigResponseAPI = {
        providers: { openai: { api_key: "sk-test" } },
        mcp: null,
        env: null,
      };

      const result = adaptWorkspaceConfig(api);

      expect(result.mcpServers).toBeNull();
    });

    it("handles MCP servers with optional fields", () => {
      const mcpServers: McpServersAPI = {
        minimal: {
          type: "local",
          command: "node",
        },
        full: {
          type: "local",
          command: "npx",
          args: ["--yes", "server"],
          env: { DEBUG: "true", API_KEY: "secret" },
          enabled: true,
        },
      };

      const api: WorkspaceConfigResponseAPI = {
        providers: {},
        mcp: mcpServers,
        env: null,
      };

      const result = adaptWorkspaceConfig(api);

      expect(result.mcpServers?.["minimal"]).toEqual({
        type: "local",
        command: "node",
      });
      expect(result.mcpServers?.["full"]).toEqual({
        type: "local",
        command: "npx",
        args: ["--yes", "server"],
        env: { DEBUG: "true", API_KEY: "secret" },
        enabled: true,
      });
    });
  });

  describe("complete configuration", () => {
    it("transforms both providers and mcpServers correctly", () => {
      const api: WorkspaceConfigResponseAPI = {
        providers: {
          openai: { api_key: "sk-openai" },
          anthropic: { api_key: "sk-ant" },
        },
        mcp: {
          filesystem: {
            type: "local",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem"],
            enabled: true,
          },
        },
        env: null,
      };

      const result = adaptWorkspaceConfig(api);

      expect(result.providers.size).toBe(2);
      expect(result.providers.get("openai")).toBe("sk-openai");
      expect(result.providers.get("anthropic")).toBe("sk-ant");
      expect(result.mcpServers).toEqual(api.mcp);
    });
  });
});

describe("toWorkspaceConfigUpdateAPI", () => {
  describe("providers transformation", () => {
    it("converts providers Map to Record with api_key wrapper", () => {
      const update: WorkspaceConfigUpdate = {
        providers: new Map([
          ["openai", "sk-abc123"],
          ["anthropic", "sk-ant-xyz789"],
        ]),
      };

      const result = toWorkspaceConfigUpdateAPI(update);

      expect(result.providers).toEqual({
        openai: { api_key: "sk-abc123" },
        anthropic: { api_key: "sk-ant-xyz789" },
      });
    });

    it("handles empty providers Map", () => {
      const update: WorkspaceConfigUpdate = {
        providers: new Map(),
      };

      const result = toWorkspaceConfigUpdateAPI(update);

      expect(result.providers).toEqual({});
    });

    it("handles single provider", () => {
      const update: WorkspaceConfigUpdate = {
        providers: new Map([["openai", "sk-test-key"]]),
      };

      const result = toWorkspaceConfigUpdateAPI(update);

      expect(result.providers).toEqual({
        openai: { api_key: "sk-test-key" },
      });
    });

    it("handles multiple providers", () => {
      const update: WorkspaceConfigUpdate = {
        providers: new Map([
          ["openai", "sk-openai-123"],
          ["anthropic", "sk-ant-456"],
          ["google", "sk-google-789"],
        ]),
      };

      const result = toWorkspaceConfigUpdateAPI(update);

      expect(result.providers).toEqual({
        openai: { api_key: "sk-openai-123" },
        anthropic: { api_key: "sk-ant-456" },
        google: { api_key: "sk-google-789" },
      });
    });
  });

  describe("mcpServers transformation", () => {
    it("passes through mcpServers as mcp field", () => {
      const mcpServers: McpServers = {
        filesystem: {
          type: "local",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
          enabled: true,
        },
      };

      const update: WorkspaceConfigUpdate = {
        mcpServers,
      };

      const result = toWorkspaceConfigUpdateAPI(update);

      expect(result.mcp).toEqual(mcpServers);
    });

    it("handles complex MCP configuration", () => {
      const mcpServers: McpServers = {
        server1: {
          type: "local",
          command: "node",
          args: ["server.js"],
          env: { PORT: "3000" },
          enabled: true,
        },
        server2: {
          type: "remote",
          url: "https://api.example.com",
          enabled: false,
        },
      };

      const update: WorkspaceConfigUpdate = {
        mcpServers,
      };

      const result = toWorkspaceConfigUpdateAPI(update);

      expect(result.mcp).toEqual(mcpServers);
    });
  });

  describe("partial updates", () => {
    it("handles update with only providers", () => {
      const update: WorkspaceConfigUpdate = {
        providers: new Map([["openai", "sk-key"]]),
      };

      const result = toWorkspaceConfigUpdateAPI(update);

      expect(result.providers).toBeDefined();
      expect(result.mcp).toBeUndefined();
    });

    it("handles update with only mcpServers", () => {
      const update: WorkspaceConfigUpdate = {
        mcpServers: {
          filesystem: {
            type: "local",
            command: "npx",
          },
        },
      };

      const result = toWorkspaceConfigUpdateAPI(update);

      expect(result.providers).toBeUndefined();
      expect(result.mcp).toBeDefined();
    });

    it("handles update with both providers and mcpServers", () => {
      const update: WorkspaceConfigUpdate = {
        providers: new Map([["openai", "sk-key"]]),
        mcpServers: {
          filesystem: {
            type: "local",
            command: "npx",
          },
        },
      };

      const result = toWorkspaceConfigUpdateAPI(update);

      expect(result.providers).toBeDefined();
      expect(result.mcp).toBeDefined();
    });

    it("handles empty update object", () => {
      const update: WorkspaceConfigUpdate = {};

      const result = toWorkspaceConfigUpdateAPI(update);

      expect(result).toEqual({});
      expect(result.providers).toBeUndefined();
      expect(result.mcp).toBeUndefined();
    });
  });
});

describe("round-trip transformations", () => {
  describe("read → update flow", () => {
    it("preserves provider data through read-then-update flow", () => {
      // Simulate reading config from API
      const apiResponse: WorkspaceConfigResponseAPI = {
        providers: {
          openai: { api_key: "sk-existing-openai" },
          anthropic: { api_key: "sk-existing-ant" },
        },
        mcp: null,
        env: null,
      };

      const _uiConfig = adaptWorkspaceConfig(apiResponse);

      // User updates a provider key
      const update: WorkspaceConfigUpdate = {
        providers: new Map([["openai", "sk-new-key-123"]]),
      };

      const apiUpdate = toWorkspaceConfigUpdateAPI(update);

      // Verify the update format is correct
      expect(apiUpdate.providers).toEqual({
        openai: { api_key: "sk-new-key-123" },
      });
    });

    it("preserves MCP data through read-then-update flow", () => {
      // Simulate reading config from API
      const mcpServers: McpServersAPI = {
        filesystem: {
          type: "local",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
          enabled: true,
        },
      };

      const apiResponse: WorkspaceConfigResponseAPI = {
        providers: {},
        mcp: mcpServers,
        env: null,
      };

      const uiConfig = adaptWorkspaceConfig(apiResponse);

      // User modifies MCP config
      if (!uiConfig.mcpServers) {
        throw new Error("Expected mcpServers to be defined");
      }
      const modifiedMcp: McpServers = {
        ...uiConfig.mcpServers,
        filesystem: {
          type: "local" as const,
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
          enabled: false,
        },
      };

      const update: WorkspaceConfigUpdate = {
        mcpServers: modifiedMcp,
      };

      const apiUpdate = toWorkspaceConfigUpdateAPI(update);

      // Verify MCP structure is preserved
      expect(apiUpdate.mcp?.["filesystem"]).toEqual({
        type: "local",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"],
        enabled: false,
      });
    });
  });

  describe("data structure conversions", () => {
    it("correctly converts between Map and Record for providers", () => {
      // Start with Record
      const record = {
        provider1: true,
        provider2: false,
        provider3: true,
      };

      // Convert to Map
      const map = new Map(Object.entries(record));

      expect(map.get("provider1")).toBe(true);
      expect(map.get("provider2")).toBe(false);
      expect(map.get("provider3")).toBe(true);

      // Simulate update with API keys (Map<string, string>)
      const updateMap = new Map([
        ["provider1", "key1"],
        ["provider3", "key3"],
      ]);

      // Convert back to Record with wrapper
      const updateRecord: Record<string, { api_key: string }> = {};
      for (const [key, value] of updateMap) {
        updateRecord[key] = { api_key: value };
      }

      expect(updateRecord).toEqual({
        provider1: { api_key: "key1" },
        provider3: { api_key: "key3" },
      });
    });

    it("handles Map iteration order preservation", () => {
      const update: WorkspaceConfigUpdate = {
        providers: new Map([
          ["zebra", "key-z"],
          ["alpha", "key-a"],
          ["beta", "key-b"],
        ]),
      };

      const result = toWorkspaceConfigUpdateAPI(update);

      // Record should have all keys
      if (!result.providers) {
        throw new Error("Expected providers to be defined");
      }
      expect(Object.keys(result.providers)).toEqual(["zebra", "alpha", "beta"]);
      expect(result.providers["zebra"]).toEqual({ api_key: "key-z" });
      expect(result.providers["alpha"]).toEqual({ api_key: "key-a" });
      expect(result.providers["beta"]).toEqual({ api_key: "key-b" });
    });
  });
});

describe("adaptWorkspaceConfig env vars", () => {
  it("converts env Record to Map", () => {
    const api: WorkspaceConfigResponseAPI = {
      providers: {},
      mcp: null,
      env: { TAVILY_API_KEY: "tvly-abc123", MY_VAR: "hello" },
    };

    const result = adaptWorkspaceConfig(api);

    expect(result.envVars).toBeInstanceOf(Map);
    expect(result.envVars.size).toBe(2);
    expect(result.envVars.get("TAVILY_API_KEY")).toBe("tvly-abc123");
    expect(result.envVars.get("MY_VAR")).toBe("hello");
  });

  it("returns empty Map when env is null", () => {
    const api: WorkspaceConfigResponseAPI = {
      providers: {},
      mcp: null,
      env: null,
    };

    const result = adaptWorkspaceConfig(api);

    expect(result.envVars).toBeInstanceOf(Map);
    expect(result.envVars.size).toBe(0);
  });

  it("returns empty Map when env is empty object", () => {
    const api: WorkspaceConfigResponseAPI = {
      providers: {},
      mcp: null,
      env: {},
    };

    const result = adaptWorkspaceConfig(api);

    expect(result.envVars.size).toBe(0);
  });
});

describe("toWorkspaceConfigUpdateAPI env vars", () => {
  it("converts envVars Map to env Record", () => {
    const update: WorkspaceConfigUpdate = {
      envVars: new Map([
        ["TAVILY_API_KEY", "tvly-abc123"],
        ["MY_VAR", "hello"],
      ]),
    };

    const result = toWorkspaceConfigUpdateAPI(update);

    expect(result.env).toEqual({
      TAVILY_API_KEY: "tvly-abc123",
      MY_VAR: "hello",
    });
  });

  it("passes empty string through (server interprets as deletion)", () => {
    const update: WorkspaceConfigUpdate = {
      envVars: new Map([["TO_DELETE", ""]]),
    };

    const result = toWorkspaceConfigUpdateAPI(update);

    expect(result.env).toEqual({ TO_DELETE: "" });
  });

  it("omits env field when envVars not in update", () => {
    const update: WorkspaceConfigUpdate = {
      providers: new Map([["openai", "sk-key"]]),
    };

    const result = toWorkspaceConfigUpdateAPI(update);

    expect(result.env).toBeUndefined();
  });

  it("handles empty envVars Map", () => {
    const update: WorkspaceConfigUpdate = {
      envVars: new Map(),
    };

    const result = toWorkspaceConfigUpdateAPI(update);

    expect(result.env).toEqual({});
  });
});
