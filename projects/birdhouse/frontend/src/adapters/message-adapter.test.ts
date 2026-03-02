// ABOUTME: Tests for message adapter functions
// ABOUTME: Validates server message to UI message conversion and system events

import type { AssistantMessage } from "@opencode-ai/sdk";
import { describe, expect, it } from "vitest";
import type { Message as OCMessage } from "../../../server/src/lib/opencode-client";
import type { SystemEvent, TimelineItem } from "../../../server/src/types/agent-events";
import { isAgentEventBlock, isSystemMessage } from "../types/messages";
import { mapMessage, mapMessages } from "./message-adapter";

describe("mapMessage", () => {
  it("should map a basic text message from user", () => {
    const ocMessage: OCMessage = {
      info: {
        id: "msg_user_123",
        sessionID: "ses_123",
        role: "user",
        time: { created: 1704067200000 }, // 2024-01-01 00:00:00
        agent: "test-agent",
        model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      },
      parts: [
        {
          type: "text",
          text: "Hello world",
          id: "part_1",
          sessionID: "ses_123",
          messageID: "msg_user_123",
        },
      ],
    };

    const result = mapMessage(ocMessage);

    expect(result.id).toBe("msg_user_123");
    expect(result.role).toBe("user");
    expect(result.content).toBe("Hello world");
    expect(result.blocks).toBeDefined();
    expect(result.blocks).toHaveLength(1);
    const firstBlock = result.blocks?.[0];
    if (firstBlock) {
      expect(firstBlock.type).toBe("text");
    }
    expect(result.timestamp).toEqual(new Date("2024-01-01T00:00:00.000Z"));
    expect(result.opencodeMessage).toEqual(ocMessage.info);
  });

  it("should map assistant message with model/provider", () => {
    const ocMessage: OCMessage = {
      info: {
        id: "msg_asst_456",
        sessionID: "ses_123",
        role: "assistant",
        time: { created: 1704067200000, completed: 1704067210000 },
        parentID: "msg_user_123",
        modelID: "claude-sonnet-4",
        providerID: "anthropic",
        mode: "build",
        cost: 0.01,
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
      },
      parts: [
        {
          type: "text",
          text: "Hello back!",
          id: "part_1",
          sessionID: "ses_123",
          messageID: "msg_asst_456",
        },
      ],
    };

    const result = mapMessage(ocMessage);

    expect(result.role).toBe("assistant");
    expect(result.model).toBe("claude-sonnet-4");
    expect(result.provider).toBe("anthropic");
    expect(result.opencodeMessage).toEqual(ocMessage.info);
  });

  it("should map message with multiple text parts", () => {
    const ocMessage: OCMessage = {
      info: {
        id: "msg_123",
        sessionID: "ses_123",
        role: "user",
        time: { created: 1704067200000 },
        agent: "test-agent",
        model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      },
      parts: [
        {
          type: "text",
          text: "First paragraph",
          id: "part_1",
          sessionID: "ses_123",
          messageID: "msg_123",
        },
        {
          type: "text",
          text: "Second paragraph",
          id: "part_2",
          sessionID: "ses_123",
          messageID: "msg_123",
        },
      ],
    };

    const result = mapMessage(ocMessage);

    expect(result.content).toBe("First paragraph\n\nSecond paragraph");
    expect(result.blocks).toHaveLength(2);
  });

  it("should map message with tool part", () => {
    const ocMessage: OCMessage = {
      info: {
        id: "msg_123",
        sessionID: "ses_123",
        role: "assistant",
        time: { created: 1704067200000 },
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
      },
      parts: [
        {
          type: "tool",
          callID: "call_123",
          tool: "bash",
          id: "part_1",
          sessionID: "ses_123",
          messageID: "msg_123",
          state: {
            status: "completed" as const,
            title: "Install dependencies",
            input: { command: "npm install" },
            output: "Dependencies installed",
            metadata: {},
            time: { start: 1704067200000, end: 1704067205000 },
          },
        },
      ],
    };

    const result = mapMessage(ocMessage);

    expect(result.blocks).toBeDefined();
    expect(result.blocks).toHaveLength(1);
    const firstBlock = result.blocks?.[0];
    if (firstBlock?.type === "tool") {
      expect(firstBlock.name).toBe("bash");
      expect(firstBlock.status).toBe("completed");
      expect(firstBlock.callID).toBe("call_123");
    }
  });

  it("should map message with reasoning part", () => {
    const ocMessage: OCMessage = {
      info: {
        id: "msg_123",
        sessionID: "ses_123",
        role: "assistant",
        time: { created: 1704067200000 },
        parentID: "msg_user_123",
        modelID: "claude-sonnet-4",
        providerID: "anthropic",
        mode: "build",
        cost: 0,
        tokens: {
          input: 100,
          output: 50,
          reasoning: 20,
          cache: { read: 0, write: 0 },
        },
        path: {
          cwd: "/",
          root: "/",
        },
      },
      parts: [
        {
          type: "reasoning",
          text: "Let me think about this...",
          id: "part_1",
          sessionID: "ses_123",
          messageID: "msg_123",
          time: { start: 1704067200000 },
        },
      ],
    };

    const result = mapMessage(ocMessage);

    expect(result.blocks).toBeDefined();
    expect(result.blocks).toHaveLength(1);
    const firstBlock = result.blocks?.[0];
    if (firstBlock?.type === "reasoning") {
      expect(firstBlock.content).toBe("Let me think about this...");
    }
  });

  it("should skip empty reasoning parts", () => {
    const ocMessage: OCMessage = {
      info: {
        id: "msg_124",
        sessionID: "ses_123",
        role: "assistant",
        time: { created: 1704067200000 },
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
      },
      parts: [
        {
          type: "reasoning",
          text: "   ",
          id: "part_2",
          sessionID: "ses_123",
          messageID: "msg_124",
          time: { start: 1704067200000 },
        },
      ],
    };

    const result = mapMessage(ocMessage);

    expect(result.blocks).toBeDefined();
    expect(result.blocks).toHaveLength(0);
  });

  it("should map message with file part", () => {
    const ocMessage: OCMessage = {
      info: {
        id: "msg_123",
        sessionID: "ses_123",
        role: "user",
        time: { created: 1704067200000 },
        agent: "test-agent",
        model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      },
      parts: [
        {
          type: "file",
          mime: "image/png",
          filename: "screenshot.png",
          url: "http://example.com/image.png",
          id: "part_1",
          sessionID: "ses_123",
          messageID: "msg_123",
        },
      ],
    };

    const result = mapMessage(ocMessage);

    expect(result.blocks).toBeDefined();
    expect(result.blocks).toHaveLength(1);
    const firstBlock = result.blocks?.[0];
    if (firstBlock?.type === "file") {
      expect(firstBlock.mimeType).toBe("image/png");
      expect(firstBlock.filename).toBe("screenshot.png");
      expect(firstBlock.url).toBe("http://example.com/image.png");
    }
  });

  it("should map assistant message with error (direct message format)", () => {
    const ocMessage: OCMessage = {
      info: {
        id: "msg_error_456",
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
            isRetryable: true,
            message: "Network timeout",
          },
        },
        path: {
          cwd: "/",
          root: "/",
        },
      },
      parts: [],
    };

    const result = mapMessage(ocMessage);

    expect((result.opencodeMessage as AssistantMessage).error).toBeDefined();
    expect((result.opencodeMessage as AssistantMessage).error?.data?.message).toBe("Network timeout");
  });
});

