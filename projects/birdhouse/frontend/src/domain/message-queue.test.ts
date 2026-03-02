// ABOUTME: Tests for message queue detection utilities
// ABOUTME: Validates logic for detecting queued user messages

import type { AssistantMessage, UserMessage } from "@opencode-ai/sdk";
import { describe, expect, it } from "vitest";
import type { Message } from "../types/messages";
import { findPendingAssistantId, isMessageQueued } from "./message-queue";

/**
 * Helper to create a mock user message
 */
function createUserMessage(id: string): Message {
  return {
    id,
    role: "user",
    content: "test message",
    timestamp: new Date(),
    opencodeMessage: {
      id,
      sessionID: "session_test",
      role: "user",
      time: { created: Date.now() },
      agent: "test",
      model: { providerID: "test", modelID: "test" },
    } as UserMessage,
  };
}

/**
 * Helper to create a mock assistant message
 */
function createAssistantMessage(id: string, completed?: number): Message {
  return {
    id,
    role: "assistant",
    content: "test response",
    timestamp: new Date(),
    opencodeMessage: {
      id,
      sessionID: "session_test",
      role: "assistant",
      time: {
        created: Date.now(),
        ...(completed !== undefined && { completed }),
      },
      parentID: "msg_user",
      modelID: "test-model",
      providerID: "test-provider",
      mode: "test",
      agent: "test",
      cost: 0,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      path: { cwd: "/", root: "/" },
    } as AssistantMessage,
  };
}

describe("findPendingAssistantId", () => {
  it("returns undefined when no messages", () => {
    expect(findPendingAssistantId([])).toBeUndefined();
  });

  it("returns undefined when only user messages", () => {
    const messages = [createUserMessage("msg_001"), createUserMessage("msg_002")];
    expect(findPendingAssistantId(messages)).toBeUndefined();
  });

  it("returns undefined when all assistant messages are completed", () => {
    const messages = [
      createUserMessage("msg_003"),
      createAssistantMessage("msg_002", Date.now()),
      createUserMessage("msg_001"),
    ];
    expect(findPendingAssistantId(messages)).toBeUndefined();
  });

  it("returns the ID of an incomplete assistant message", () => {
    const messages = [
      createUserMessage("msg_003"),
      createAssistantMessage("msg_002"), // No completed timestamp
      createUserMessage("msg_001"),
    ];
    expect(findPendingAssistantId(messages)).toBe("msg_002");
  });

  it("returns the first (newest) incomplete assistant message when multiple exist", () => {
    // Messages are newest-first
    const messages = [
      createAssistantMessage("msg_004"), // Incomplete
      createUserMessage("msg_003"),
      createAssistantMessage("msg_002"), // Also incomplete
      createUserMessage("msg_001"),
    ];
    expect(findPendingAssistantId(messages)).toBe("msg_004");
  });

  it("ignores completed assistant messages and finds incomplete one", () => {
    const messages = [
      createAssistantMessage("msg_004", Date.now()), // Completed
      createUserMessage("msg_003"),
      createAssistantMessage("msg_002"), // Incomplete
      createUserMessage("msg_001"),
    ];
    expect(findPendingAssistantId(messages)).toBe("msg_002");
  });
});

describe("isMessageQueued", () => {
  it("returns false when no pending assistant message", () => {
    const userMsg = createUserMessage("msg_003");
    expect(isMessageQueued(userMsg, undefined)).toBe(false);
  });

  it("returns false for assistant messages", () => {
    const assistantMsg = createAssistantMessage("msg_003");
    expect(isMessageQueued(assistantMsg, "msg_002")).toBe(false);
  });

  it("returns false for user message with ID less than pending assistant", () => {
    const userMsg = createUserMessage("msg_001");
    expect(isMessageQueued(userMsg, "msg_002")).toBe(false);
  });

  it("returns false for user message with same ID as pending assistant", () => {
    const userMsg = createUserMessage("msg_002");
    expect(isMessageQueued(userMsg, "msg_002")).toBe(false);
  });

  it("returns true for user message with ID greater than pending assistant", () => {
    const userMsg = createUserMessage("msg_003");
    expect(isMessageQueued(userMsg, "msg_002")).toBe(true);
  });

  it("handles lexicographic ID comparison correctly", () => {
    // Typical OpenCode IDs are lexicographically comparable
    const userMsgEarlier = createUserMessage("msg_aaa");
    const userMsgLater = createUserMessage("msg_bbb");

    expect(isMessageQueued(userMsgEarlier, "msg_aab")).toBe(false);
    expect(isMessageQueued(userMsgLater, "msg_aab")).toBe(true);
  });
});

describe("integration: queue detection flow", () => {
  it("correctly identifies queued messages in a typical conversation", () => {
    // Scenario: User sends message, assistant starts responding, user sends another message
    const queuedUserMsg = createUserMessage("msg_004"); // This should be queued
    const pendingAssistantMsg = createAssistantMessage("msg_003"); // Still processing (no completed)
    const earlierUserMsg = createUserMessage("msg_002");
    const completedAssistantMsg = createAssistantMessage("msg_001", Date.now()); // Completed

    const messages = [queuedUserMsg, pendingAssistantMsg, earlierUserMsg, completedAssistantMsg];

    const pendingId = findPendingAssistantId(messages);
    expect(pendingId).toBe("msg_003");

    // User message before the pending assistant - not queued
    expect(isMessageQueued(earlierUserMsg, pendingId)).toBe(false);

    // User message after the pending assistant - queued
    expect(isMessageQueued(queuedUserMsg, pendingId)).toBe(true);

    // Assistant messages are never queued
    expect(isMessageQueued(pendingAssistantMsg, pendingId)).toBe(false);
    expect(isMessageQueued(completedAssistantMsg, pendingId)).toBe(false);
  });

  it("no messages are queued when assistant completes", () => {
    // All assistant messages completed
    const userMsg1 = createUserMessage("msg_004");
    const assistantMsg1 = createAssistantMessage("msg_003", Date.now()); // Completed
    const userMsg2 = createUserMessage("msg_002");
    const assistantMsg2 = createAssistantMessage("msg_001", Date.now()); // Completed

    const messages = [userMsg1, assistantMsg1, userMsg2, assistantMsg2];

    const pendingId = findPendingAssistantId(messages);
    expect(pendingId).toBeUndefined();

    // No messages should be queued
    expect(isMessageQueued(userMsg1, pendingId)).toBe(false);
    expect(isMessageQueued(userMsg2, pendingId)).toBe(false);
  });
});
