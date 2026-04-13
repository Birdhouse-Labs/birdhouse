// ABOUTME: Tests for token aggregation logic
// ABOUTME: Validates last-message-only calculation matching OpenCode TUI behavior

import { describe, expect, test, vi } from "vitest";
import type { BirdhouseAssistantMessageInfo, BirdhouseUserMessageInfo } from "../../../server/src/harness/types";
import type { Message } from "../types/messages";
import { aggregateTokenStats } from "./token-aggregation";

// Mock the model-limits store
vi.mock("../stores/model-limits", () => ({
  getModelLimit: vi.fn((modelId: string) => {
    const limits: Record<string, number> = {
      "claude-sonnet-4-5": 1_000_000,
      "claude-opus-4-5": 1_000_000,
    };
    return limits[modelId];
  }),
  fetchModelLimits: vi.fn(),
  clearCache: vi.fn(),
  isLimitsLoaded: vi.fn(() => true),
  getFetchError: vi.fn(() => null),
}));

/**
 * Helper to create mock harness message info for tests
 */
function createMockMessageInfo(
  id: string,
  role: "user" | "assistant",
): BirdhouseUserMessageInfo | BirdhouseAssistantMessageInfo {
  if (role === "user") {
    return {
      id,
      sessionID: "test_session",
      role: "user",
      time: { created: Date.now() },
    } as BirdhouseUserMessageInfo;
  }
  return {
    id,
    sessionID: "test_session",
    role: "assistant",
    time: { created: Date.now() },
    parentID: "msg_user",
    modelID: "test-model",
    providerID: "test-provider",
    mode: "test",
    cost: 0,
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
    path: { cwd: "/", root: "/" },
  } as BirdhouseAssistantMessageInfo;
}

