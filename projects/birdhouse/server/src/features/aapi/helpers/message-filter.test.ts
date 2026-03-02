// ABOUTME: Tests for message filtering in AAPI
// ABOUTME: Validates error field is preserved in filtered messages

import { describe, expect, it } from "bun:test";
import type { AssistantMessage, Message } from "../../../lib/opencode-client";
import { filterMessage } from "./message-filter";

describe("filterMessage", () => {
  it("should preserve error field with data.message format", () => {
    const message: Message = {
      info: {
        id: "msg_123",
        sessionID: "ses_123",
        role: "assistant",
        time: { created: 1704067200000, completed: 1704067210000 },
        parentID: "msg_user_123",
        modelID: "claude-sonnet-4",
        providerID: "anthropic",
        mode: "build",
        cost: 0,
        tokens: {
          input: 0,
          output: 0,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        error: {
          name: "UnknownError",
          data: {
            message: "Error: Unable to connect. Is the computer able to access the url?",
          },
        },
        path: {
          cwd: "/",
          root: "/",
        },
      } as AssistantMessage,
      parts: [],
    };

    const result = filterMessage(message);

    expect(result.info.error).toBeDefined();
    expect(result.info.error?.name).toBe("UnknownError");
    expect(result.info.error?.data?.message).toBe("Error: Unable to connect. Is the computer able to access the url?");
  });

  it("should preserve error field with direct message format", () => {
    const message: Message = {
      info: {
        id: "msg_456",
        sessionID: "ses_123",
        role: "assistant",
        time: { created: 1704067200000, completed: 1704067210000 },
        parentID: "msg_user_123",
        modelID: "claude-sonnet-4",
        providerID: "anthropic",
        mode: "build",
        cost: 0,
        tokens: {
          input: 0,
          output: 0,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        error: {
          name: "APIError",
          data: {
            message: "Network timeout",
            isRetryable: true,
          },
        },
        path: {
          cwd: "/",
          root: "/",
        },
      } as AssistantMessage,
      parts: [],
    };

    const result = filterMessage(message);

    expect(result.info.error).toBeDefined();
    expect(result.info.error?.name).toBe("APIError");
    expect(result.info.error?.data?.message).toBe("Network timeout");
  });

  it("should not include error field when not present", () => {
    const message: Message = {
      info: {
        id: "msg_789",
        sessionID: "ses_123",
        role: "assistant",
        time: { created: 1704067200000, completed: 1704067210000 },
        parentID: "msg_user_123",
        modelID: "claude-sonnet-4",
        providerID: "anthropic",
        mode: "build",
        cost: 0,
        tokens: {
          input: 100,
          output: 50,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        path: {
          cwd: "/",
          root: "/",
        },
      } as AssistantMessage,
      parts: [
        {
          type: "text",
          text: "Success!",
          id: "part_1",
          sessionID: "ses_123",
          messageID: "msg_test_1",
        },
      ],
    };

    const result = filterMessage(message);

    expect(result.info.error).toBeUndefined();
  });

  it("should filter out cost and tokens while preserving error", () => {
    const message: Message = {
      info: {
        id: "msg_cost_test",
        sessionID: "ses_123",
        role: "assistant",
        time: { created: 1704067200000, completed: 1704067210000 },
        parentID: "msg_user_123",
        modelID: "claude-sonnet-4",
        providerID: "anthropic",
        mode: "build",
        cost: 0.05,
        tokens: {
          input: 1000,
          output: 500,
          reasoning: 100,
          cache: { read: 200, write: 300 },
        },
        error: {
          name: "APIError",
          data: {
            isRetryable: true,
            message: "Rate limit exceeded",
          },
        },
        path: {
          cwd: "/",
          root: "/",
        },
      } as AssistantMessage,
      parts: [],
    };

    const result = filterMessage(message);

    // Error should be preserved
    expect(result.info.error).toBeDefined();
    expect(result.info.error?.name).toBe("APIError");

    // Cost and tokens should be filtered out
    expect("cost" in result.info).toBe(false);
    expect("tokens" in result.info).toBe(false);
  });
});
