// ABOUTME: Tests for workspace configuration API service functions
// ABOUTME: Validates API operations with mocked fetch and adapters

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the adapters
vi.mock("../adapters/config-adapter", () => ({
  adaptWorkspaceConfig: vi.fn(),
  toWorkspaceConfigUpdateAPI: vi.fn(),
}));

import * as configAdapter from "../adapters/config-adapter";
import type { WorkspaceConfigResponseAPI } from "../types/api-types";
import type { WorkspaceConfig, WorkspaceConfigUpdate } from "../types/config-types";
import { fetchWorkspaceConfig, updateWorkspaceConfig, updateWorkspaceTitle } from "./workspace-config-api";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch");
});

describe("fetchWorkspaceConfig", () => {
  const mockWorkspaceId = "ws_test123";
  const mockAPIResponse: WorkspaceConfigResponseAPI = {
    providers: {
      anthropic: { api_key: "sk-ant-test" },
      openai: { api_key: "sk-openai-test" },
    },
    mcp: {
      "test-server": {
        type: "local",
        command: "node",
        args: ["server.js"],
        enabled: true,
      },
    },
    env: null,
  };
  const mockAdaptedConfig: WorkspaceConfig = {
    providers: new Map([
      ["anthropic", "sk-ant-test"],
      ["openai", "sk-openai-test"],
    ]),
    anthropicOptions: { extended_context: false },
    mcpServers: {
      "test-server": {
        type: "local",
        command: "node",
        args: ["server.js"],
        enabled: true,
      },
    },
    envVars: new Map(),
  };

  it("should successfully fetch and adapt workspace config", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAPIResponse,
    } as Response);

    vi.mocked(configAdapter.adaptWorkspaceConfig).mockReturnValueOnce(mockAdaptedConfig);

    const result = await fetchWorkspaceConfig(mockWorkspaceId);

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/api/workspaces/${mockWorkspaceId}/config`));
    expect(configAdapter.adaptWorkspaceConfig).toHaveBeenCalledWith(mockAPIResponse);
    expect(result).toBe(mockAdaptedConfig);
  });

  it("should construct correct URL with workspace ID", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAPIResponse,
    } as Response);

    vi.mocked(configAdapter.adaptWorkspaceConfig).mockReturnValueOnce(mockAdaptedConfig);

    await fetchWorkspaceConfig("ws_custom456");

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/workspaces/ws_custom456/config"));
  });

  it("should throw error with JSON error message on HTTP 404", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => JSON.stringify({ error: "Workspace not found" }),
    } as Response);

    await expect(fetchWorkspaceConfig(mockWorkspaceId)).rejects.toThrow("Workspace not found");
  });

  it("should throw error with JSON error message on HTTP 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => JSON.stringify({ error: "Database connection failed" }),
    } as Response);

    await expect(fetchWorkspaceConfig(mockWorkspaceId)).rejects.toThrow("Database connection failed");
  });

  it("should fall back to statusText when error response is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "Plain text error",
    } as Response);

    await expect(fetchWorkspaceConfig(mockWorkspaceId)).rejects.toThrow("Service Unavailable");
  });

  it("should fall back to statusText when error response has no error field", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ message: "Invalid data" }),
    } as Response);

    await expect(fetchWorkspaceConfig(mockWorkspaceId)).rejects.toThrow("Bad Request");
  });

  it("should handle network errors when fetch throws", async () => {
    const networkError = new Error("Network connection lost");
    vi.mocked(fetch).mockRejectedValueOnce(networkError);

    await expect(fetchWorkspaceConfig(mockWorkspaceId)).rejects.toThrow("Network connection lost");
  });

  it("should handle adapter throwing error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAPIResponse,
    } as Response);

    const adapterError = new Error("Invalid API format");
    vi.mocked(configAdapter.adaptWorkspaceConfig).mockImplementationOnce(() => {
      throw adapterError;
    });

    await expect(fetchWorkspaceConfig(mockWorkspaceId)).rejects.toThrow("Invalid API format");
  });

  it("should wrap unknown errors with generic message", async () => {
    vi.mocked(fetch).mockRejectedValueOnce("String error");

    await expect(fetchWorkspaceConfig(mockWorkspaceId)).rejects.toThrow("Unknown error");
  });
});

describe("updateWorkspaceConfig", () => {
  const mockWorkspaceId = "ws_test123";
  const mockUpdate: WorkspaceConfigUpdate = {
    providers: new Map([["openai", "sk-test123"]]),
    mcpServers: {
      "new-server": {
        type: "remote",
        url: "http://localhost:8080",
        enabled: true,
      },
    },
  };
  const mockAPIUpdate = {
    providers: {
      openai: { api_key: "sk-test123" },
    },
    mcp: {
      "new-server": {
        type: "remote" as const,
        url: "http://localhost:8080",
        enabled: true,
      },
    },
  };

  it("should successfully update workspace config", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    vi.mocked(configAdapter.toWorkspaceConfigUpdateAPI).mockReturnValueOnce(mockAPIUpdate);

    await updateWorkspaceConfig(mockWorkspaceId, mockUpdate);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/workspaces/${mockWorkspaceId}/config`),
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockAPIUpdate),
      }),
    );
  });

  it("should call adapter to transform request", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    vi.mocked(configAdapter.toWorkspaceConfigUpdateAPI).mockReturnValueOnce(mockAPIUpdate);

    await updateWorkspaceConfig(mockWorkspaceId, mockUpdate);

    expect(configAdapter.toWorkspaceConfigUpdateAPI).toHaveBeenCalledWith(mockUpdate);
  });

  it("should construct correct URL with workspace ID", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    vi.mocked(configAdapter.toWorkspaceConfigUpdateAPI).mockReturnValueOnce({});

    await updateWorkspaceConfig("ws_custom789", mockUpdate);

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/workspaces/ws_custom789/config"), expect.any(Object));
  });

  it("should throw error with JSON error message on HTTP 400", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ error: "Invalid provider configuration" }),
    } as Response);

    vi.mocked(configAdapter.toWorkspaceConfigUpdateAPI).mockReturnValueOnce(mockAPIUpdate);

    await expect(updateWorkspaceConfig(mockWorkspaceId, mockUpdate)).rejects.toThrow("Invalid provider configuration");
  });

  it("should throw error with JSON error message on HTTP 404", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => JSON.stringify({ error: "Workspace not found" }),
    } as Response);

    vi.mocked(configAdapter.toWorkspaceConfigUpdateAPI).mockReturnValueOnce(mockAPIUpdate);

    await expect(updateWorkspaceConfig(mockWorkspaceId, mockUpdate)).rejects.toThrow("Workspace not found");
  });

  it("should throw error with JSON error message on HTTP 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => JSON.stringify({ error: "Failed to write config file" }),
    } as Response);

    vi.mocked(configAdapter.toWorkspaceConfigUpdateAPI).mockReturnValueOnce(mockAPIUpdate);

    await expect(updateWorkspaceConfig(mockWorkspaceId, mockUpdate)).rejects.toThrow("Failed to write config file");
  });

  it("should fall back to statusText when error response is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      text: async () => "<html>Gateway error</html>",
    } as Response);

    vi.mocked(configAdapter.toWorkspaceConfigUpdateAPI).mockReturnValueOnce(mockAPIUpdate);

    await expect(updateWorkspaceConfig(mockWorkspaceId, mockUpdate)).rejects.toThrow("Bad Gateway");
  });

  it("should fall back to statusText when error response has no error field", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => JSON.stringify({ status: "forbidden" }),
    } as Response);

    vi.mocked(configAdapter.toWorkspaceConfigUpdateAPI).mockReturnValueOnce(mockAPIUpdate);

    await expect(updateWorkspaceConfig(mockWorkspaceId, mockUpdate)).rejects.toThrow("Forbidden");
  });

  it("should handle network errors when fetch throws", async () => {
    const networkError = new Error("Connection timeout");
    vi.mocked(fetch).mockRejectedValueOnce(networkError);

    vi.mocked(configAdapter.toWorkspaceConfigUpdateAPI).mockReturnValueOnce(mockAPIUpdate);

    await expect(updateWorkspaceConfig(mockWorkspaceId, mockUpdate)).rejects.toThrow("Connection timeout");
  });

  it("should handle adapter throwing error", async () => {
    const adapterError = new Error("Invalid update format");
    vi.mocked(configAdapter.toWorkspaceConfigUpdateAPI).mockImplementationOnce(() => {
      throw adapterError;
    });

    await expect(updateWorkspaceConfig(mockWorkspaceId, mockUpdate)).rejects.toThrow("Invalid update format");
  });

  it("should wrap unknown errors with generic message", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(42);

    vi.mocked(configAdapter.toWorkspaceConfigUpdateAPI).mockReturnValueOnce(mockAPIUpdate);

    await expect(updateWorkspaceConfig(mockWorkspaceId, mockUpdate)).rejects.toThrow("Unknown error");
  });

  it("should send empty object when update has no fields", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    const emptyAPIUpdate = {};
    vi.mocked(configAdapter.toWorkspaceConfigUpdateAPI).mockReturnValueOnce(emptyAPIUpdate);

    await updateWorkspaceConfig(mockWorkspaceId, {});

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({}),
      }),
    );
  });
});