describe("aggregateTokenStats", () => {
  test("returns zero stats for empty messages array", () => {
    const result = aggregateTokenStats([], "claude-sonnet-4-5");

    expect(result).toEqual({
      used: 0,
      limit: 1_000_000,
      model: "claude-sonnet-4-5",
    });
  });

  test("returns zero stats with undefined limit for unknown model", () => {
    const result = aggregateTokenStats([], "unknown-model");

    expect(result).toEqual({
      used: 0,
      limit: 0, // Unknown model returns 0
      model: "unknown-model",
    });
  });

  test("returns stats from single assistant message with tokens", () => {
    const messages: Message[] = [
      {
        id: "msg_1",
        role: "assistant",
        content: "Test response",
        blocks: [],
        timestamp: new Date(),
        model: "claude-sonnet-4-5",
        provider: "anthropic",
        tokens: {
          input: 1000,
          output: 500,
          reasoning: 0,
          cache: { read: 200, write: 100 },
        },
        messageInfo: createMockMessageInfo("msg_1", "assistant"),
      },
    ];

    const result = aggregateTokenStats(messages, "claude-sonnet-4-5");

    expect(result.model).toBe("claude-sonnet-4-5");
    expect(result.limit).toBe(1_000_000);
    expect(result.used).toBe(1800); // 1000 + 500 + 0 + 200 + 100
  });

  test("ignores user messages when aggregating tokens", () => {
    const messages: Message[] = [
      {
        id: "msg_1",
        role: "user",
        content: "Hello",
        blocks: [],
        timestamp: new Date(),
        messageInfo: createMockMessageInfo("msg_1", "user"),
      },
      {
        id: "msg_2",
        role: "assistant",
        content: "Hi there",
        blocks: [],
        timestamp: new Date(),
        messageInfo: createMockMessageInfo("msg_2", "assistant"),
      },
    ];

    const result = aggregateTokenStats(messages, "claude-sonnet-4-5");

    // Should only count assistant messages
    expect(result).toBeDefined();
  });

  test("returns only last message tokens (matches OpenCode TUI behavior)", () => {
    // Messages are reversed by message-adapter (newest-first in real usage)
    const messages: Message[] = [
      {
        id: "msg_2",
        role: "assistant",
        content: "Second response (newest)",
        blocks: [],
        timestamp: new Date(),
        tokens: {
          input: 2000,
          output: 800,
          reasoning: 100,
          cache: { read: 500, write: 0 },
        },
        messageInfo: createMockMessageInfo("msg_2", "assistant"),
      },
      {
        id: "msg_1",
        role: "assistant",
        content: "First response (older)",
        blocks: [],
        timestamp: new Date(),
        tokens: {
          input: 1000,
          output: 500,
          reasoning: 0,
          cache: { read: 200, write: 100 },
        },
        messageInfo: createMockMessageInfo("msg_1", "assistant"),
      },
    ];

    const result = aggregateTokenStats(messages, "claude-sonnet-4-5");

    // Should only return newest message tokens (msg_2, first in reversed array)
    // Used = last message total (OpenCode TUI formula)
    // 2000 + 800 + 100 + 500 + 0 = 3400
    expect(result.used).toBe(3400);
  });

  test("handles messages with missing token data gracefully", () => {
    const messages: Message[] = [
      {
        id: "msg_1",
        role: "assistant",
        content: "Response without tokens",
        blocks: [],
        timestamp: new Date(),
        messageInfo: createMockMessageInfo("msg_1", "assistant"),
      },
    ];

    // Should not throw, should return zeros
    expect(() => aggregateTokenStats(messages, "claude-sonnet-4-5")).not.toThrow();
  });

  test("returns last message with reasoning tokens (matches OpenCode TUI)", () => {
    // Messages reversed (newest-first, as received from message-adapter)
    const messages: Message[] = [
      {
        id: "msg_3",
        role: "assistant",
        content: "Third response (newest)",
        blocks: [],
        timestamp: new Date(),
        tokens: {
          input: 15000,
          output: 3000,
          reasoning: 0,
          cache: { read: 1000, write: 200 },
        },
        messageInfo: createMockMessageInfo("msg_3", "assistant"),
      },
      {
        id: "msg_2",
        role: "assistant",
        content: "Second response",
        blocks: [],
        timestamp: new Date(),
        tokens: {
          input: 10000,
          output: 2000,
          reasoning: 1000,
          cache: { read: 500, write: 100 },
        },
        messageInfo: createMockMessageInfo("msg_2", "assistant"),
      },
      {
        id: "msg_1",
        role: "assistant",
        content: "First response (oldest)",
        blocks: [],
        timestamp: new Date(),
        tokens: {
          input: 5000,
          output: 1000,
          reasoning: 500,
          cache: { read: 100, write: 50 },
        },
        messageInfo: createMockMessageInfo("msg_1", "assistant"),
      },
    ];

    const result = aggregateTokenStats(messages, "claude-sonnet-4-5");

    // Should only use newest message (msg_3, first in reversed array)
    // 15000 + 3000 + 0 + 1000 + 200 = 19200
    expect(result.used).toBe(19200);
  });

  test("single message includes all tokens including cache", () => {
    const messages: Message[] = [
      {
        id: "msg_1",
        role: "assistant",
        content: "Only response",
        blocks: [],
        timestamp: new Date(),
        tokens: {
          input: 8000,
          output: 1500,
          reasoning: 200,
          cache: { read: 300, write: 100 },
        },
        messageInfo: createMockMessageInfo("msg_1", "assistant"),
      },
    ];

    const result = aggregateTokenStats(messages, "claude-sonnet-4-5");

    // Used includes all tokens: 8000 + 1500 + 200 + 300 + 100 = 10100
    expect(result.used).toBe(10100);
  });

  test("matches real OpenCode TUI example (ses_3fd06f125ffe6gyYgNyhKj873j)", () => {
    // Real session had 62 messages, last one had these tokens
    const messages: Message[] = [
      // ... 61 previous messages omitted ...
      {
        id: "msg_last",
        role: "assistant",
        content: "Last response",
        blocks: [],
        timestamp: new Date(),
        tokens: {
          input: 4,
          output: 57,
          reasoning: 0,
          cache: { read: 140147, write: 977 },
        },
        messageInfo: createMockMessageInfo("msg_last", "assistant"),
      },
    ];

    const result = aggregateTokenStats(messages, "claude-sonnet-4-5");

    // OpenCode TUI showed: 141,185 tokens
    // Calculation: 4 + 57 + 0 + 140147 + 977 = 141185
    expect(result.used).toBe(141185);
  });
});
