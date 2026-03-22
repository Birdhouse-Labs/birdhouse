// ABOUTME: Tests for Agent API routes (plugin-optimized endpoints)
// ABOUTME: Verifies message filtering removes IDs, cost, tokens, and metadata

import { beforeEach, describe, expect, test } from "bun:test";
import { createTestDeps, withDeps } from "../dependencies";
import type { FilteredMessage } from "../features/aapi/helpers/message-filter";
import { type AgentsDB, initAgentsDB } from "../lib/agents-db";
import type { Message, Session } from "../lib/opencode-client";
import { captureStreamEvents, withWorkspaceContext } from "../test-utils";
import { createRootAgent } from "../test-utils/agent-factories";
import { createAAPIAgentRoutes } from "./aapi-agents";

describe("AAPI Agent Routes", () => {
  let agentsDB: AgentsDB;

  beforeEach(async () => {
    agentsDB = await initAgentsDB(":memory:");
  });

  describe("GET /aapi/agents/:id/messages", () => {
    test("returns 404 for non-existent agent", async () => {
      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
        const response = await app.request("/agent_nonexistent/messages");

        expect(response.status).toBe(404);
        const body = (await response.json()) as { error: string };
        expect(body.error).toContain("not found");
      });
    });

    test("returns filtered messages without IDs, cost, or tokens", async () => {
      // Create test agent
      const agent = createRootAgent(agentsDB, {
        id: "agent_1",
        session_id: "ses_test_filter",
      });

      // Mock messages with all fields (including ones that should be filtered)
      const mockMessages = [
        {
          info: {
            id: "msg_should_be_removed",
            sessionID: "ses_should_be_removed",
            role: "user",
            time: { created: 123456 },
            agent: "build", // Part of OpenCode API but filtered for plugins
            model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
          },
          parts: [
            {
              id: "prt_should_be_removed",
              sessionID: "ses_should_be_removed",
              messageID: "msg_should_be_removed",
              type: "text",
              text: "Hello",
            },
          ],
        },
        {
          info: {
            id: "msg_should_be_removed_2",
            sessionID: "ses_should_be_removed",
            role: "assistant",
            time: { created: 123457, completed: 123460 },
            parentID: "msg_should_be_removed",
            modelID: "claude-sonnet-4",
            providerID: "anthropic",
            mode: "build", // Should be removed
            agent: "build", // Should be removed
            path: { cwd: "/test", root: "/" },
            cost: 0.005, // Should be removed
            tokens: {
              input: 10,
              output: 20,
              reasoning: 0,
              cache: { read: 0, write: 0 },
            }, // Should be removed
            finish: "stop",
          },
          parts: [
            {
              id: "prt_should_be_removed_2",
              sessionID: "ses_should_be_removed",
              messageID: "msg_should_be_removed_2",
              type: "text",
              text: "Hi there",
              time: { start: 123458, end: 123459 },
            },
          ],
        },
      ] as unknown as Message[];

      const deps = await createTestDeps({
        getMessages: async () => mockMessages,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
        // Use mode=all to get all messages (test filtering, not selection)
        const response = await app.request(`/${agent.id}/messages?mode=all`);

        expect(response.status).toBe(200);
        const filtered = (await response.json()) as FilteredMessage[];

        expect(Array.isArray(filtered)).toBe(true);
        expect(filtered.length).toBe(2);

        // User message checks
        expect(filtered[0].info.role).toBe("user");
        expect(filtered[0].info.time).toEqual({ created: 123456 });
        expect(filtered[0].info.model).toEqual({
          providerID: "anthropic",
          modelID: "claude-sonnet-4",
        });

        // Should NOT have IDs
        expect((filtered[0].info as unknown as Record<string, unknown>).id).toBeUndefined();
        expect((filtered[0].info as unknown as Record<string, unknown>).sessionID).toBeUndefined();
        expect((filtered[0].parts[0] as unknown as Record<string, unknown>).id).toBeUndefined();
        expect((filtered[0].parts[0] as unknown as Record<string, unknown>).sessionID).toBeUndefined();
        expect((filtered[0].parts[0] as unknown as Record<string, unknown>).messageID).toBeUndefined();

        // Assistant message checks
        expect(filtered[1].info.role).toBe("assistant");
        expect(filtered[1].info.time).toEqual({
          created: 123457,
          completed: 123460,
        });
        expect(filtered[1].info.modelID).toBe("claude-sonnet-4");
        expect(filtered[1].info.providerID).toBe("anthropic");
        expect(filtered[1].info.finish).toBe("stop");
        expect(filtered[1].info.path).toEqual({ cwd: "/test", root: "/" });

        // Should NOT have IDs, cost, tokens, mode, agent
        expect((filtered[1].info as unknown as Record<string, unknown>).id).toBeUndefined();
        expect((filtered[1].info as unknown as Record<string, unknown>).sessionID).toBeUndefined();
        expect((filtered[1].info as unknown as Record<string, unknown>).parentID).toBeUndefined();
        expect((filtered[1].info as unknown as Record<string, unknown>).cost).toBeUndefined();
        expect((filtered[1].info as unknown as Record<string, unknown>).tokens).toBeUndefined();
        expect((filtered[1].info as unknown as Record<string, unknown>).mode).toBeUndefined();
        expect((filtered[1].info as unknown as Record<string, unknown>).agent).toBeUndefined();
      });
    });

    test("filters out step-start and step-finish parts", async () => {
      const agent = createRootAgent(agentsDB, {
        id: "agent_1",
        session_id: "ses_test_steps",
        title: "Test",
      });

      const mockMessages = [
        {
          info: {
            id: "msg_1",
            sessionID: "ses_test",
            role: "assistant",
            time: { created: 1, completed: 2 },
            parentID: "msg_0",
            modelID: "claude-sonnet-4",
            providerID: "anthropic",
            mode: "build",
            cost: 0,
            tokens: {
              input: 1,
              output: 1,
              reasoning: 0,
              cache: { read: 0, write: 0 },
            },
            finish: "stop",
          }, // mode/agent will be filtered out
          parts: [
            { type: "step-start" }, // Should be removed
            { type: "text", text: "Hello" },
            { type: "step-finish", reason: "stop", cost: 0, tokens: {} }, // Should be removed
          ],
        },
      ] as unknown as Message[];

      const deps = await createTestDeps({
        getMessages: async () => mockMessages,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
        const response = await app.request(`/${agent.id}/messages`);

        const filtered = (await response.json()) as FilteredMessage[];
        expect(filtered[0].parts.length).toBe(1); // Only text part
        expect(filtered[0].parts[0].type).toBe("text");
      });
    });

    test("removes metadata from tool state but keeps input/output", async () => {
      const agent = createRootAgent(agentsDB, {
        id: "agent_1",
        session_id: "ses_test_tool",
        title: "Test",
      });

      const mockMessages = [
        {
          info: {
            id: "msg_1",
            sessionID: "ses_test",
            role: "assistant",
            time: { created: 1, completed: 2 },
            parentID: "msg_0",
            modelID: "claude-sonnet-4",
            providerID: "anthropic",
            mode: "build",
            cost: 0,
            tokens: {
              input: 1,
              output: 1,
              reasoning: 0,
              cache: { read: 0, write: 0 },
            },
            finish: "tool-calls",
          },
          parts: [
            {
              type: "tool",
              callID: "call_should_be_removed",
              tool: "bash",
              state: {
                status: "completed",
                input: { command: "echo test" },
                output: "test\n",
                title: "Run test",
                time: { start: 1, end: 2 },
                metadata: { exit: 0, description: "test" }, // Should be removed
              },
            },
          ],
        },
      ] as unknown as Message[];

      const deps = await createTestDeps({
        getMessages: async () => mockMessages,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
        const response = await app.request(`/${agent.id}/messages`);

        const filtered = (await response.json()) as FilteredMessage[];
        const toolPart = filtered[0].parts[0];
        const toolState = toolPart.state as unknown as Record<string, unknown>;

        // Should have tool state fields
        expect(toolState.status).toBe("completed");
        expect(toolState.input).toEqual({ command: "echo test" });
        expect(toolState.output).toBe("test\n");
        expect(toolState.title).toBe("Run test");
        expect(toolState.time).toEqual({ start: 1, end: 2 });

        // Should NOT have metadata or callID
        expect(toolState.metadata).toBeUndefined();
        expect((toolPart as unknown as Record<string, unknown>).callID).toBeUndefined();
      });
    });

    describe("mode parameter", () => {
      test("mode=last returns only last assistant message", async () => {
        const agent = createRootAgent(agentsDB, {
          id: "agent_mode",
          session_id: "ses_mode_test",
          title: "Mode Test",
        });

        const mockMessages = [
          {
            info: {
              id: "msg_1",
              sessionID: "ses_mode_test",
              role: "user",
              time: { created: 1 },
              agent: "build",
              model: { providerID: "anthropic", modelID: "claude" },
            },
            parts: [
              {
                type: "text",
                text: "First",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
          {
            info: {
              id: "msg_2",
              sessionID: "ses_mode_test",
              role: "assistant",
              time: { created: 2, completed: 3 },
              parentID: "msg_1",
              modelID: "claude",
              providerID: "anthropic",
              mode: "build",
              cost: 0.01,
              tokens: {
                input: 10,
                output: 20,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
              finish: "stop",
            },
            parts: [
              {
                type: "text",
                text: "Response 1",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
          {
            info: {
              id: "msg_3",
              sessionID: "ses_mode_test",
              role: "user",
              time: { created: 4 },
              agent: "build",
              model: { providerID: "anthropic", modelID: "claude" },
            },
            parts: [
              {
                type: "text",
                text: "Second",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
          {
            info: {
              id: "msg_4",
              sessionID: "ses_mode_test",
              role: "assistant",
              time: { created: 5, completed: 6 },
              parentID: "msg_3",
              modelID: "claude",
              providerID: "anthropic",
              mode: "build",
              cost: 0.01,
              tokens: {
                input: 10,
                output: 20,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
              finish: "stop",
            },
            parts: [
              {
                type: "text",
                text: "Response 2",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
        ] as unknown as Message[];

        const deps = await createTestDeps({ getMessages: async () => mockMessages });
        deps.agentsDB = agentsDB;

        await withDeps(deps, async () => {
          const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
          const response = await app.request(`/${agent.id}/messages?mode=last`);

          expect(response.status).toBe(200);
          const filtered = (await response.json()) as FilteredMessage[];

          // Should return only the last assistant message
          expect(filtered.length).toBe(1);
          expect(filtered[0].parts[0].text).toBe("Response 2");
        });
      });

      test("mode=latest_turn returns all messages since last user message", async () => {
        const agent = createRootAgent(agentsDB, {
          id: "agent_turn",
          session_id: "ses_turn_test",
          title: "Turn Test",
        });

        const mockMessages = [
          {
            info: {
              id: "msg_1",
              sessionID: "ses_turn_test",
              role: "user",
              time: { created: 1 },
              agent: "build",
              model: { providerID: "anthropic", modelID: "claude" },
            },
            parts: [
              {
                type: "text",
                text: "First",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
          {
            info: {
              id: "msg_2",
              sessionID: "ses_turn_test",
              role: "assistant",
              time: { created: 2, completed: 3 },
              parentID: "msg_1",
              modelID: "claude",
              providerID: "anthropic",
              mode: "build",
              cost: 0.01,
              tokens: {
                input: 10,
                output: 20,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
              finish: "stop",
            },
            parts: [
              {
                type: "text",
                text: "Old response",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
          {
            info: {
              id: "msg_3",
              sessionID: "ses_turn_test",
              role: "user",
              time: { created: 4 },
              agent: "build",
              model: { providerID: "anthropic", modelID: "claude" },
            },
            parts: [
              {
                type: "text",
                text: "Latest question",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
          {
            info: {
              id: "msg_4",
              sessionID: "ses_turn_test",
              role: "assistant",
              time: { created: 5, completed: 6 },
              parentID: "msg_3",
              modelID: "claude",
              providerID: "anthropic",
              mode: "build",
              cost: 0.01,
              tokens: {
                input: 10,
                output: 20,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
              finish: "tool-calls",
            },
            parts: [
              {
                type: "text",
                text: "Thinking...",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
          {
            info: {
              id: "msg_5",
              sessionID: "ses_turn_test",
              role: "assistant",
              time: { created: 7, completed: 8 },
              parentID: "msg_3",
              modelID: "claude",
              providerID: "anthropic",
              mode: "build",
              cost: 0.01,
              tokens: {
                input: 10,
                output: 20,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
              finish: "stop",
            },
            parts: [
              {
                type: "text",
                text: "Final answer",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
        ] as unknown as Message[];

        const deps = await createTestDeps({ getMessages: async () => mockMessages });
        deps.agentsDB = agentsDB;

        await withDeps(deps, async () => {
          const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
          const response = await app.request(`/${agent.id}/messages?mode=latest_turn`);

          expect(response.status).toBe(200);
          const filtered = (await response.json()) as FilteredMessage[];

          // Should return user message + both assistant messages in current turn
          expect(filtered.length).toBe(3);
          expect(filtered[0].info.role).toBe("user");
          expect(filtered[0].parts[0].text).toBe("Latest question");
          expect(filtered[1].parts[0].text).toBe("Thinking...");
          expect(filtered[2].parts[0].text).toBe("Final answer");
        });
      });

      test("mode=latest_turn uses compact filtering and keeps bash command", async () => {
        const agent = createRootAgent(agentsDB, {
          id: "agent_turn_compact",
          session_id: "ses_turn_compact",
          title: "Turn Compact Test",
        });

        const mockMessages = [
          {
            info: {
              id: "msg_1",
              sessionID: "ses_turn_compact",
              role: "user",
              time: { created: 1 },
              agent: "build",
              model: { providerID: "anthropic", modelID: "claude" },
            },
            parts: [
              {
                type: "text",
                text: "Question",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
          {
            info: {
              id: "msg_2",
              sessionID: "ses_turn_compact",
              role: "assistant",
              time: { created: 2, completed: 3 },
              parentID: "msg_1",
              modelID: "claude",
              providerID: "anthropic",
              mode: "build",
              cost: 0.01,
              tokens: {
                input: 10,
                output: 20,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
              finish: "tool-calls",
            },
            parts: [
              { type: "reasoning", text: "internal notes" },
              {
                type: "tool",
                tool: "bash",
                callID: "call_bash_turn",
                state: {
                  status: "completed",
                  input: {
                    command: "git status --short",
                    workdir: "/repo",
                    description: "Shows concise repo status",
                  },
                  output: "M src/file.ts\n",
                  title: "Shows concise repo status",
                },
              },
            ],
          },
          {
            info: {
              id: "msg_3",
              sessionID: "ses_turn_compact",
              role: "assistant",
              time: { created: 4, completed: 5 },
              parentID: "msg_1",
              modelID: "claude",
              providerID: "anthropic",
              mode: "build",
              cost: 0.01,
              tokens: {
                input: 10,
                output: 20,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
              finish: "stop",
            },
            parts: [
              {
                type: "text",
                text: "Final answer",
                id: "part_2",
                sessionID: "ses_123",
                messageID: "msg_3",
              },
            ],
          },
        ] as unknown as Message[];

        const deps = await createTestDeps({ getMessages: async () => mockMessages });
        deps.agentsDB = agentsDB;

        await withDeps(deps, async () => {
          const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
          const response = await app.request(`/${agent.id}/messages?mode=latest_turn`);

          expect(response.status).toBe(200);
          const filtered = (await response.json()) as FilteredMessage[];

          expect(filtered.length).toBe(3);
          expect(filtered[1].parts).toEqual([
            {
              type: "tool",
              callID: "call_bash_turn",
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
                output: "M src/file.ts\n",
                outputTruncated: false,
              },
            },
          ]);
        });
      });

      test("mode=all returns all messages", async () => {
        const agent = createRootAgent(agentsDB, {
          id: "agent_all",
          session_id: "ses_all_test",
          title: "All Test",
        });

        const mockMessages = [
          {
            info: {
              id: "msg_1",
              sessionID: "ses_all_test",
              role: "user",
              time: { created: 1 },
              agent: "build",
              model: { providerID: "anthropic", modelID: "claude" },
            },
            parts: [
              {
                type: "text",
                text: "Q1",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
          {
            info: {
              id: "msg_2",
              sessionID: "ses_all_test",
              role: "assistant",
              time: { created: 2, completed: 3 },
              parentID: "msg_1",
              modelID: "claude",
              providerID: "anthropic",
              mode: "build",
              cost: 0.01,
              tokens: {
                input: 10,
                output: 20,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
              finish: "stop",
            },
            parts: [
              {
                type: "text",
                text: "A1",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
          {
            info: {
              id: "msg_3",
              sessionID: "ses_all_test",
              role: "user",
              time: { created: 4 },
              agent: "build",
              model: { providerID: "anthropic", modelID: "claude" },
            },
            parts: [
              {
                type: "text",
                text: "Q2",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
          {
            info: {
              id: "msg_4",
              sessionID: "ses_all_test",
              role: "assistant",
              time: { created: 5, completed: 6 },
              parentID: "msg_3",
              modelID: "claude",
              providerID: "anthropic",
              mode: "build",
              cost: 0.01,
              tokens: {
                input: 10,
                output: 20,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
              finish: "stop",
            },
            parts: [
              {
                type: "text",
                text: "A2",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
        ] as unknown as Message[];

        const deps = await createTestDeps({ getMessages: async () => mockMessages });
        deps.agentsDB = agentsDB;

        await withDeps(deps, async () => {
          const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
          const response = await app.request(`/${agent.id}/messages?mode=all`);

          expect(response.status).toBe(200);
          const filtered = (await response.json()) as FilteredMessage[];

          // Should return all 4 messages
          expect(filtered.length).toBe(4);
          expect(filtered.map((m) => m.parts[0].text)).toEqual(["Q1", "A1", "Q2", "A2"]);
        });
      });

      test("mode=full returns all messages with compact tool details", async () => {
        const agent = createRootAgent(agentsDB, {
          id: "agent_full",
          session_id: "ses_full_test",
          title: "Full Test",
        });

        const mockMessages = [
          {
            info: {
              id: "msg_1",
              sessionID: "ses_full_test",
              role: "user",
              time: { created: 1 },
              agent: "build",
              model: { providerID: "anthropic", modelID: "claude" },
            },
            parts: [
              {
                type: "text",
                text: "Investigate secrets",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
          {
            info: {
              id: "msg_2",
              sessionID: "ses_full_test",
              role: "assistant",
              time: { created: 2, completed: 3 },
              parentID: "msg_1",
              modelID: "claude",
              providerID: "anthropic",
              mode: "build",
              cost: 0.01,
              tokens: {
                input: 10,
                output: 20,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
              finish: "tool-calls",
            },
            parts: [
              { type: "step-start" },
              {
                type: "tool",
                tool: "bash",
                callID: "call_1",
                state: {
                  status: "completed",
                  input: {
                    command: "git status --short",
                    description: "Check git status",
                  },
                  output: "M src/file.ts\n",
                  metadata: { exit: 0 },
                },
              },
              { type: "reasoning", text: "Thinking" },
              { type: "step-finish", reason: "stop", cost: 0, tokens: {} },
            ],
          },
        ] as unknown as Message[];

        const deps = await createTestDeps({ getMessages: async () => mockMessages });
        deps.agentsDB = agentsDB;

        await withDeps(deps, async () => {
          const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
          const response = await app.request(`/${agent.id}/messages?mode=full`);

          expect(response.status).toBe(200);
          const filtered = (await response.json()) as FilteredMessage[];

          expect(filtered.length).toBe(2);
          expect(filtered[0].parts[0].text).toBe("Investigate secrets");
          expect(filtered[1].parts).toEqual([
            {
              type: "tool",
              callID: "call_1",
              tool: "bash",
              summary: "Check git status",
              state: {
                status: "completed",
                input: {
                  description: "Check git status",
                },
                output: "M src/file.ts\n",
                outputTruncated: false,
              },
            },
          ]);
        });
      });

      test("GET tool call returns filtered tool details with message context", async () => {
        const agent = createRootAgent(agentsDB, {
          id: "agent_tool_call",
          session_id: "ses_tool_call",
          title: "Tool Call Test",
        });

        const mockMessages = [
          {
            info: {
              id: "msg_tool_call",
              sessionID: "ses_tool_call",
              role: "assistant",
              time: { created: 2, completed: 3 },
              parentID: "msg_1",
              modelID: "claude",
              providerID: "anthropic",
              mode: "build",
              cost: 0.01,
              tokens: {
                input: 10,
                output: 20,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
              finish: "tool-calls",
            },
            parts: [
              {
                type: "tool",
                tool: "bash",
                callID: "call_lookup_1",
                state: {
                  status: "completed",
                  input: {
                    command: "git status --short",
                    description: "Check git status",
                  },
                  output: "M src/file.ts\n",
                  metadata: { exit: 0 },
                },
              },
            ],
          },
        ] as unknown as Message[];

        const deps = await createTestDeps({ getMessages: async () => mockMessages });
        deps.agentsDB = agentsDB;

        await withDeps(deps, async () => {
          const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
          const response = await app.request(`/${agent.id}/tool-calls/call_lookup_1`);

          expect(response.status).toBe(200);
          const toolCall = (await response.json()) as {
            info: FilteredMessage["info"];
            part: FilteredMessage["parts"][number];
          };

          expect(toolCall.info.role).toBe("assistant");
          expect(toolCall.part).toEqual({
            type: "tool",
            callID: "call_lookup_1",
            tool: "bash",
            state: {
              status: "completed",
              input: {
                command: "git status --short",
                description: "Check git status",
              },
              output: "M src/file.ts\n",
            },
          });
        });
      });

      test("GET tool call returns 404 when call id is missing", async () => {
        const agent = createRootAgent(agentsDB, {
          id: "agent_missing_tool_call",
          session_id: "ses_missing_tool_call",
          title: "Missing Tool Call Test",
        });

        const deps = await createTestDeps({ getMessages: async () => [] as Message[] });
        deps.agentsDB = agentsDB;

        await withDeps(deps, async () => {
          const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
          const response = await app.request(`/${agent.id}/tool-calls/call_missing`);

          expect(response.status).toBe(404);
          const body = (await response.json()) as { error: string };
          expect(body.error).toContain("Tool call call_missing not found");
        });
      });

      test("mode=full fetches full history without a hard limit", async () => {
        const agent = createRootAgent(agentsDB, {
          id: "agent_full_history",
          session_id: "ses_full_history",
          title: "Full History",
        });

        let receivedLimit: number | undefined;
        const deps = await createTestDeps({
          getMessages: async (_sessionId: string, limit?: number) => {
            receivedLimit = limit;
            return [];
          },
        });
        deps.agentsDB = agentsDB;

        await withDeps(deps, async () => {
          const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
          const response = await app.request(`/${agent.id}/messages?mode=full`);

          expect(response.status).toBe(200);
          expect(receivedLimit).toBeUndefined();
        });
      });

      test("default mode returns last assistant message", async () => {
        const agent = createRootAgent(agentsDB, {
          id: "agent_default",
          session_id: "ses_default_test",
          title: "Default Test",
        });

        const mockMessages = [
          {
            info: {
              id: "msg_1",
              sessionID: "ses_default_test",
              role: "user",
              time: { created: 1 },
              agent: "build",
              model: { providerID: "anthropic", modelID: "claude" },
            },
            parts: [
              {
                type: "text",
                text: "Question",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
          {
            info: {
              id: "msg_2",
              sessionID: "ses_default_test",
              role: "assistant",
              time: { created: 2, completed: 3 },
              parentID: "msg_1",
              modelID: "claude",
              providerID: "anthropic",
              mode: "build",
              cost: 0.01,
              tokens: {
                input: 10,
                output: 20,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
              finish: "stop",
            },
            parts: [
              {
                type: "text",
                text: "Answer",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
        ] as unknown as Message[];

        const deps = await createTestDeps({ getMessages: async () => mockMessages });
        deps.agentsDB = agentsDB;

        await withDeps(deps, async () => {
          const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
          // No mode parameter - should default to 'last'
          const response = await app.request(`/${agent.id}/messages`);

          expect(response.status).toBe(200);
          const filtered = (await response.json()) as FilteredMessage[];

          expect(filtered.length).toBe(1);
          expect(filtered[0].parts[0].text).toBe("Answer");
        });
      });

      test("invalid mode returns 400 error", async () => {
        const agent = createRootAgent(agentsDB, {
          id: "agent_inv",
          session_id: "ses_invalid",
          title: "Invalid Test",
        });

        const deps = await createTestDeps();
        deps.agentsDB = agentsDB;

        await withDeps(deps, async () => {
          const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
          const response = await app.request(`/${agent.id}/messages?mode=invalid`);

          expect(response.status).toBe(400);
          const body = (await response.json()) as { error: string };
          expect(body.error).toContain("Invalid mode");
        });
      });

      test("mode=latest_turn with no user messages returns all assistant messages", async () => {
        const agent = createRootAgent(agentsDB, {
          id: "agent_no_user",
          session_id: "ses_no_user",
          title: "No User Test",
        });

        const mockMessages = [
          {
            info: {
              id: "msg_1",
              sessionID: "ses_no_user",
              role: "assistant",
              time: { created: 1, completed: 2 },
              parentID: "",
              modelID: "claude",
              providerID: "anthropic",
              mode: "build",
              cost: 0.01,
              tokens: {
                input: 10,
                output: 20,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
              finish: "stop",
            },
            parts: [
              {
                type: "text",
                text: "Response 1",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
          {
            info: {
              id: "msg_2",
              sessionID: "ses_no_user",
              role: "assistant",
              time: { created: 3, completed: 4 },
              parentID: "",
              modelID: "claude",
              providerID: "anthropic",
              mode: "build",
              cost: 0.01,
              tokens: {
                input: 10,
                output: 20,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
              finish: "stop",
            },
            parts: [
              {
                type: "text",
                text: "Response 2",
                id: "part_1",
                sessionID: "ses_123",
                messageID: "msg_1",
              },
            ],
          },
        ] as unknown as Message[];

        const deps = await createTestDeps({ getMessages: async () => mockMessages });
        deps.agentsDB = agentsDB;

        await withDeps(deps, async () => {
          const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
          const response = await app.request(`/${agent.id}/messages?mode=latest_turn`);

          expect(response.status).toBe(200);
          const filtered = (await response.json()) as FilteredMessage[];

          // Should return all assistant messages (no user messages exist)
          expect(filtered.length).toBe(2);
          expect(filtered[0].parts[0].text).toBe("Response 1");
          expect(filtered[1].parts[0].text).toBe("Response 2");
        });
      });
    });
  });

  describe("POST /aapi/agents - System prompt injection", () => {
    test("injects Birdhouse system prompt when creating agent with prompt", async () => {
      const currentAgent = createRootAgent(agentsDB, {
        id: "agent_current",
        session_id: "ses_current",
        title: "Current Agent",
      });

      const mockSession: Session = {
        id: "ses_new_with_prompt",
        title: "New Agent",
        projectID: "test",
        directory: "/test",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      };

      const mockMessage: Message = {
        info: {
          id: "msg_1",
          sessionID: "ses_new_with_prompt",
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user",
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
          path: { cwd: "/test", root: "/" },
        },
        parts: [
          {
            type: "text",
            text: "Agent response",
            id: "part_1",
            sessionID: "ses_123",
            messageID: "msg_1",
          },
        ],
      };

      let capturedSystemPrompt: string | undefined;

      const deps = await createTestDeps({
        createSession: async () => mockSession,
        sendMessage: async (_sessionId, _text, options) => {
          capturedSystemPrompt = options?.system;
          return mockMessage;
        },
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
        const response = await app.request("/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": currentAgent.session_id,
          },
          body: JSON.stringify({
            title: "New Agent",
            model: "anthropic/claude-sonnet-4",
            prompt: "Do something",
            wait: true,
          }),
        });

        expect(response.status).toBe(201);

        // Verify system prompt was injected
        expect(capturedSystemPrompt).toBeDefined();
        expect(capturedSystemPrompt).toContain("Birdhouse");
        expect(capturedSystemPrompt).toContain("Agent Management Tools");
        expect(capturedSystemPrompt).toContain("agent_create");
      });
    });

    test("uses exact BIRDHOUSE_SYSTEM_PROMPT constant", async () => {
      const { BIRDHOUSE_SYSTEM_PROMPT } = await import("../../src/lib/birdhouse-system-prompt");

      const currentAgent = createRootAgent(agentsDB, {
        id: "agent_current2",
        session_id: "ses_current2",
        title: "Current Agent",
      });

      const mockSession: Session = {
        id: "ses_exact_prompt",
        title: "Exact Test",
        projectID: "test",
        directory: "/test",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      };

      const mockMessage: Message = {
        info: {
          id: "msg_2",
          sessionID: "ses_exact_prompt",
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user",
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
          path: { cwd: "/test", root: "/" },
        },
        parts: [
          {
            type: "text",
            text: "Response",
            id: "part_1",
            sessionID: "ses_123",
            messageID: "msg_1",
          },
        ],
      };

      let capturedSystemPrompt: string | undefined;

      const deps = await createTestDeps({
        createSession: async () => mockSession,
        sendMessage: async (_sessionId, _text, options) => {
          capturedSystemPrompt = options?.system;
          return mockMessage;
        },
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
        const response = await app.request("/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": currentAgent.session_id,
          },
          body: JSON.stringify({
            title: "Exact Test",
            model: "anthropic/claude-sonnet-4",
            prompt: "Test prompt",
            wait: true,
          }),
        });

        expect(response.status).toBe(201);

        // Verify exact constant is used
        expect(capturedSystemPrompt).toBe(BIRDHOUSE_SYSTEM_PROMPT);
      });
    });

    test("injects system prompt in async mode (wait=false)", async () => {
      const currentAgent = createRootAgent(agentsDB, {
        id: "agent_current3",
        session_id: "ses_current3",
        title: "Current Agent",
      });

      const mockSession: Session = {
        id: "ses_async_prompt",
        title: "Async Test",
        projectID: "test",
        directory: "/test",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      };

      const mockMessage: Message = {
        info: {
          id: "msg_3",
          sessionID: "ses_async_prompt",
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user",
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
          path: { cwd: "/test", root: "/" },
        },
        parts: [
          {
            type: "text",
            text: "Async response",
            id: "part_1",
            sessionID: "ses_123",
            messageID: "msg_1",
          },
        ],
      };

      let capturedSystemPrompt: string | undefined;

      const deps = await createTestDeps({
        createSession: async () => mockSession,
        sendMessage: async (_sessionId, _text, options) => {
          capturedSystemPrompt = options?.system;
          return mockMessage;
        },
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
        const response = await app.request("/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": currentAgent.session_id,
          },
          body: JSON.stringify({
            title: "Async Test",
            model: "anthropic/claude-sonnet-4",
            prompt: "Test async",
            wait: false,
          }),
        });

        expect(response.status).toBe(201);

        // Verify system prompt is injected even in async mode
        expect(capturedSystemPrompt).toBeDefined();
        expect(capturedSystemPrompt).toContain("Birdhouse");
        expect(capturedSystemPrompt).toContain("agent_create");
      });
    });

    test("injects system prompt when cloning with from_self", async () => {
      const currentAgent = createRootAgent(agentsDB, {
        id: "agent_current4",
        session_id: "ses_current4",
        title: "Current Agent",
      });

      const mockMessages = [
        {
          info: {
            id: "msg_user",
            sessionID: "ses_current4",
            role: "user",
            time: { created: 1 },
            agent: "build",
            model: { providerID: "anthropic", modelID: "claude" },
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
        },
        {
          info: {
            id: "msg_assistant",
            sessionID: "ses_current4",
            role: "assistant",
            time: { created: 2, completed: 3 },
            parentID: "msg_user",
            modelID: "claude",
            providerID: "anthropic",
            mode: "build",
            cost: 0,
            tokens: {
              input: 10,
              output: 20,
              reasoning: 0,
              cache: { read: 0, write: 0 },
            },
          },
          parts: [
            {
              type: "text",
              text: "Assistant response",
              id: "part_1",
              sessionID: "ses_123",
              messageID: "msg_1",
            },
          ],
        },
        {
          info: {
            id: "msg_user2",
            sessionID: "ses_current4",
            role: "user",
            time: { created: 4 },
            agent: "build",
            model: { providerID: "anthropic", modelID: "claude" },
          },
          parts: [
            {
              type: "text",
              text: "Second message",
              id: "part_1",
              sessionID: "ses_123",
              messageID: "msg_1",
            },
          ],
        },
      ] as unknown as Message[];

      const mockSession: Session = {
        id: "ses_cloned",
        title: "Cloned Agent",
        projectID: "test",
        directory: "/test",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      };

      const mockMessage: Message = {
        info: {
          id: "msg_clone",
          sessionID: "ses_cloned",
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user",
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
          path: { cwd: "/test", root: "/" },
        },
        parts: [
          {
            type: "text",
            text: "Cloned response",
            id: "part_1",
            sessionID: "ses_123",
            messageID: "msg_1",
          },
        ],
      };

      let capturedSystemPrompt: string | undefined;

      const deps = await createTestDeps({
        getMessages: async () => mockMessages,
        forkSession: async () => mockSession,
        sendMessage: async (_sessionId, _text, options) => {
          capturedSystemPrompt = options?.system;
          return mockMessage;
        },
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
        const response = await app.request("/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": currentAgent.session_id,
          },
          body: JSON.stringify({
            title: "Cloned Agent",
            prompt: "Clone test",
            from_self: true,
            wait: true,
          }),
        });

        expect(response.status).toBe(201);

        // Verify system prompt is injected when cloning
        expect(capturedSystemPrompt).toBeDefined();
        expect(capturedSystemPrompt).toContain("Birdhouse");
        expect(capturedSystemPrompt).toContain("agent_create");
      });
    });

    test("emits birdhouse.agent.created event when creating fresh agent", async () => {
      const currentAgent = agentsDB.insertAgent({
        id: "agent_current_event",
        session_id: "ses_current_event",
        parent_id: null,
        tree_id: "agent_current_event",
        level: 0,
        title: "Current Agent",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const mockSession: Session = {
        id: "ses_fresh_event",
        title: "Fresh Agent",
        projectID: "test",
        directory: "/test",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      };

      const mockMessage: Message = {
        info: {
          id: "msg_fresh",
          sessionID: "ses_fresh_event",
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user",
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
          path: { cwd: "/test", root: "/" },
        },
        parts: [
          {
            type: "text",
            text: "Fresh agent response",
            id: "part_1",
            sessionID: "ses_123",
            messageID: "msg_1",
          },
        ],
      };

      const deps = await createTestDeps({
        createSession: async () => mockSession,
        sendMessage: async () => mockMessage,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const { events, cleanup } = await captureStreamEvents();

        const app = await withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });
        const response = await app.request("/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": currentAgent.session_id,
          },
          body: JSON.stringify({
            title: "Fresh Agent",
            model: "anthropic/claude-sonnet-4",
            prompt: "Do some work",
            wait: true,
          }),
        });

        expect(response.status).toBe(201);
        const agent = (await response.json()) as {
          id: string;
          parent_id: string;
        };

        // Verify event was emitted
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe("birdhouse.agent.created");
        expect(events[0].properties.agentId).toBe(agent.id);
        expect((events[0].properties.agent as { id: string }).id).toBe(agent.id);
        expect(agent.parent_id).toBe("agent_current_event");

        cleanup();
      });
    });
  });
});