describe("updateWorkspaceTitle", () => {
  const mockWorkspaceId = "ws_test123";
  const mockTitle = "My Updated Workspace";

  it("should successfully update workspace title", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    await updateWorkspaceTitle(mockWorkspaceId, mockTitle);

    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(call[0]).toContain(`/workspaces/${mockWorkspaceId}`);
    expect(call[0]).not.toContain("/config");
    expect(call[1]?.method).toBe("PATCH");
    expect(call[1]?.headers).toEqual({ "Content-Type": "application/json" });
    expect(call[1]?.body).toBe(JSON.stringify({ title: mockTitle }));
  });

  it("should construct correct URL with workspace ID", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    await updateWorkspaceTitle("ws_custom999", "Test Title");

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/workspaces/ws_custom999"), expect.any(Object));
  });

  it("should send correct body format with title field", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    await updateWorkspaceTitle(mockWorkspaceId, "Special Title");

    const call = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(call[1]?.body as string);
    expect(body).toEqual({ title: "Special Title" });
    expect(Object.keys(body)).toEqual(["title"]);
  });

  it("should use PATCH method not PUT", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    await updateWorkspaceTitle(mockWorkspaceId, mockTitle);

    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(call[1]?.method).toBe("PATCH");
  });

  it("should throw error with JSON error message on HTTP 404", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => JSON.stringify({ error: "Workspace not found" }),
    } as Response);

    await expect(updateWorkspaceTitle(mockWorkspaceId, mockTitle)).rejects.toThrow("Workspace not found");
  });

  it("should throw error with JSON error message on HTTP 400", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ error: "Title cannot be empty" }),
    } as Response);

    await expect(updateWorkspaceTitle(mockWorkspaceId, "")).rejects.toThrow("Title cannot be empty");
  });

  it("should throw error with JSON error message on HTTP 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => JSON.stringify({ error: "Failed to persist title" }),
    } as Response);

    await expect(updateWorkspaceTitle(mockWorkspaceId, mockTitle)).rejects.toThrow("Failed to persist title");
  });

  it("should fall back to statusText when error response is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "Service temporarily down",
    } as Response);

    await expect(updateWorkspaceTitle(mockWorkspaceId, mockTitle)).rejects.toThrow("Service Unavailable");
  });

  it("should fall back to statusText when error response has no error field", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => JSON.stringify({ message: "Authentication required" }),
    } as Response);

    await expect(updateWorkspaceTitle(mockWorkspaceId, mockTitle)).rejects.toThrow("Unauthorized");
  });

  it("should handle network errors when fetch throws", async () => {
    const networkError = new Error("DNS lookup failed");
    vi.mocked(fetch).mockRejectedValueOnce(networkError);

    await expect(updateWorkspaceTitle(mockWorkspaceId, mockTitle)).rejects.toThrow("DNS lookup failed");
  });

  it("should wrap unknown errors with generic message", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(null);

    await expect(updateWorkspaceTitle(mockWorkspaceId, mockTitle)).rejects.toThrow("Unknown error");
  });

  it("should handle empty string title", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    await updateWorkspaceTitle(mockWorkspaceId, "");

    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(JSON.parse(call[1]?.body as string)).toEqual({ title: "" });
  });

  it("should handle title with special characters", async () => {
    const specialTitle = 'Title with "quotes" & <symbols>';
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
    } as Response);

    await updateWorkspaceTitle(mockWorkspaceId, specialTitle);

    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(JSON.parse(call[1]?.body as string)).toEqual({ title: specialTitle });
  });
});
