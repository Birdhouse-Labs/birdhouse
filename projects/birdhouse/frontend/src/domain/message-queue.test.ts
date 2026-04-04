// ABOUTME: Tests for message queue detection utilities
// ABOUTME: Validates logic for detecting queued user messages

import { describe, expect, it } from "vitest";
import type { BirdhouseAssistantMessageInfo, BirdhouseUserMessageInfo } from "../../../server/src/harness/types";
import type { Message } from "../types/messages";
import { findPendingAssistant, isMessageQueued } from "./message-queue";

/**
 * Helper to create a mock user message
 */
function createUserMessage(id: string): Message {
  return {
    id,
    role: "user",
    content: "test message",
    timestamp: new Date(),
    messageInfo: {
      id,
      sessionID: "session_test",
      role: "user",
      time: { created: Date.now() },
      agent: "test",
      model: { providerID: "test", modelID: "test" },
    } as BirdhouseUserMessageInfo,
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
    messageInfo: {
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
    } as BirdhouseAssistantMessageInfo,
  };
}

describe("findPendingAssistant", () => {
  it("returns undefined when no messages", () => {
    expect(findPendingAssistant([])).toBeUndefined();
  });

  it("returns undefined when only user messages", () => {
    const messages = [createUserMessage("msg_001"), createUserMessage("msg_002")];
    expect(findPendingAssistant(messages)).toBeUndefined();
  });

  it("returns undefined when all assistant messages are completed", () => {
    const messages = [
      createUserMessage("msg_003"),
      createAssistantMessage("msg_002", Date.now()),
      createUserMessage("msg_001"),
    ];
    expect(findPendingAssistant(messages)).toBeUndefined();
  });

  it("returns the ID of an incomplete assistant message", () => {
    const messages = [
      createUserMessage("msg_003"),
      createAssistantMessage("msg_002"), // No completed timestamp
      createUserMessage("msg_001"),
    ];
    expect(findPendingAssistant(messages)?.id).toBe("msg_002");
  });

  it("returns the first (newest) incomplete assistant message when multiple exist", () => {
    // Messages are newest-first
    const messages = [
      createAssistantMessage("msg_004"), // Incomplete
      createUserMessage("msg_003"),
      createAssistantMessage("msg_002"), // Also incomplete
      createUserMessage("msg_001"),
    ];
    expect(findPendingAssistant(messages)?.id).toBe("msg_004");
  });

  it("ignores older completed assistant messages and finds the latest incomplete one", () => {
    const messages = [
      createUserMessage("msg_004"),
      createAssistantMessage("msg_003"), // Latest assistant incomplete
      createUserMessage("msg_002"),
      createAssistantMessage("msg_001", Date.now()), // Older completed assistant
    ];

    expect(findPendingAssistant(messages)?.id).toBe("msg_003");
  });

  it("returns undefined when the latest assistant is completed even if an older one is incomplete", () => {
    const messages = [
      createAssistantMessage("msg_004", Date.now()), // Latest assistant completed
      createUserMessage("msg_003"),
      createAssistantMessage("msg_002"), // Older incomplete assistant is stale
      createUserMessage("msg_001"),
    ];

    expect(findPendingAssistant(messages)).toBeUndefined();
  });
});

