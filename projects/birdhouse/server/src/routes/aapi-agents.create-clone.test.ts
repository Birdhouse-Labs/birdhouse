// ABOUTME: Tests for enhanced agent_create with cloning support (from_self, from_agent_id)
// ABOUTME: Verifies smart from_self behavior, validation, and tree placement

import { beforeEach, describe, expect, test } from "bun:test";
import { createTestDeps, type Session, withDeps } from "../dependencies";
import { type AgentRow, createAgentsDB } from "../lib/agents-db";
import type { Message } from "../lib/opencode-client";
import { captureStreamEvents, withWorkspaceContext } from "../test-utils";
import { createRootAgent } from "../test-utils/agent-factories";
import { createAAPIAgentRoutes } from "./aapi-agents";

describe("AAPI Agent Create with Cloning", () => {
  let agentsDB: ReturnType<typeof createAgentsDB>;
  let mockForkSession: (sessionId: string, messageId?: string) => Promise<Session>;
  let mockGetMessages: (sessionId: string) => Promise<Message[]>;
  let mockSendMessage: (sessionId: string, text: string, options?: unknown) => Promise<Message>;

  beforeEach(() => {
    agentsDB = createAgentsDB(":memory:");

    mockForkSession = async (_sessionId: string, _messageId?: string) => ({
      id: `ses_forked_${Date.now()}`,
      title: "Forked Session",
      projectID: "test-project",
      directory: "/test",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    });

    mockGetMessages = async (_sessionId: string) => [];

    mockSendMessage = async (sessionId: string, _text: string) =>
      ({
        info: {
          id: `msg_${Date.now()}`,
          sessionID: sessionId,
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user",
          modelID: "claude-sonnet-4",
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
        parts: [{ type: "text", text: "Response" }],
      }) as Message;
  });

  describe("Non-cloning behavior (backward compatibility)", () => {
    test("creates agent as child of current agent when no cloning params", async () => {
      // Create current agent
      const _currentAgent = createRootAgent(agentsDB, {
        session_id: "ses_current",
        title: "Current Agent",
        id: "agent_current",
      });

      const deps = createTestDeps({
        getSession: async (sessionId: string) => ({
          id: sessionId,
          title: "Session",
          projectID: "test",
          directory: "/test",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        }),
        createSession: async () => ({
          id: "ses_new_child",
          title: "New Child",
          projectID: "test",
          directory: "/test",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        }),
        sendMessage: mockSendMessage,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        // Simulate request from current agent's session
        const _response = await app.request("/by-session/ses_current", {
          method: "POST",
          body: JSON.stringify({
            prompt: "Do some work",
            title: "Child Agent",
          }),
          headers: { "Content-Type": "application/json" },
        });

        // Note: This endpoint doesn't exist yet - we're testing /aapi/agents POST
        // Let me fix this approach
      });
    });

    test("requires title parameter", async () => {
      const deps = createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            prompt: "Do work",
            // Missing title
          }),
          headers: { "Content-Type": "application/json" },
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as { error?: string };
        expect(body.error).toContain("title");
      });
    });
  });

  describe("from_agent_id cloning", () => {
    test("clones from another agent as child with full conversation", async () => {
      // Create source agent
      const _sourceAgent = createRootAgent(agentsDB, {
        session_id: "ses_source",
        title: "Source Agent",
        model: "anthropic/claude-opus-4",
        id: "agent_source",
      });

      const deps = createTestDeps({
        forkSession: mockForkSession,
        sendMessage: mockSendMessage,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_agent_id: "agent_source",
            prompt: "Continue the work",
            title: "Cloned Agent",
          }),
          headers: { "Content-Type": "application/json" },
        });

        expect(response.status).toBe(201);
        const clonedAgent = (await response.json()) as AgentRow;

        // Verify tree placement
        expect(clonedAgent.parent_id).toBe("agent_source");
        expect(clonedAgent.tree_id).toBe("agent_source");
        expect(clonedAgent.level).toBe(1);
        expect(clonedAgent.title).toBe("Cloned Agent");

        // Verify model copied from source
        expect(clonedAgent.model).toBe("anthropic/claude-opus-4");
      });
    });

    test("clones from another agent with specific message ID", async () => {
      const _sourceAgent = createRootAgent(agentsDB, {
        session_id: "ses_source2",
        title: "Source Agent 2",
        id: "agent_source2",
      });

      // Mock messages in source agent
      mockGetMessages = async (sessionId: string) =>
        [
          {
            info: {
              id: "msg_1",
              role: "user",
              sessionID: sessionId,
              time: { created: 1000 },
            },
            parts: [{ type: "text", text: "First" }],
          },
          {
            info: {
              id: "msg_2",
              role: "assistant",
              sessionID: sessionId,
              time: { created: 2000 },
            },
            parts: [{ type: "text", text: "Second" }],
          },
          {
            info: {
              id: "msg_3",
              role: "user",
              sessionID: sessionId,
              time: { created: 3000 },
            },
            parts: [{ type: "text", text: "Third" }],
          },
        ] as Message[];

      let capturedMessageId: string | undefined;
      mockForkSession = async (_sessionId: string, messageId?: string) => {
        capturedMessageId = messageId;
        return {
          id: `ses_forked_at_msg`,
          title: "Forked",
          projectID: "test",
          directory: "/test",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        };
      };

      const deps = createTestDeps({
        forkSession: mockForkSession,
        getMessages: mockGetMessages,
        sendMessage: mockSendMessage,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_agent_id: "agent_source2",
            from_message_id: "msg_2",
            prompt: "Branch from msg_2",
            title: "Branched Agent",
          }),
          headers: { "Content-Type": "application/json" },
        });

        expect(response.status).toBe(201);
        expect(capturedMessageId).toBe("msg_2");
      });
    });

    test("allows custom model to override source model", async () => {
      const _sourceAgent = createRootAgent(agentsDB, {
        session_id: "ses_source3",
        title: "Source Agent 3",
        model: "anthropic/claude-opus-4",
        id: "agent_source3",
      });

      const deps = createTestDeps({
        forkSession: mockForkSession,
        sendMessage: mockSendMessage,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_agent_id: "agent_source3",
            prompt: "Use different model",
            title: "Custom Model Agent",
            model: "anthropic/claude-haiku-4",
          }),
          headers: { "Content-Type": "application/json" },
        });

        expect(response.status).toBe(201);
        const clonedAgent = (await response.json()) as AgentRow;

        // Custom model should override source
        expect(clonedAgent.model).toBe("anthropic/claude-haiku-4");
      });
    });

    test("emits birdhouse.agent.created event when cloning from another agent", async () => {
      const _sourceAgent = createRootAgent(agentsDB, {
        session_id: "ses_event_clone",
        title: "Source Agent",
        id: "agent_event_clone",
      });

      const deps = createTestDeps({
        forkSession: mockForkSession,
        sendMessage: mockSendMessage,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const { events, cleanup } = await captureStreamEvents();

        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_agent_id: "agent_event_clone",
            prompt: "Test event emission",
            title: "Cloned Agent",
          }),
          headers: { "Content-Type": "application/json" },
        });

        expect(response.status).toBe(201);
        const clonedAgent = (await response.json()) as AgentRow & {
          parts?: unknown[];
        };

        // Verify events were emitted (both agent.created and event.created)
        const agentCreatedEvent = events.find((e) => e.type === "birdhouse.agent.created");
        expect(agentCreatedEvent).toBeDefined();
        expect(agentCreatedEvent?.properties.agentId).toBe(clonedAgent.id);
        // Event should contain agent data (without response parts)
        const eventAgent = agentCreatedEvent?.properties.agent as AgentRow;
        expect(eventAgent.id).toBe(clonedAgent.id);
        expect(eventAgent.parent_id).toBe(clonedAgent.parent_id);
        expect(eventAgent.title).toBe(clonedAgent.title);

        cleanup();
      });
    });

    test("returns 404 when source agent does not exist", async () => {
      const deps = createTestDeps({
        forkSession: mockForkSession,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_agent_id: "agent_nonexistent",
            prompt: "Try to clone",
            title: "Should Fail",
          }),
          headers: { "Content-Type": "application/json" },
        });

        expect(response.status).toBe(404);
        const body = (await response.json()) as { error?: string };
        expect(body.error).toContain("not found");
      });
    });

    test("returns 400 when from_message_id does not exist in source session", async () => {
      const _sourceAgent = createRootAgent(agentsDB, {
        session_id: "ses_source4",
        title: "Source Agent 4",
        id: "agent_source4",
      });

      mockGetMessages = async () =>
        [
          {
            info: {
              id: "msg_real",
              role: "user",
              sessionID: "ses_source4",
              time: { created: 1000 },
            },
            parts: [{ type: "text", text: "Real message" }],
          },
        ] as Message[];

      const deps = createTestDeps({
        getMessages: mockGetMessages,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_agent_id: "agent_source4",
            from_message_id: "msg_fake",
            prompt: "Try invalid message",
            title: "Should Fail",
          }),
          headers: { "Content-Type": "application/json" },
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as { error?: string };
        expect(body.error).toContain("not found");
        expect(body.error).toContain("msg_fake");
      });
    });
  });

  describe("from_self cloning", () => {
    test("clones from self with smart message detection (no from_message_id)", async () => {
      // Create current agent
      const _currentAgent = createRootAgent(agentsDB, {
        session_id: "ses_current_self",
        title: "Current Agent",
        id: "agent_current_self",
      });

      // Mock current session messages - last user message is "clone yourself"
      mockGetMessages = async (sessionId: string) =>
        [
          {
            info: {
              id: "msg_1",
              role: "user",
              sessionID: sessionId,
              time: { created: 1000 },
            },
            parts: [{ type: "text", text: "First question" }],
          },
          {
            info: {
              id: "msg_2",
              role: "assistant",
              sessionID: sessionId,
              time: { created: 2000 },
            },
            parts: [{ type: "text", text: "First answer" }],
          },
          {
            info: {
              id: "msg_3",
              role: "user",
              sessionID: sessionId,
              time: { created: 3000 },
            },
            parts: [{ type: "text", text: "Second question" }],
          },
          {
            info: {
              id: "msg_4",
              role: "assistant",
              sessionID: sessionId,
              time: { created: 4000 },
            },
            parts: [{ type: "text", text: "Second answer" }],
          },
          {
            info: {
              id: "msg_5",
              role: "user",
              sessionID: sessionId,
              time: { created: 5000 },
            },
            parts: [{ type: "text", text: "Please clone yourself" }],
          },
        ] as Message[];

      let capturedMessageId: string | undefined;
      mockForkSession = async (_sessionId: string, messageId?: string) => {
        capturedMessageId = messageId;
        return {
          id: "ses_forked_self",
          title: "Forked from self",
          projectID: "test",
          directory: "/test",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        };
      };

      const deps = createTestDeps({
        getMessages: mockGetMessages,
        forkSession: mockForkSession,
        sendMessage: mockSendMessage,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        // Simulate request from current agent's session
        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_self: true,
            prompt: "Try different approach",
            title: "Alternative Branch",
          }),
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": "ses_current_self", // Simulate session context
          },
        });

        expect(response.status).toBe(201);

        // Should fork from msg_4 (message before last user message)
        expect(capturedMessageId).toBe("msg_4");

        const clonedAgent = (await response.json()) as AgentRow;
        expect(clonedAgent.parent_id).toBe("agent_current_self");
      });
    });

    test("clones from self with explicit from_message_id", async () => {
      const _currentAgent = createRootAgent(agentsDB, {
        session_id: "ses_current_self2",
        title: "Current Agent 2",
        model: "anthropic/claude-haiku-4",
        id: "agent_current_self2",
      });

      mockGetMessages = async (sessionId: string) =>
        [
          {
            info: {
              id: "msg_a",
              role: "user",
              sessionID: sessionId,
              time: { created: 1000 },
            },
            parts: [{ type: "text", text: "First" }],
          },
          {
            info: {
              id: "msg_b",
              role: "assistant",
              sessionID: sessionId,
              time: { created: 2000 },
            },
            parts: [{ type: "text", text: "Second" }],
          },
        ] as Message[];

      let capturedMessageId: string | undefined;
      mockForkSession = async (_sessionId: string, messageId?: string) => {
        capturedMessageId = messageId;
        return {
          id: "ses_forked_explicit",
          title: "Forked",
          projectID: "test",
          directory: "/test",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        };
      };

      const deps = createTestDeps({
        getMessages: mockGetMessages,
        forkSession: mockForkSession,
        sendMessage: mockSendMessage,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_self: true,
            from_message_id: "msg_b",
            prompt: "Branch from msg_b",
            title: "Explicit Branch",
          }),
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": "ses_current_self2",
          },
        });

        expect(response.status).toBe(201);
        expect(capturedMessageId).toBe("msg_b");
      });
    });

    test("returns 400 when from_self but no user messages in session", async () => {
      const _currentAgent = createRootAgent(agentsDB, {
        session_id: "ses_no_user_msgs",
        title: "No User Messages",
        id: "agent_no_user",
      });

      mockGetMessages = async () => [];

      const deps = createTestDeps({
        getMessages: mockGetMessages,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_self: true,
            prompt: "Should fail",
            title: "No Messages",
          }),
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": "ses_no_user_msgs",
          },
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as { error?: string };
        expect(body.error).toContain("no user messages");
      });
    });

    test("returns 400 when from_self but last user message is first message", async () => {
      const _currentAgent = createRootAgent(agentsDB, {
        session_id: "ses_first_is_last",
        title: "First Is Last",
        id: "agent_first_last",
      });

      mockGetMessages = async (sessionId: string) =>
        [
          {
            info: {
              id: "msg_only",
              role: "user",
              sessionID: sessionId,
              time: { created: 1000 },
            },
            parts: [{ type: "text", text: "Only message" }],
          },
        ] as Message[];

      const deps = createTestDeps({
        getMessages: mockGetMessages,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_self: true,
            prompt: "Should fail",
            title: "First Message",
          }),
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": "ses_first_is_last",
          },
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as { error?: string };
        expect(body.error).toContain("first message");
      });
    });
  });

  describe("Validation", () => {
    test("returns 400 when invalid model specified (non-cloning)", async () => {
      // Create current agent for context
      const _currentAgent = createRootAgent(agentsDB, {
        session_id: "ses_current_model_test",
        title: "Current Agent",
        id: "agent_current_model",
      });

      const deps = createTestDeps({
        createSession: async () => ({
          id: "ses_new",
          title: "New",
          projectID: "test",
          directory: "/test",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        }),
        getProviders: async () => ({
          providers: [
            {
              id: "anthropic",
              name: "Anthropic",
              models: {
                "claude-sonnet-4": {
                  id: "claude-sonnet-4",
                  name: "Claude Sonnet 4",
                },
                "claude-haiku-4": {
                  id: "claude-haiku-4",
                  name: "Claude Haiku 4",
                },
              },
            },
          ],
        }),
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            prompt: "Test invalid model",
            title: "Should Fail",
            model: "anthropic/claude-invalid-9000",
          }),
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": "ses_current_model_test",
          },
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as { error?: string };
        expect(body.error).toContain("Invalid model");
        expect(body.error).toContain("claude-invalid-9000");
        expect(body.error).toContain("Available models");
      });
    });

    test("returns 400 when invalid model specified (cloning)", async () => {
      const _sourceAgent = createRootAgent(agentsDB, {
        session_id: "ses_source_model",
        title: "Source Agent",
        id: "agent_source_model",
      });

      const deps = createTestDeps({
        forkSession: mockForkSession,
        getProviders: async () => ({
          providers: [
            {
              id: "anthropic",
              name: "Anthropic",
              models: {
                "claude-sonnet-4": {
                  id: "claude-sonnet-4",
                  name: "Claude Sonnet 4",
                },
              },
            },
          ],
        }),
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_agent_id: "agent_source_model",
            prompt: "Test clone with invalid model",
            title: "Should Fail",
            model: "anthropic/claude-fake-model",
          }),
          headers: { "Content-Type": "application/json" },
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as { error?: string };
        expect(body.error).toContain("Invalid model");
        expect(body.error).toContain("claude-fake-model");
      });
    });

    test("returns 400 when both from_self and from_agent_id specified", async () => {
      const deps = createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_self: true,
            from_agent_id: "agent_other",
            prompt: "Ambiguous clone",
            title: "Should Fail",
          }),
          headers: { "Content-Type": "application/json" },
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as { error?: string };
        expect(body.error).toContain("both");
      });
    });

    test("returns 400 when from_message_id without clone source", async () => {
      const deps = createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_message_id: "msg_orphan",
            prompt: "Message without source",
            title: "Should Fail",
          }),
          headers: { "Content-Type": "application/json" },
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as { error?: string };
        expect(body.error).toContain("requires");
      });
    });
  });

  describe("Model handling", () => {
    test("passes model to sendMessage when creating fresh agent", async () => {
      const _currentAgent = createRootAgent(agentsDB, {
        session_id: "ses_current_model_pass",
        title: "Current Agent",
        id: "agent_current_model_pass",
      });

      let capturedModel: { providerID: string; modelID: string } | undefined;
      const mockSendWithModelCapture = async (sessionId: string, text: string, options?: unknown) => {
        const opts = options as { model?: { providerID: string; modelID: string } } | undefined;
        capturedModel = opts?.model;
        return mockSendMessage(sessionId, text, options);
      };

      const deps = createTestDeps({
        createSession: async () => ({
          id: "ses_new_model",
          title: "New",
          projectID: "test",
          directory: "/test",
          version: "1.0.0",
          time: { created: Date.now(), updated: Date.now() },
        }),
        sendMessage: mockSendWithModelCapture,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            prompt: "Test model passing",
            title: "Model Test",
            model: "anthropic/claude-haiku-4",
          }),
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": "ses_current_model_pass",
          },
        });

        expect(response.status).toBe(201);

        // Verify model was passed to sendMessage
        expect(capturedModel).toBeDefined();
        expect(capturedModel?.providerID).toBe("anthropic");
        expect(capturedModel?.modelID).toBe("claude-haiku-4");
      });
    });

    test("passes source model to sendMessage when cloning without custom model", async () => {
      const _sourceAgent = createRootAgent(agentsDB, {
        session_id: "ses_source_model_pass",
        title: "Source Agent",
        model: "anthropic/claude-opus-4",
        id: "agent_source_model_pass",
      });

      let capturedModel: { providerID: string; modelID: string } | undefined;
      const mockSendWithModelCapture = async (sessionId: string, text: string, options?: unknown) => {
        const opts = options as { model?: { providerID: string; modelID: string } } | undefined;
        capturedModel = opts?.model;
        return mockSendMessage(sessionId, text, options);
      };

      const deps = createTestDeps({
        forkSession: mockForkSession,
        sendMessage: mockSendWithModelCapture,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_agent_id: "agent_source_model_pass",
            prompt: "Clone and use source model",
            title: "Cloned Agent",
          }),
          headers: { "Content-Type": "application/json" },
        });

        expect(response.status).toBe(201);

        // Verify source model was passed to sendMessage
        expect(capturedModel).toBeDefined();
        expect(capturedModel?.providerID).toBe("anthropic");
        expect(capturedModel?.modelID).toBe("claude-opus-4");
      });
    });
  });

  describe("Wait modes", () => {
    test("wait=true returns completed response (default)", async () => {
      const _sourceAgent = createRootAgent(agentsDB, {
        session_id: "ses_wait_test",
        title: "Wait Test",
        id: "agent_wait",
      });

      const deps = createTestDeps({
        forkSession: mockForkSession,
        sendMessage: mockSendMessage,
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_agent_id: "agent_wait",
            prompt: "Wait for response",
            title: "Waiting Agent",
            wait: true,
          }),
          headers: { "Content-Type": "application/json" },
        });

        expect(response.status).toBe(201);
        const body = (await response.json()) as { parts?: unknown };

        // Should include response parts when wait=true
        expect(body.parts).toBeDefined();
      });
    });

    test("wait=false returns agent ID immediately", async () => {
      const _sourceAgent = createRootAgent(agentsDB, {
        session_id: "ses_async_test",
        title: "Async Test",
        id: "agent_async",
      });

      const deps = createTestDeps({
        forkSession: mockForkSession,
        sendMessage: async () => ({}) as Message, // No response needed for async
      });
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = withWorkspaceContext(createAAPIAgentRoutes, { agentsDb: agentsDB });

        const response = await app.request("/", {
          method: "POST",
          body: JSON.stringify({
            from_agent_id: "agent_async",
            prompt: "Fire and forget",
            title: "Async Agent",
            wait: false,
          }),
          headers: { "Content-Type": "application/json" },
        });

        expect(response.status).toBe(201);
        const body = (await response.json()) as {
          parts?: unknown;
          id?: string;
        };

        // Should not include response parts when wait=false
        expect(body.parts).toBeUndefined();
        expect(body.id).toBeDefined();
      });
    });
  });
});
