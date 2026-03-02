// ABOUTME: Tests for clone point detection utilities
// ABOUTME: Validates safe clone point logic for cloning agents

import { describe, expect, test } from "bun:test";
import type { Message } from "../lib/opencode-client";
import { findSafeClonePoint } from "./clone-point";

/**
 * Helper to create a mock user message
 */
function createUserMessage(id: string): Message {
  return {
    info: {
      id,
      sessionID: "session_test",
      role: "user",
      time: { created: Date.now() },
      agent: "test",
      model: { providerID: "test", modelID: "test" },
    },
    parts: [],
  } as Message;
}

/**
 * Helper to create a mock assistant message
 * @param id Message ID
 * @param finish Finish reason (undefined = incomplete/streaming)
 */
function createAssistantMessage(id: string, finish?: string): Message {
  return {
    info: {
      id,
      sessionID: "session_test",
      role: "assistant",
      time: {
        created: Date.now(),
        ...(finish && { completed: Date.now() }),
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
      ...(finish && { finish }),
    },
    parts: [],
  } as Message;
}

describe("findSafeClonePoint", () => {
  describe("empty and edge cases", () => {
    test("returns undefined for empty messages array", () => {
      expect(findSafeClonePoint([])).toBeUndefined();
    });

    test("returns user message ID when only a user message exists (no response)", () => {
      const messages = [createUserMessage("msg_001")];
      // Last user message has no response - exclude it
      expect(findSafeClonePoint(messages)).toBe("msg_001");
    });

    test("returns undefined when only a completed assistant message exists", () => {
      // Unusual case: no user messages at all
      const messages = [createAssistantMessage("msg_001", "stop")];
      expect(findSafeClonePoint(messages)).toBeUndefined();
    });
  });

  describe("single turn conversations", () => {
    test("returns undefined when last user message has completed assistant response", () => {
      const messages = [createUserMessage("msg_001"), createAssistantMessage("msg_002", "stop")];
      // Last user message (msg_001) has completed response - clone all
      expect(findSafeClonePoint(messages)).toBeUndefined();
    });

    test("returns user message ID when assistant response is streaming (no finish)", () => {
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002"), // No finish = streaming
      ];
      // Last user message (msg_001) has incomplete response - exclude it
      expect(findSafeClonePoint(messages)).toBe("msg_001");
    });

    test("returns user message ID when assistant response has tool-calls finish", () => {
      const messages = [createUserMessage("msg_001"), createAssistantMessage("msg_002", "tool-calls")];
      // Last user message (msg_001) has incomplete response - exclude it
      expect(findSafeClonePoint(messages)).toBe("msg_001");
    });

    test("returns user message ID when assistant response has unknown finish", () => {
      const messages = [createUserMessage("msg_001"), createAssistantMessage("msg_002", "unknown")];
      // Last user message (msg_001) has incomplete response - exclude it
      expect(findSafeClonePoint(messages)).toBe("msg_001");
    });
  });

  describe("multi-turn conversations", () => {
    test("returns undefined when last user message has completed response", () => {
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002", "stop"),
        createUserMessage("msg_003"),
        createAssistantMessage("msg_004", "stop"),
      ];
      // Last user message (msg_003) has completed response - clone all
      expect(findSafeClonePoint(messages)).toBeUndefined();
    });

    test("returns last user message ID when last assistant is streaming", () => {
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002", "stop"),
        createUserMessage("msg_003"),
        createAssistantMessage("msg_004"), // No finish = streaming
      ];
      // Last user message (msg_003) has incomplete response - exclude it
      expect(findSafeClonePoint(messages)).toBe("msg_003");
    });

    test("returns last user message ID when last assistant has tool-calls", () => {
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002", "stop"),
        createUserMessage("msg_003"),
        createAssistantMessage("msg_004", "tool-calls"),
      ];
      // Last user message (msg_003) has incomplete response - exclude it
      expect(findSafeClonePoint(messages)).toBe("msg_003");
    });

    test("ignores earlier incomplete turns, only checks last user message", () => {
      // Even though msg_001's turn is incomplete, we only care about the LAST user message
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002"), // Incomplete (shouldn't matter)
        createUserMessage("msg_003"),
        createAssistantMessage("msg_004", "stop"), // Complete
      ];
      // Last user message (msg_003) has completed response - clone all
      expect(findSafeClonePoint(messages)).toBeUndefined();
    });

    test("returns last user message ID when it has no response yet", () => {
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002", "stop"),
        createUserMessage("msg_003"), // No response yet
      ];
      // Last user message (msg_003) has no response - exclude it
      expect(findSafeClonePoint(messages)).toBe("msg_003");
    });
  });

  describe("various finish reasons", () => {
    test("treats end_turn as complete", () => {
      const messages = [createUserMessage("msg_001"), createAssistantMessage("msg_002", "end_turn")];
      expect(findSafeClonePoint(messages)).toBeUndefined();
    });

    test("treats stop as complete", () => {
      const messages = [createUserMessage("msg_001"), createAssistantMessage("msg_002", "stop")];
      expect(findSafeClonePoint(messages)).toBeUndefined();
    });

    test("treats max_tokens as complete", () => {
      const messages = [createUserMessage("msg_001"), createAssistantMessage("msg_002", "max_tokens")];
      expect(findSafeClonePoint(messages)).toBeUndefined();
    });
  });

  describe("multi-message turns with tool calls", () => {
    test("treats last turn as complete when tool-calls is followed by stop", () => {
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002", "tool-calls"), // Calls tools
        createAssistantMessage("msg_003", "stop"), // Processes results and responds
      ];
      // Last user message (msg_001) has completed response - clone all
      expect(findSafeClonePoint(messages)).toBeUndefined();
    });

    test("treats last turn as complete with multiple tool-calls followed by stop", () => {
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002", "tool-calls"), // First tool batch
        createAssistantMessage("msg_003", "tool-calls"), // Second tool batch
        createAssistantMessage("msg_004", "tool-calls"), // Third tool batch
        createAssistantMessage("msg_005", "stop"), // Final response
      ];
      // Last user message (msg_001) has completed response - clone all
      expect(findSafeClonePoint(messages)).toBeUndefined();
    });

    test("returns user ID when last turn has tool-calls but no final finish", () => {
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002", "tool-calls"), // Called tools
        // No final assistant message yet
      ];
      // Last user message (msg_001) has incomplete response - exclude it
      expect(findSafeClonePoint(messages)).toBe("msg_001");
    });

    test("returns user ID when last turn has tool-calls but is still streaming final response", () => {
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002", "tool-calls"), // Called tools
        createAssistantMessage("msg_003"), // Streaming (no finish)
      ];
      // Last user message (msg_001) has incomplete response - exclude it
      expect(findSafeClonePoint(messages)).toBe("msg_001");
    });

    test("returns last user message ID when user interrupts with new message", () => {
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002", "tool-calls"), // Started tools
        createUserMessage("msg_003"), // User interrupted with new message
      ];
      // Last user message (msg_003) has no response - exclude it
      expect(findSafeClonePoint(messages)).toBe("msg_003");
    });

    test("only checks last user message, ignores earlier incomplete turns", () => {
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002", "tool-calls"), // Earlier incomplete turn
        createUserMessage("msg_004"),
        createAssistantMessage("msg_005", "tool-calls"),
        createAssistantMessage("msg_006", "stop"), // Last turn complete
      ];
      // Last user message (msg_004) has completed response - clone all
      expect(findSafeClonePoint(messages)).toBeUndefined();
    });

    test("handles mixed finish reasons in last turn", () => {
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002", "tool-calls"),
        createAssistantMessage("msg_003", "unknown"), // Transient state
        createAssistantMessage("msg_004", "tool-calls"),
        createAssistantMessage("msg_005", "stop"), // Final completion
      ];
      // Last user message (msg_001) has completed response - clone all
      expect(findSafeClonePoint(messages)).toBeUndefined();
    });

    test("returns user ID when last turn ends with unknown instead of completion", () => {
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002", "tool-calls"),
        createAssistantMessage("msg_003", "unknown"), // Stuck in unknown state
      ];
      // Last user message (msg_001) has incomplete response - exclude it
      expect(findSafeClonePoint(messages)).toBe("msg_001");
    });
  });

  describe("real-world scenario: clone & send while busy", () => {
    test("finds correct clone point for clone & send during active work", () => {
      // User is viewing an agent that's working on "add tests"
      // They want to clone and send a different request
      const messages = [
        createUserMessage("msg_001"), // "Help me debug this"
        createAssistantMessage("msg_002", "stop"), // "Here's the fix..."
        createUserMessage("msg_003"), // "Now add tests"
        createAssistantMessage("msg_004"), // Still working on tests...
      ];

      // Last user message (msg_003) has incomplete response - exclude it
      // Clone will have msg_001 + msg_002 (the completed debug conversation)
      expect(findSafeClonePoint(messages)).toBe("msg_003");
    });

    test("returns undefined for idle agent (all work complete)", () => {
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002", "stop"),
        createUserMessage("msg_003"),
        createAssistantMessage("msg_004", "stop"),
      ];

      // Last user message (msg_003) has completed response - clone all
      expect(findSafeClonePoint(messages)).toBeUndefined();
    });

    test("handles real-world tool usage scenario from logs", () => {
      // Based on actual log data showing tool-calls followed by stop
      const messages = [
        createUserMessage("msg_001"),
        createAssistantMessage("msg_002", "stop"),
        createUserMessage("msg_003"),
        createAssistantMessage("msg_004", "tool-calls"), // Calls tools
        createAssistantMessage("msg_005", "stop"), // Completes turn
        createUserMessage("msg_006"),
        // ... more completed turns ...
        createAssistantMessage("msg_014", "stop"),
        createUserMessage("msg_015"),
        createAssistantMessage("msg_016"), // Still streaming (undefined finish)
      ];

      // Last user message (msg_015) has incomplete response - exclude it
      expect(findSafeClonePoint(messages)).toBe("msg_015");
    });
  });
});