describe("mapMessages", () => {
  it("should map an array of messages", () => {
    const ocMessages: OCMessage[] = [
      {
        info: {
          id: "msg_1",
          sessionID: "ses_123",
          role: "user",
          time: { created: 1704067200000 },
          agent: "test-agent",
          model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
        },
        parts: [
          {
            type: "text",
            text: "Message 1",
            id: "part_1",
            sessionID: "ses_123",
            messageID: "msg_1",
          },
        ],
      },
      {
        info: {
          id: "msg_2",
          sessionID: "ses_123",
          role: "assistant",
          time: { created: 1704067210000 },
          parentID: "msg_1",
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
        },
        parts: [
          {
            type: "text",
            text: "Message 2",
            id: "part_1",
            sessionID: "ses_123",
            messageID: "msg_2",
          },
        ],
      },
    ];

    // Wrap in TimelineItem format
    const timelineItems: TimelineItem[] = ocMessages.map((msg) => ({
      item_type: "message",
      message: msg,
    }));

    const result = mapMessages(timelineItems);

    expect(result).toHaveLength(2);
    const msg1 = result[0];
    const msg2 = result[1];
    if (msg1 && msg2) {
      // Messages are sorted newest-first, so msg_2 (later timestamp) comes first
      expect(msg1.id).toBe("msg_2");
      expect(msg2.id).toBe("msg_1");
    }
  });

  it("should return empty array for empty input", () => {
    const result = mapMessages([]);
    expect(result).toEqual([]);
  });
});

