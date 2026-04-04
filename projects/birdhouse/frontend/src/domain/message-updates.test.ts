// ABOUTME: Tests for streaming part updates with race condition scenarios
// ABOUTME: Validates deduplication logic when rapid events arrive

import { createStore } from "solid-js/store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BirdhouseAssistantMessageInfo, BirdhouseUserMessageInfo } from "../../../server/src/harness/types";
import type { Message, TextBlock, ToolBlock } from "../types/messages";
import { handlePartDelta, handlePartUpdate, type StreamingPart, type StreamingPartDelta } from "./message-updates";

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
      sessionID: "session_test",
      role: "user",
      time: { created: Date.now() },
    } as BirdhouseUserMessageInfo;
  }
  return {
    id,
    sessionID: "session_test",
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

describe("handlePartUpdate - race condition handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should deduplicate rapid tool events with same part.id", () => {
    // Setup: Create initial message
    const [messages, setMessages] = createStore<Message[]>([
      {
        id: "msg_1",
        role: "assistant",
        content: "",
        blocks: [],
        timestamp: new Date(),
        messageInfo: createMockMessageInfo("msg_1", "assistant"),
      },
    ]);

    // Event 1: tool-input-start (pending, no time, empty input)
    const event1: StreamingPart = {
      id: "part_xyz",
      sessionID: "session_1",
      messageID: "msg_1",
      type: "tool",
      callID: "call_123",
      tool: "bash",
      state: {
        status: "pending",
        input: {},
      },
      // NO time field
    };

    // Event 2: tool-call (running, with time, real input)
    const event2: StreamingPart = {
      id: "part_xyz", // SAME ID
      sessionID: "session_1",
      messageID: "msg_1",
      type: "tool",
      callID: "call_123",
      tool: "bash",
      state: {
        status: "running",
        input: { command: "ls -la" },
        title: "Lists files",
      },
      time: {
        start: Date.now(),
      },
    };

    // Simulate rapid arrival - both handlers called before state flush
    handlePartUpdate(event1, messages, setMessages);
    handlePartUpdate(event2, messages, setMessages);

    // Verify: Only ONE block exists with the correct (latest) data
    expect(messages[0]?.blocks).toHaveLength(1);
    expect(messages[0]?.blocks?.[0]?.id).toBe("part_xyz");
    const toolBlock = messages[0]?.blocks?.[0] as ToolBlock | undefined;
    expect(toolBlock?.status).toBe("running");
    expect(toolBlock?.input).toEqual({ command: "ls -la" });
  });

  it("should handle three rapid events for same part.id", () => {
    const [messages, setMessages] = createStore<Message[]>([
      {
        id: "msg_1",
        role: "assistant",
        content: "",
        blocks: [],
        timestamp: new Date(),
        messageInfo: createMockMessageInfo("msg_1", "assistant"),
      },
    ]);

    const baseTime = Date.now();

    // Event 1: pending
    const event1: StreamingPart = {
      id: "part_abc",
      sessionID: "session_1",
      messageID: "msg_1",
      type: "tool",
      callID: "call_456",
      tool: "read",
      state: { status: "pending", input: {} },
    };

    // Event 2: running
    const event2: StreamingPart = {
      id: "part_abc",
      sessionID: "session_1",
      messageID: "msg_1",
      type: "tool",
      callID: "call_456",
      tool: "read",
      state: {
        status: "running",
        input: { filePath: "/test.ts" },
      },
      time: { start: baseTime },
    };

    // Event 3: completed
    const event3: StreamingPart = {
      id: "part_abc",
      sessionID: "session_1",
      messageID: "msg_1",
      type: "tool",
      callID: "call_456",
      tool: "read",
      state: {
        status: "completed",
        input: { filePath: "/test.ts" },
        output: "file contents",
        title: "Read test.ts",
      },
      time: { start: baseTime, end: baseTime + 100 },
    };

    // Rapid fire all three
    handlePartUpdate(event1, messages, setMessages);
    handlePartUpdate(event2, messages, setMessages);
    handlePartUpdate(event3, messages, setMessages);

    // Verify: Still only ONE block with final state
    expect(messages[0]?.blocks).toHaveLength(1);
    expect(messages[0]?.blocks?.[0]?.id).toBe("part_abc");
    const toolBlock = messages[0]?.blocks?.[0] as ToolBlock | undefined;
    expect(toolBlock?.status).toBe("completed");
    expect(toolBlock?.output).toBe("file contents");
  });

  it("should handle different part IDs correctly (no false deduplication)", () => {
    const [messages, setMessages] = createStore<Message[]>([
      {
        id: "msg_1",
        role: "assistant",
        content: "",
        blocks: [],
        timestamp: new Date(),
        messageInfo: createMockMessageInfo("msg_1", "assistant"),
      },
    ]);

    // Two different tool calls
    const event1: StreamingPart = {
      id: "part_1",
      sessionID: "session_1",
      messageID: "msg_1",
      type: "tool",
      callID: "call_1",
      tool: "bash",
      state: { status: "pending", input: {} },
    };

    const event2: StreamingPart = {
      id: "part_2", // DIFFERENT ID
      sessionID: "session_1",
      messageID: "msg_1",
      type: "tool",
      callID: "call_2",
      tool: "read",
      state: { status: "pending", input: {} },
    };

    handlePartUpdate(event1, messages, setMessages);
    handlePartUpdate(event2, messages, setMessages);

    // Verify: TWO distinct blocks
    expect(messages[0]?.blocks).toHaveLength(2);
    expect(messages[0]?.blocks?.[0]?.id).toBe("part_1");
    expect(messages[0]?.blocks?.[1]?.id).toBe("part_2");
  });

  it("should update existing block via reconcile path when blockIndex found", () => {
    // Setup: Message with existing block
    const [messages, setMessages] = createStore<Message[]>([
      {
        id: "msg_1",
        role: "assistant",
        content: "",
        blocks: [
          {
            id: "part_existing",
            type: "tool",
            callID: "call_999",
            name: "bash",
            status: "running",
            input: { command: "pwd" },
          },
        ],
        timestamp: new Date(),
        messageInfo: createMockMessageInfo("msg_1", "assistant"),
      },
    ]);

    // Update to completed
    const updateEvent: StreamingPart = {
      id: "part_existing",
      sessionID: "session_1",
      messageID: "msg_1",
      type: "tool",
      callID: "call_999",
      tool: "bash",
      state: {
        status: "completed",
        input: { command: "pwd" },
        output: "/home/user",
        title: "Show directory",
      },
      time: { start: Date.now(), end: Date.now() + 50 },
    };

    handlePartUpdate(updateEvent, messages, setMessages);

    // Verify: Still one block, updated status
    expect(messages[0]?.blocks).toHaveLength(1);
    expect(messages[0]?.blocks?.[0]?.id).toBe("part_existing");
    const toolBlock = messages[0]?.blocks?.[0] as ToolBlock | undefined;
    expect(toolBlock?.status).toBe("completed");
    expect(toolBlock?.output).toBe("/home/user");
  });

  it("should maintain sort order by time when deduplicating", () => {
    const [messages, setMessages] = createStore<Message[]>([
      {
        id: "msg_1",
        role: "assistant",
        content: "",
        blocks: [],
        timestamp: new Date(),
        messageInfo: createMockMessageInfo("msg_1", "assistant"),
      },
    ]);

    const baseTime = Date.now();

    // Add first tool call with time
    const event1: StreamingPart = {
      id: "part_first",
      sessionID: "session_1",
      messageID: "msg_1",
      type: "tool",
      callID: "call_1",
      tool: "bash",
      state: {
        status: "running",
        input: { command: "first" },
      },
      time: { start: baseTime },
    };

    // Add second tool call - rapid duplicate events
    const event2a: StreamingPart = {
      id: "part_second",
      sessionID: "session_1",
      messageID: "msg_1",
      type: "tool",
      callID: "call_2",
      tool: "read",
      state: { status: "pending", input: {} },
      // No time
    };

    const event2b: StreamingPart = {
      id: "part_second", // SAME ID
      sessionID: "session_1",
      messageID: "msg_1",
      type: "tool",
      callID: "call_2",
      tool: "read",
      state: {
        status: "running",
        input: { filePath: "/test" },
      },
      time: { start: baseTime + 100 },
    };

    handlePartUpdate(event1, messages, setMessages);
    handlePartUpdate(event2a, messages, setMessages);
    handlePartUpdate(event2b, messages, setMessages);

    // Verify: Two blocks in correct time order
    expect(messages[0]?.blocks).toHaveLength(2);
    expect(messages[0]?.blocks?.[0]?.id).toBe("part_first");
    expect(messages[0]?.blocks?.[1]?.id).toBe("part_second");
    const secondBlock = messages[0]?.blocks?.[1] as ToolBlock | undefined;
    expect(secondBlock?.status).toBe("running");
  });

  it("should skip empty reasoning parts", () => {
    const [messages, setMessages] = createStore<Message[]>([
      {
        id: "msg_1",
        role: "assistant",
        content: "",
        blocks: [],
        timestamp: new Date(),
        messageInfo: createMockMessageInfo("msg_1", "assistant"),
      },
    ]);

    const event: StreamingPart = {
      id: "part_reasoning",
      sessionID: "session_1",
      messageID: "msg_1",
      type: "reasoning",
      text: "  ",
      time: { start: Date.now(), end: Date.now() + 10 },
    };

    handlePartUpdate(event, messages, setMessages);

    expect(messages[0]?.blocks).toHaveLength(0);
  });
});

