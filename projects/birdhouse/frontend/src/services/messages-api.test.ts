// ABOUTME: Tests for messages API service functions
// ABOUTME: Validates API operations with mocked fetch

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock adapters
vi.mock("../adapters", () => ({
  mapMessages: vi.fn((messages) => messages),
}));

vi.mock("../adapters/agent-tree-adapter", () => ({
  mapAgentTrees: vi.fn((trees) => trees),
}));

import {
  cloneAgent,
  createAgent,
  fetchAgent,
  fetchAgentTrees,
  fetchMessages,
  fetchModels,
  generateTitle,
  revertAgent,
  SendMessageError,
  sendMessage,
  stopAgent,
  unrevertAgent,
  updateAgentTitle,
} from "./messages-api";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch");
});

describe("fetchMessages", () => {
  const mockWorkspaceId = "ws_test123";
  const mockAgentId = "agent_test123";

  it("should fetch messages for an agent", async () => {
    const mockMessages = [{ id: "msg1", role: "user", content: "Hello" }];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMessages,
    } as Response);

    const result = await fetchMessages(mockWorkspaceId, mockAgentId);

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/agents/${mockAgentId}/messages`));
    expect(result).toEqual(mockMessages);
  });

  it("should throw error on HTTP failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: "Not Found",
    } as Response);

    await expect(fetchMessages(mockWorkspaceId, mockAgentId)).rejects.toThrow("Failed to fetch messages: Not Found");
  });
});

describe("fetchAgent", () => {
  const mockWorkspaceId = "ws_test123";
  const mockAgentId = "agent_test123";

  it("should fetch agent metadata", async () => {
    const mockAgent = { id: mockAgentId, title: "Test Agent" };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAgent,
    } as Response);

    const result = await fetchAgent(mockWorkspaceId, mockAgentId);

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/agents/${mockAgentId}`));
    expect(result).toEqual(mockAgent);
  });

  it("should throw error on HTTP failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: "Not Found",
    } as Response);

    await expect(fetchAgent(mockWorkspaceId, mockAgentId)).rejects.toThrow("Failed to fetch agent: Not Found");
  });
});

describe("generateTitle", () => {
  const mockWorkspaceId = "ws_test123";
  const mockMessage = "Create a function to sort arrays";

  it("should generate title from message", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ title: "Array sorting function" }),
    } as Response);

    const result = await generateTitle(mockWorkspaceId, mockMessage);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/title/generate"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          message: mockMessage,
          source_agent_title: undefined,
        }),
      }),
    );
    expect(result).toBe("Array sorting function");
  });

  it("should include source_agent_title when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ title: "Cloned title" }),
    } as Response);

    await generateTitle(mockWorkspaceId, mockMessage, "Original Agent");

    const call = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(call[1]?.body as string);
    expect(body.source_agent_title).toBe("Original Agent");
  });

  it("should extract error message from JSON response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ error: "Invalid title request" }),
    } as Response);

    await expect(generateTitle(mockWorkspaceId, mockMessage)).rejects.toThrow("Invalid title request");
  });

  it("should fall back to statusText when error is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Server error",
    } as Response);

    await expect(generateTitle(mockWorkspaceId, mockMessage)).rejects.toThrow(
      "Failed to generate title: Internal Server Error",
    );
  });
});