describe("mapMessage - metadata", () => {
  it("should preserve metadata from text parts", () => {
    const ocMessage: OCMessage = {
      info: {
        id: "msg_with_metadata",
        sessionID: "ses_123",
        role: "user",
        time: { created: 1704067200000 },
        agent: "test-agent",
        model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      },
      parts: [
        {
          type: "text",
          text: "Message from agent",
          id: "part_1",
          sessionID: "ses_123",
          messageID: "msg_with_metadata",
          metadata: {
            sent_by_agent_id: "agent_sender_123",
            sent_by_agent_title: "Sender Agent",
          },
        },
      ],
    };

    const result = mapMessage(ocMessage);

    expect(result.blocks).toBeDefined();
    expect(result.blocks).toHaveLength(1);
    const textBlock = result.blocks?.[0];
    if (textBlock && textBlock.type === "text") {
      expect(textBlock.metadata).toBeDefined();
      expect(textBlock.metadata?.sent_by_agent_id).toBe("agent_sender_123");
      expect(textBlock.metadata?.sent_by_agent_title).toBe("Sender Agent");
    }
  });
});

describe("mapMessages with TimelineItems", () => {
  it("should map system event to message with AgentEventBlock", () => {
    const systemEvent: SystemEvent = {
      id: "evt_123",
      event_type: "clone_created",
      timestamp: 1704067200000, // 2024-01-01 00:00:00
      actor_agent_id: null, // Human-initiated
      actor_agent_title: "",
      source_agent_id: "agent_123",
      source_agent_title: "Source Agent",
      target_agent_id: "agent_456",
      target_agent_title: "Child Agent",
      metadata: { test: "data" },
    };

    const timelineItem: TimelineItem = {
      item_type: "event",
      event: systemEvent,
    };

    const result = mapMessages([timelineItem]);

    expect(result).toHaveLength(1);
    const message = result[0];
    expect(message).toBeDefined();

    expect(message?.id).toBe("evt_123");
    expect(message?.role).toBe("system");
    expect(message?.opencodeMessage).toBeUndefined();
    expect(message?.content).toBe("");
    expect(message?.timestamp).toEqual(new Date("2024-01-01T00:00:00.000Z"));

    expect(message?.blocks).toHaveLength(1);
    const eventBlock = message?.blocks?.[0];
    expect(eventBlock).toBeDefined();
    if (eventBlock && isAgentEventBlock(eventBlock)) {
      expect(eventBlock.type).toBe("agent_event");
      expect(eventBlock.event_type).toBe("clone_created");
      expect(eventBlock.actor_agent_id).toBeNull();
      expect(eventBlock.source_agent_id).toBe("agent_123");
      expect(eventBlock.target_agent_id).toBe("agent_456");
      expect(eventBlock.target_agent_title).toBe("Child Agent");
      expect(eventBlock.timestamp).toBe(1704067200000);
      expect(eventBlock.metadata).toEqual({ test: "data" });
    }
  });

  it("should handle system event with null agent IDs (deleted agents)", () => {
    const systemEvent: SystemEvent = {
      id: "evt_deleted",
      event_type: "clone_created",
      timestamp: 1704067200000,
      actor_agent_id: null, // Human or deleted
      actor_agent_title: "",
      source_agent_id: null, // Agent was deleted
      source_agent_title: "Deleted Source",
      target_agent_id: null, // Agent was deleted
      target_agent_title: "Deleted Target",
    };

    const timelineItem: TimelineItem = {
      item_type: "event",
      event: systemEvent,
    };

    const result = mapMessages([timelineItem]);
    const message = result[0];
    expect(message).toBeDefined();

    expect(message?.blocks).toHaveLength(1);
    const eventBlock = message?.blocks?.[0];
    if (eventBlock && isAgentEventBlock(eventBlock)) {
      expect(eventBlock.source_agent_id).toBeNull();
      expect(eventBlock.source_agent_title).toBe("Deleted Source");
      expect(eventBlock.target_agent_id).toBeNull();
      expect(eventBlock.target_agent_title).toBe("Deleted Target");
    }
  });

  it("should map mixed timeline items (events + messages) and sort correctly", () => {
    const message1: OCMessage = {
      info: {
        id: "msg_1",
        sessionID: "ses_123",
        role: "user",
        time: { created: 1704067200000 }, // Earlier
        agent: "test-agent",
        model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      },
      parts: [
        {
          type: "text",
          text: "First message",
          id: "part_1",
          sessionID: "ses_123",
          messageID: "msg_1",
        },
      ],
    };

    const event1: SystemEvent = {
      id: "evt_1",
      event_type: "clone_created",
      timestamp: 1704067300000, // Later
      actor_agent_id: null,
      actor_agent_title: "",
      source_agent_id: "agent_123",
      source_agent_title: "Source",
      target_agent_id: "agent_456",
      target_agent_title: "Clone",
    };

    const message2: OCMessage = {
      info: {
        id: "msg_2",
        sessionID: "ses_123",
        role: "assistant",
        time: { created: 1704067400000, completed: 1704067410000 }, // Latest
        parentID: "msg_1",
        modelID: "claude-sonnet-4",
        providerID: "anthropic",
        mode: "build",
        cost: 0.01,
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
      },
      parts: [
        {
          type: "text",
          text: "Response",
          id: "part_2",
          sessionID: "ses_123",
          messageID: "msg_2",
        },
      ],
    };

    const timelineItems: TimelineItem[] = [
      { item_type: "message", message: message1 },
      { item_type: "event", event: event1 },
      { item_type: "message", message: message2 },
    ];

    const result = mapMessages(timelineItems);

    // Should be reversed (newest-at-top)
    expect(result).toHaveLength(3);
    expect(result[0]).toBeDefined();
    expect(result[1]).toBeDefined();
    expect(result[2]).toBeDefined();
    expect(result[0]?.id).toBe("msg_2"); // Latest (assistant)
    expect(result[1]?.id).toBe("evt_1"); // Middle (event)
    expect(result[2]?.id).toBe("msg_1"); // Earliest (user)

    // Verify system message detection
    if (result[0] && result[1] && result[2]) {
      expect(isSystemMessage(result[1])).toBe(true);
      expect(isSystemMessage(result[0])).toBe(false);
      expect(isSystemMessage(result[2])).toBe(false);
    }
  });

  it("should handle clone_created event type", () => {
    const systemEvent: SystemEvent = {
      id: "evt_test",
      event_type: "clone_created",
      timestamp: 1704067200000,
      actor_agent_id: "agent_actor",
      actor_agent_title: "Actor Agent",
      source_agent_id: "agent_source",
      source_agent_title: "Source Agent",
      target_agent_id: "agent_target",
      target_agent_title: "Target Agent",
    };

    const timelineItem: TimelineItem = {
      item_type: "event",
      event: systemEvent,
    };

    const result = mapMessages([timelineItem]);
    const message = result[0];
    expect(message).toBeDefined();
    const eventBlock = message?.blocks?.[0];

    if (eventBlock && isAgentEventBlock(eventBlock)) {
      expect(eventBlock.event_type).toBe("clone_created");
      expect(eventBlock.actor_agent_id).toBe("agent_actor");
      expect(eventBlock.source_agent_id).toBe("agent_source");
      expect(eventBlock.target_agent_id).toBe("agent_target");
    }
  });
});