describe("handlePartDelta - incremental text streaming", () => {
  it("appends delta text to an existing text block", () => {
    const [messages, setMessages] = createStore<Message[]>([
      {
        id: "msg_1",
        role: "assistant",
        content: "Hello",
        blocks: [{ id: "part_text", type: "text", content: "Hello", isStreaming: true }],
        timestamp: new Date(),
        messageInfo: createMockMessageInfo("msg_1", "assistant"),
      },
    ]);

    const delta: StreamingPartDelta = {
      sessionID: "session_1",
      messageID: "msg_1",
      partID: "part_text",
      field: "text",
      delta: ", world",
    };

    handlePartDelta(delta, messages, setMessages);

    const block = messages[0]?.blocks?.[0] as TextBlock;
    expect(block.content).toBe("Hello, world");
  });

  it("is a no-op when the message does not exist", () => {
    const [messages, setMessages] = createStore<Message[]>([]);

    const delta: StreamingPartDelta = {
      sessionID: "session_1",
      messageID: "msg_nonexistent",
      partID: "part_text",
      field: "text",
      delta: "hello",
    };

    // Should not throw
    expect(() => handlePartDelta(delta, messages, setMessages)).not.toThrow();
    expect(messages).toHaveLength(0);
  });

  it("is a no-op when the block does not exist yet", () => {
    const [messages, setMessages] = createStore<Message[]>([
      {
        id: "msg_1",
        role: "assistant",
        content: "",
        blocks: [],
        timestamp: new Date(),
        messageInfo: createMockMessageInfo("msg_1", "assistant"),
      },
    ]);

    const delta: StreamingPartDelta = {
      sessionID: "session_1",
      messageID: "msg_1",
      partID: "part_unknown",
      field: "text",
      delta: "hello",
    };

    handlePartDelta(delta, messages, setMessages);

    // Block doesn't exist yet — delta is dropped until message.part.updated creates it
    expect(messages[0]?.blocks).toHaveLength(0);
  });

  it("only applies deltas to the 'text' field (ignores other fields)", () => {
    const [messages, setMessages] = createStore<Message[]>([
      {
        id: "msg_1",
        role: "assistant",
        content: "Hello",
        blocks: [{ id: "part_text", type: "text", content: "Hello", isStreaming: true }],
        timestamp: new Date(),
        messageInfo: createMockMessageInfo("msg_1", "assistant"),
      },
    ]);

    const delta: StreamingPartDelta = {
      sessionID: "session_1",
      messageID: "msg_1",
      partID: "part_text",
      field: "someOtherField",
      delta: "ignored",
    };

    handlePartDelta(delta, messages, setMessages);

    const block = messages[0]?.blocks?.[0] as TextBlock;
    expect(block.content).toBe("Hello");
  });
});