describe("stopAgent", () => {
  const mockWorkspaceId = "ws_test123";
  const mockAgentId = "agent_test123";

  it("should stop an agent", async () => {
    const mockResponse = { success: true };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await stopAgent(mockWorkspaceId, mockAgentId);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/agents/${mockAgentId}/stop`),
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("should throw error with server message on failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Agent not running" }),
    } as Response);

    await expect(stopAgent(mockWorkspaceId, mockAgentId)).rejects.toThrow("Failed to stop agent: Agent not running");
  });
});

describe("sendMessage", () => {
  const mockWorkspaceId = "ws_test123";
  const mockAgentId = "agent_test123";
  const mockText = "Hello, agent!";

  it("should send message in async mode", async () => {
    const mockResponse = { sent: true, async: true };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await sendMessage(mockWorkspaceId, mockAgentId, mockText, {});

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/agents/${mockAgentId}/messages?wait=false`),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          text: mockText,
          agent: undefined,
        }),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("should include agent parameter when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sent: true, async: true }),
    } as Response);

    await sendMessage(mockWorkspaceId, mockAgentId, mockText, { agent: "custom-agent" });

    const call = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(call[1]?.body as string);
    expect(body.agent).toBe("custom-agent");
  });

  it("should include clone_and_send when requested", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sent: true, async: true, cloned_agent: { id: "cloned" } }),
    } as Response);

    await sendMessage(mockWorkspaceId, mockAgentId, mockText, { cloneAndSend: true });

    const call = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(call[1]?.body as string);
    expect(body.clone_and_send).toBe(true);
  });

  it("should throw SendMessageError with details on failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ error: "Invalid message format" }),
    } as Response);

    try {
      await sendMessage(mockWorkspaceId, mockAgentId, mockText, {});
      expect.fail("Should have thrown SendMessageError");
    } catch (error) {
      expect(error).toBeInstanceOf(SendMessageError);
      if (error instanceof SendMessageError) {
        expect(error.message).toBe("Invalid message format");
        expect(error.statusCode).toBe(400);
      }
    }
  });

  it("should fall back to statusText when error is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Server crashed",
    } as Response);

    try {
      await sendMessage(mockWorkspaceId, mockAgentId, mockText, {});
      expect.fail("Should have thrown SendMessageError");
    } catch (error) {
      expect(error).toBeInstanceOf(SendMessageError);
      if (error instanceof SendMessageError) {
        expect(error.message).toBe("Failed to send message: Internal Server Error");
      }
    }
  });
});

describe("fetchModels", () => {
  const mockWorkspaceId = "ws_test123";

  it("should fetch available models", async () => {
    const mockModels = [
      {
        id: "anthropic/claude-sonnet-4",
        name: "Claude Sonnet 4",
        provider: "Anthropic",
        contextLimit: 200_000,
        outputLimit: 64_000,
      },
      { id: "openai/gpt-4", name: "GPT-4", provider: "OpenAI", contextLimit: 128_000, outputLimit: 4096 },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockModels,
    } as Response);

    const result = await fetchModels(mockWorkspaceId);

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/models"));
    expect(result).toEqual(mockModels);
  });

  it("should throw error on HTTP failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: "Service Unavailable",
    } as Response);

    await expect(fetchModels(mockWorkspaceId)).rejects.toThrow("Failed to fetch models: Service Unavailable");
  });
});

describe("createAgent", () => {
  const mockWorkspaceId = "ws_test123";

  it("should create agent with minimal parameters", async () => {
    const mockResponse = { id: "agent_new123" };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await createAgent(mockWorkspaceId);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/agents"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          model: undefined,
          prompt: undefined,
        }),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("should create agent with title", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "agent_new123" }),
    } as Response);

    await createAgent(mockWorkspaceId, "My Agent");

    const call = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(call[1]?.body as string);
    expect(body.title).toBe("My Agent");
  });

  it("should create agent with model and prompt", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "agent_new123", parts: [] }),
    } as Response);

    await createAgent(mockWorkspaceId, "My Agent", "anthropic/claude-sonnet-4", "Write a function");

    const call = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(call[1]?.body as string);
    expect(body.model).toBe("anthropic/claude-sonnet-4");
    expect(body.prompt).toBe("Write a function");
  });

  it("should create agent with agent parameter", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "agent_new123" }),
    } as Response);

    await createAgent(mockWorkspaceId, undefined, undefined, undefined, "custom-agent");

    const call = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(call[1]?.body as string);
    expect(body.agent).toBe("custom-agent");
  });

  it("should throw error on HTTP failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Request",
    } as Response);

    await expect(createAgent(mockWorkspaceId)).rejects.toThrow("Failed to create agent: Bad Request");
  });
});

