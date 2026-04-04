// ABOUTME: Tests for message filtering in AAPI
// ABOUTME: Validates error field is preserved in filtered messages

import { describe, expect, it } from "bun:test";
import type { BirdhouseAssistantMessageInfo as AssistantMessage, BirdhouseMessage as Message } from "../../../harness";
import { filterMessage } from "./message-filter";

function asMessage(message: unknown): Message {
  return message as Message;
}

describe("filterMessage", () => {
  it("should preserve error field with data.message format", () => {
    const message = asMessage({
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
    });

    const result = filterMessage(message);

    expect(result.info.error).toBeDefined();
    expect(result.info.error?.name).toBe("UnknownError");
    expect(result.info.error?.data?.message).toBe("Error: Unable to connect. Is the computer able to access the url?");
  });

  it("should preserve error field with direct message format", () => {
    const message = asMessage({
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
    });

    const result = filterMessage(message);

    expect(result.info.error).toBeDefined();
    expect(result.info.error?.name).toBe("APIError");
    expect(result.info.error?.data?.message).toBe("Network timeout");
  });

  it("should not include error field when not present", () => {
    const message = asMessage({
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
    });

    const result = filterMessage(message);

    expect(result.info.error).toBeUndefined();
  });

  it("should filter out cost and tokens while preserving error", () => {
    const message = asMessage({
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
    });

    const result = filterMessage(message);

    // Error should be preserved
    expect(result.info.error).toBeDefined();
    expect(result.info.error?.name).toBe("APIError");

    // Cost and tokens should be filtered out
    expect("cost" in result.info).toBe(false);
    expect("tokens" in result.info).toBe(false);
  });

  it("full view strips reasoning, patches, and noisy tool details", () => {
    const message = asMessage({
      info: {
        id: "msg_full_bash",
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
        path: {
          cwd: "/",
          root: "/",
        },
        finish: "tool-calls",
      } as AssistantMessage,
      parts: [
        { type: "step-start" } as never,
        { type: "reasoning", text: "Thinking very hard" } as never,
        {
          type: "tool",
          tool: "bash",
          callID: "call_123",
          state: {
            status: "completed",
            input: {
              command: "git status --short",
              description: "Check git status",
            },
            output: "M src/file.ts\n",
            title: "Run status",
            time: { start: 1, end: 2 },
            metadata: { exit: 0 },
          },
        } as never,
        { type: "patch", text: "*** Begin Patch" } as never,
        { type: "step-finish", reason: "stop" } as never,
      ],
    });

    const result = filterMessage(message, "full");

    expect(result.parts).toEqual([
      {
        type: "tool",
        callID: "call_123",
        tool: "bash",
        summary: "Check git status",
        state: {
          status: "completed",
          title: "Run status",
          input: {
            description: "Check git status",
          },
          output: "M src/file.ts\n",
          outputTruncated: false,
        },
      },
    ]);
  });

  it("full view keeps compact agent tool input and drops verbose prompt text", () => {
    const message = asMessage({
      info: {
        id: "msg_full_agent_create",
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
        finish: "tool-calls",
      } as AssistantMessage,
      parts: [
        {
          type: "tool",
          tool: "agent_create",
          state: {
            status: "completed",
            input: {
              title: "Secrets investigation",
              prompt: "A very long prompt that should not be included in full mode.",
            },
            output: "created",
          },
        } as never,
      ],
    });

    const result = filterMessage(message, "full");

    expect(result.parts).toEqual([
      {
        type: "tool",
        tool: "agent_create",
        summary: "Create agent: Secrets investigation",
        state: {
          status: "completed",
          input: {
            title: "Secrets investigation",
          },
          output: "created",
          outputTruncated: false,
        },
      },
    ]);
  });

  it("full view summarizes agent_read and read tool calls with drill-down ids", () => {
    const message = asMessage({
      info: {
        id: "msg_full_mixed_tools",
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
        finish: "tool-calls",
      } as AssistantMessage,
      parts: [
        {
          type: "tool",
          tool: "agent_read",
          callID: "call_read_agent",
          state: {
            status: "completed",
            input: {
              agent_id: "agent_child_123",
              latest_turn: true,
            },
            output: "Agent: agent_child_123\nMode: latest turn\nMessages: 3",
          },
        } as never,
        {
          type: "tool",
          tool: "read",
          callID: "call_read_file",
          state: {
            status: "completed",
            input: {
              filePath: "/tmp/example.ts",
              offset: 20,
              limit: 40,
            },
            output: "20: export const x = 1;\n21: export const y = 2;",
          },
        } as never,
      ],
    });

    const result = filterMessage(message, "full");

    expect(result.parts).toEqual([
      {
        type: "tool",
        callID: "call_read_agent",
        tool: "agent_read",
        summary: "Read agent agent_child_123 (latest turn)",
        state: {
          status: "completed",
          input: {
            agent_id: "agent_child_123",
            latest_turn: true,
          },
          output: "Agent: agent_child_123\nMode: latest turn\nMessages: 3",
          outputTruncated: false,
        },
      },
      {
        type: "tool",
        callID: "call_read_file",
        tool: "read",
        summary: "Read /tmp/example.ts (offset 20, limit 40)",
        state: {
          status: "completed",
          input: {
            filePath: "/tmp/example.ts",
            offset: 20,
            limit: 40,
          },
          output: "20: export const x = 1;\n21: export const y = 2;",
          outputTruncated: false,
        },
      },
    ]);
  });

  it("full view marks large tool output as truncated", () => {
    const longOutput = "0123456789".repeat(60);
    const message = asMessage({
      info: {
        id: "msg_large_output",
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
        finish: "tool-calls",
      } as AssistantMessage,
      parts: [
        {
          type: "tool",
          tool: "bash",
          callID: "call_long_output",
          state: {
            status: "completed",
            input: {
              description: "Show huge output",
            },
            output: longOutput,
          },
        } as never,
      ],
    });

    const result = filterMessage(message, "full");
    const toolState = result.parts[0]?.state as Record<string, unknown>;

    expect(toolState.outputTruncated).toBe(true);
    expect(typeof toolState.output).toBe("string");
    expect((toolState.output as string).length).toBeLessThan(longOutput.length);
  });

  it("tool_call view preserves full filtered tool state for drill-down", () => {
    const message = asMessage({
      info: {
        id: "msg_tool_call_view",
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
        finish: "tool-calls",
      } as AssistantMessage,
      parts: [
        {
          type: "tool",
          tool: "bash",
          callID: "call_tool_view",
          state: {
            status: "completed",
            input: {
              command: "git status --short",
              description: "Check git status",
            },
            output: "M src/file.ts\n",
            time: { start: 1, end: 2 },
            metadata: { exit: 0 },
          },
        } as never,
      ],
    });

    const result = filterMessage(message, "tool_call");

    expect(result.parts).toEqual([
      {
        type: "tool",
        callID: "call_tool_view",
        tool: "bash",
        state: {
          status: "completed",
          input: {
            command: "git status --short",
            description: "Check git status",
          },
          output: "M src/file.ts\n",
          time: { start: 1, end: 2 },
        },
      },
    ]);
  });

  it("full view strips verbose diff bodies from user message summaries", () => {
    const message = asMessage({
      info: {
        id: "msg_user_summary",
        sessionID: "ses_123",
        role: "user",
        time: { created: 1704067200000 },
        model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
        summary: {
          diffs: [
            {
              file: "src/example.ts",
              before: "before contents that should be removed",
              after: "after contents that should be removed",
              additions: 12,
              deletions: 4,
              status: "modified",
            },
          ],
        },
      } as never,
      parts: [
        {
          type: "text",
          text: "Please review this change",
          id: "part_1",
          sessionID: "ses_123",
          messageID: "msg_user_summary",
        },
      ],
    });

    const result = filterMessage(message, "full");

    expect(result.info.summary).toEqual({
      diffs: [
        {
          file: "src/example.ts",
          status: "modified",
          additions: 12,
          deletions: 4,
        },
      ],
    });
  });

  it("latest exchange view keeps bash command while using compact tool filtering", () => {
    const longOutput = "0123456789".repeat(60);
    const message = asMessage({
      info: {
        id: "msg_latest_exchange",
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
        finish: "tool-calls",
      } as AssistantMessage,
      parts: [
        { type: "reasoning", text: "internal thoughts" } as never,
        {
          type: "tool",
          tool: "bash",
          callID: "call_latest_bash",
          state: {
            status: "completed",
            input: {
              command: "git status --short",
              workdir: "/repo",
              description: "Shows concise repo status",
            },
            output: longOutput,
            title: "Shows concise repo status",
          },
        } as never,
      ],
    });

    const result = filterMessage(message, "exchange");

    expect(result.parts).toEqual([
      {
        type: "tool",
        callID: "call_latest_bash",
        tool: "bash",
        summary: "Shows concise repo status",
        state: {
          status: "completed",
          title: "Shows concise repo status",
          input: {
            command: "git status --short",
            workdir: "/repo",
            description: "Shows concise repo status",
          },
          output: expect.any(String),
          outputTruncated: true,
        },
      },
    ]);
  });
});