describe("isMessageQueued", () => {
  it("returns false when no pending assistant message", () => {
    const userMsg = createUserMessage("msg_003");
    expect(isMessageQueued(userMsg, undefined)).toBe(false);
  });

  it("returns false for assistant messages", () => {
    const assistantMsg = createAssistantMessage("msg_003");
    expect(isMessageQueued(assistantMsg, createAssistantMessage("msg_002"))).toBe(false);
  });

  it("returns false for user message created before pending assistant", () => {
    const pendingAssistant = createAssistantMessage("msg_002");
    pendingAssistant.timestamp = new Date("2024-01-01T00:01:00.000Z");

    const userMsg = createUserMessage("msg_001");
    userMsg.timestamp = new Date("2024-01-01T00:00:00.000Z");

    expect(isMessageQueued(userMsg, pendingAssistant)).toBe(false);
  });

  it("returns false for user message created at the same time as pending assistant", () => {
    const pendingAssistant = createAssistantMessage("msg_002");
    pendingAssistant.timestamp = new Date("2024-01-01T00:01:00.000Z");

    const userMsg = createUserMessage("msg_002");
    userMsg.timestamp = new Date("2024-01-01T00:01:00.000Z");

    expect(isMessageQueued(userMsg, pendingAssistant)).toBe(false);
  });

  it("returns true for user message created after pending assistant", () => {
    const pendingAssistant = createAssistantMessage("msg_002");
    pendingAssistant.timestamp = new Date("2024-01-01T00:01:00.000Z");

    const userMsg = createUserMessage("msg_003");
    userMsg.timestamp = new Date("2024-01-01T00:02:00.000Z");

    expect(isMessageQueued(userMsg, pendingAssistant)).toBe(true);
  });

  it("uses timestamps rather than message ID ordering", () => {
    const pendingAssistant = createAssistantMessage("msg_zzz");
    pendingAssistant.timestamp = new Date("2024-01-01T00:01:00.000Z");

    const userMsgEarlier = createUserMessage("msg_later_lexicographically");
    userMsgEarlier.timestamp = new Date("2024-01-01T00:00:00.000Z");

    const userMsgLater = createUserMessage("msg_earlier_lexicographically");
    userMsgLater.timestamp = new Date("2024-01-01T00:02:00.000Z");

    expect(isMessageQueued(userMsgEarlier, pendingAssistant)).toBe(false);
    expect(isMessageQueued(userMsgLater, pendingAssistant)).toBe(true);
  });
});

describe("integration: queue detection flow", () => {
  it("correctly identifies queued messages in a typical conversation", () => {
    // Scenario: User sends message, assistant starts responding, user sends another message
    const queuedUserMsg = createUserMessage("msg_004"); // This should be queued
    queuedUserMsg.timestamp = new Date("2024-01-01T00:03:00.000Z");
    const pendingAssistantMsg = createAssistantMessage("msg_003"); // Still processing (no completed)
    pendingAssistantMsg.timestamp = new Date("2024-01-01T00:02:00.000Z");
    const earlierUserMsg = createUserMessage("msg_002");
    earlierUserMsg.timestamp = new Date("2024-01-01T00:01:00.000Z");
    const completedAssistantMsg = createAssistantMessage("msg_001", Date.now()); // Completed
    completedAssistantMsg.timestamp = new Date("2024-01-01T00:00:00.000Z");

    const messages = [queuedUserMsg, pendingAssistantMsg, earlierUserMsg, completedAssistantMsg];

    const pendingAssistant = findPendingAssistant(messages);
    expect(pendingAssistant?.id).toBe("msg_003");

    // User message before the pending assistant - not queued
    expect(isMessageQueued(earlierUserMsg, pendingAssistant)).toBe(false);

    // User message after the pending assistant - queued
    expect(isMessageQueued(queuedUserMsg, pendingAssistant)).toBe(true);

    // Assistant messages are never queued
    expect(isMessageQueued(pendingAssistantMsg, pendingAssistant)).toBe(false);
    expect(isMessageQueued(completedAssistantMsg, pendingAssistant)).toBe(false);
  });

  it("no messages are queued when assistant completes", () => {
    // All assistant messages completed
    const userMsg1 = createUserMessage("msg_004");
    const assistantMsg1 = createAssistantMessage("msg_003", Date.now()); // Completed
    const userMsg2 = createUserMessage("msg_002");
    const assistantMsg2 = createAssistantMessage("msg_001", Date.now()); // Completed

    const messages = [userMsg1, assistantMsg1, userMsg2, assistantMsg2];

    const pendingAssistant = findPendingAssistant(messages);
    expect(pendingAssistant).toBeUndefined();

    // No messages should be queued
    expect(isMessageQueued(userMsg1, pendingAssistant)).toBe(false);
    expect(isMessageQueued(userMsg2, pendingAssistant)).toBe(false);
  });
});