describe("fetchAgentTrees", () => {
  const mockWorkspaceId = "ws_test123";

  it("should fetch all agent trees", async () => {
    const mockTrees = [
      { root: { id: "agent1", title: "Agent 1", children: [] } },
      { root: { id: "agent2", title: "Agent 2", children: [] } },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ trees: mockTrees }),
    } as Response);

    const result = await fetchAgentTrees(mockWorkspaceId);

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/agents"));
    expect(result).toEqual(mockTrees);
  });

  it("should throw error on HTTP failure", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: "Internal Server Error",
    } as Response);

    await expect(fetchAgentTrees(mockWorkspaceId)).rejects.toThrow(
      "Failed to fetch agent trees: Internal Server Error",
    );
  });
});

describe("updateAgentTitle", () => {
  const mockWorkspaceId = "ws_test123";
  const mockAgentId = "agent_test123";
  const mockTitle = "Updated Title";

  it("should update agent title", async () => {
    const mockResponse = { id: mockAgentId, title: mockTitle };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await updateAgentTitle(mockWorkspaceId, mockAgentId, mockTitle);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/agents/${mockAgentId}`),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: mockTitle }),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("should extract error message from JSON response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ error: "Title cannot be empty" }),
    } as Response);

    await expect(updateAgentTitle(mockWorkspaceId, mockAgentId, "")).rejects.toThrow("Title cannot be empty");
  });

  it("should fall back to statusText when error is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "Agent not found",
    } as Response);

    await expect(updateAgentTitle(mockWorkspaceId, mockAgentId, mockTitle)).rejects.toThrow(
      "Failed to update agent title: Not Found",
    );
  });
});

describe("cloneAgent", () => {
  const mockWorkspaceId = "ws_test123";
  const mockAgentId = "agent_test123";

  it("should clone agent without messageId", async () => {
    const mockResponse = { id: "agent_cloned", title: "Cloned Agent" };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await cloneAgent(mockWorkspaceId, mockAgentId);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/agents/${mockAgentId}/clone`),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("should clone agent from specific message", async () => {
    const mockMessageId = "msg_123";
    const mockResponse = { id: "agent_cloned", title: "Cloned Agent" };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    await cloneAgent(mockWorkspaceId, mockAgentId, mockMessageId);

    const call = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(call[1]?.body as string);
    expect(body.messageId).toBe(mockMessageId);
  });

  it("should extract error message from JSON response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ error: "Message not found" }),
    } as Response);

    await expect(cloneAgent(mockWorkspaceId, mockAgentId, "invalid")).rejects.toThrow("Message not found");
  });
});

describe("revertAgent", () => {
  const mockWorkspaceId = "ws_test123";
  const mockAgentId = "agent_test123";
  const mockMessageId = "msg_123";

  it("should revert agent to specific message", async () => {
    const mockResponse = { success: true, messageText: "Reverted message" };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await revertAgent(mockWorkspaceId, mockAgentId, mockMessageId);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/agents/${mockAgentId}/revert`),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ messageId: mockMessageId }),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("should extract error message from JSON response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => JSON.stringify({ error: "Message not found in history" }),
    } as Response);

    await expect(revertAgent(mockWorkspaceId, mockAgentId, mockMessageId)).rejects.toThrow(
      "Message not found in history",
    );
  });
});

describe("unrevertAgent", () => {
  const mockWorkspaceId = "ws_test123";
  const mockAgentId = "agent_test123";

  it("should unrevert agent", async () => {
    const mockResponse = { success: true };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await unrevertAgent(mockWorkspaceId, mockAgentId);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/agents/${mockAgentId}/unrevert`),
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(mockResponse);
  });

  it("should extract error message from JSON response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ error: "Agent not in reverted state" }),
    } as Response);

    await expect(unrevertAgent(mockWorkspaceId, mockAgentId)).rejects.toThrow("Agent not in reverted state");
  });
});
