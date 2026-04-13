// ABOUTME: Tests for send-message endpoint with clone_and_send event insertion
// ABOUTME: Verifies that clone_and_send creates timeline events in both parent and child agents

import { beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createTestDeps, withDeps } from "../../dependencies";
import type { BirdhouseMessage as Message, BirdhouseSkill as Skill } from "../../harness";
import { type AgentsDB, initAgentsDB } from "../../lib/agents-db";
import { captureStreamEvents, createRootAgent, withWorkspaceContext } from "../../test-utils";
import { sendMessage } from "./send-message";

describe("API send-message with clone_and_send", () => {
  let agentsDB: AgentsDB;
  let mockForkSession: (
    sessionId: string,
    messageId?: string,
  ) => Promise<{
    id: string;
    title: string;
    projectID: string;
    directory: string;
    version: string;
    time: { created: number; updated: number };
  }>;

  beforeEach(async () => {
    agentsDB = await initAgentsDB(":memory:");

    // Create mock fork function
    mockForkSession = async (_sessionId: string) => ({
      id: `ses_fork_${Date.now()}`,
      title: "Fork",
      projectID: "test-project",
      directory: "/test",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    });
  });

  describe("clone_and_send events", () => {
    test("attaches only explicitly linked skills on send", async () => {
      const sourceAgent = createRootAgent(agentsDB, {
        id: "agent_skill_send",
        session_id: "ses_skill_send",
        title: "Skill Send Agent",
      });

      const visibleSkills: Skill[] = [
        {
          name: "find-docs",
          description: "Retrieve current docs.",
          location: "/Users/test/.claude/skills/find-docs/SKILL.md",
          content: "# Find Docs",
        },
      ];

      let capturedPrompt = "";
      const mockMessage = {
        info: {
          id: "msg_response",
          sessionID: "ses_skill_send",
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
            sessionID: "ses_skill_send",
            messageID: "msg_1",
          },
        ],
      } as Message;

      const deps = await createTestDeps({ listSkills: async () => visibleSkills });
      deps.agentsDB = agentsDB;
      deps.harness.sendMessage = async (_sessionId, _text, options) => {
        capturedPrompt = (options?.parts?.[0] as { text?: string } | undefined)?.text ?? "";
        return mockMessage;
      };
      deps.dataDb.setSkillTriggerPhrases("find-docs", ["docs please"]);

      await withDeps(deps, async () => {
        const app = await withWorkspaceContext(
          () => {
            const hono = new Hono();
            hono.post("/:id/messages", (c) => sendMessage(c, deps));
            return hono;
          },
          { agentsDb: agentsDB },
        );

        const response = await app.request(`/${sourceAgent.id}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "Use [docs helper](birdhouse:skill/find-docs) before replying",
          }),
        });

        expect(response.status).toBe(200);
      });

      expect(capturedPrompt).toBe(`Use [docs helper](birdhouse:skill/find-docs) before replying

<skill name="find-docs">
# Find Docs
</skill>`);
    });

    test("includes pasted image and pdf attachments as file parts", async () => {
      const sourceAgent = createRootAgent(agentsDB, {
        id: "agent_with_image",
        session_id: "ses_with_image",
        title: "Image Send Agent",
      });

      let capturedParts: Array<{ type: string; text?: string; url?: string; mime?: string; filename?: string }> = [];

      const mockMessage = {
        info: {
          id: "msg_response_image",
          sessionID: "ses_with_image",
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
        parts: [],
      } as Message;

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;
      deps.harness.sendMessage = async (_sessionId, _text, options) => {
        capturedParts = (options?.parts as typeof capturedParts | undefined) ?? [];
        return mockMessage;
      };

      await withDeps(deps, async () => {
        const app = await withWorkspaceContext(
          () => {
            const hono = new Hono();
            hono.post("/:id/messages", (c) => sendMessage(c, deps));
            return hono;
          },
          { agentsDb: agentsDB },
        );

        const response = await app.request(`/${sourceAgent.id}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "Look at this",
            attachments: [
              {
                type: "file",
                filename: "pasted.png",
                mime: "image/png",
                url: "data:image/png;base64,abc123",
              },
              {
                type: "file",
                filename: "notes.pdf",
                mime: "application/pdf",
                url: "data:application/pdf;base64,pdf123",
              },
            ],
          }),
        });

        expect(response.status).toBe(200);
      });

      expect(capturedParts).toEqual([
        { type: "text", text: "Look at this" },
        {
          type: "file",
          filename: "pasted.png",
          mime: "image/png",
          url: "data:image/png;base64,abc123",
        },
        {
          type: "file",
          filename: "notes.pdf",
          mime: "application/pdf",
          url: "data:application/pdf;base64,pdf123",
        },
      ]);
    });

    test("does not attach raw trigger phrase text without an explicit skill link", async () => {
      const sourceAgent = createRootAgent(agentsDB, {
        id: "agent_skill_send_raw_text",
        session_id: "ses_skill_send_raw_text",
        title: "Skill Send Raw Text Agent",
      });

      const visibleSkills: Skill[] = [
        {
          name: "find-docs",
          description: "Retrieve current docs.",
          location: "/Users/test/.claude/skills/find-docs/SKILL.md",
          content: "# Find Docs",
        },
      ];

      let capturedPrompt = "";
      const mockMessage = {
        info: {
          id: "msg_response_raw_text",
          sessionID: "ses_skill_send_raw_text",
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
            id: "part_raw_text",
            sessionID: "ses_skill_send_raw_text",
            messageID: "msg_raw_text",
          },
        ],
      } as Message;

      const deps = await createTestDeps({ listSkills: async () => visibleSkills });
      deps.agentsDB = agentsDB;
      deps.harness.sendMessage = async (_sessionId, _text, options) => {
        capturedPrompt = (options?.parts?.[0] as { text?: string } | undefined)?.text ?? "";
        return mockMessage;
      };
      deps.dataDb.setSkillTriggerPhrases("find-docs", ["docs please"]);

      await withDeps(deps, async () => {
        const app = await withWorkspaceContext(
          () => {
            const hono = new Hono();
            hono.post("/:id/messages", (c) => sendMessage(c, deps));
            return hono;
          },
          { agentsDb: agentsDB },
        );

        const response = await app.request(`/${sourceAgent.id}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "docs please before replying",
          }),
        });

        expect(response.status).toBe(200);
      });

      expect(capturedPrompt).toBe("docs please before replying");
    });

    test("inserts timeline events and emits SSE when clone_and_send is true", async () => {
      // Create source agent
      const sourceAgent = createRootAgent(agentsDB, {
        id: "agent_source",
        session_id: "ses_source",
        title: "Source Agent",
      });

      const mockMessage = {
        info: {
          id: "msg_response",
          sessionID: "ses_fork_123",
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
            sessionID: "ses_fork_123",
            messageID: "msg_1",
          },
        ],
      } as Message;

      const deps = await createTestDeps({ forkSession: mockForkSession });
      deps.agentsDB = agentsDB;
      deps.harness.sendMessage = async () => mockMessage;

      await withDeps(deps, async () => {
        const { events, cleanup } = await captureStreamEvents();

        const app = await withWorkspaceContext(
          () => {
            const hono = new Hono();
            hono.post("/:id/messages", (c) => sendMessage(c, deps));
            return hono;
          },
          { agentsDb: agentsDB },
        );

        const response = await app.request(`/${sourceAgent.id}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "Test message",
            clone_and_send: true,
          }),
        });

        expect(response.status).toBe(200);
        const result = (await response.json()) as { cloned_agent: { id: string; title: string } };
        expect(result.cloned_agent).toBeDefined();

        const clonedAgentId = result.cloned_agent.id;

        // Verify parent event (source agent timeline)
        const sourceEvents = agentsDB.getEventsByAgentId(sourceAgent.id);
        expect(sourceEvents).toHaveLength(1);
        expect(sourceEvents[0].event_type).toBe("clone_created");
        expect(sourceEvents[0].actor_agent_id).toBeNull(); // Human-initiated
        expect(sourceEvents[0].source_agent_id).toBe(sourceAgent.id);
        expect(sourceEvents[0].target_agent_id).toBe(clonedAgentId);
        // Title generation completes synchronously in tests, so event has generated title
        expect(sourceEvents[0].target_agent_title).toBe("Mock Generated Title");

        // Verify child event (cloned agent timeline)
        const clonedEvents = agentsDB.getEventsByAgentId(clonedAgentId);
        expect(clonedEvents).toHaveLength(1);
        expect(clonedEvents[0].event_type).toBe("clone_created");
        expect(clonedEvents[0].actor_agent_id).toBeNull(); // Human-initiated
        expect(clonedEvents[0].source_agent_id).toBe(sourceAgent.id);
        expect(clonedEvents[0].source_agent_title).toBe("Source Agent");
        expect(clonedEvents[0].target_agent_id).toBe(clonedAgentId);

        // Verify SSE events were emitted
        const eventCreatedEvents = events.filter((e) => e.type === "birdhouse.event.created");
        expect(eventCreatedEvents).toHaveLength(2); // Parent + child events

        // Verify parent SSE event
        const parentSSE = eventCreatedEvents.find((e) => e.properties.agentId === sourceAgent.id);
        expect(parentSSE).toBeDefined();
        expect(parentSSE?.properties.event).toMatchObject({
          event_type: "clone_created",
          actor_agent_id: null,
          source_agent_id: sourceAgent.id,
          target_agent_id: clonedAgentId,
          target_agent_title: result.cloned_agent.title,
        });

        // Verify child SSE event
        const childSSE = eventCreatedEvents.find((e) => e.properties.agentId === clonedAgentId);
        expect(childSSE).toBeDefined();
        expect(childSSE?.properties.event).toMatchObject({
          event_type: "clone_created",
          actor_agent_id: null,
          source_agent_id: sourceAgent.id,
          source_agent_title: "Source Agent",
          target_agent_id: clonedAgentId,
        });

        cleanup();
      });
    });

    test("does NOT insert events when clone_and_send is false", async () => {
      const sourceAgent = createRootAgent(agentsDB, {
        id: "agent_no_clone",
        session_id: "ses_no_clone",
        title: "No Clone Agent",
      });

      const mockMessage = {
        info: {
          id: "msg_response",
          sessionID: "ses_no_clone",
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
            sessionID: "ses_no_clone",
            messageID: "msg_1",
          },
        ],
      } as Message;

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;
      deps.harness.sendMessage = async () => mockMessage;

      await withDeps(deps, async () => {
        const app = await withWorkspaceContext(
          () => {
            const hono = new Hono();
            hono.post("/:id/messages", (c) => sendMessage(c, deps));
            return hono;
          },
          { agentsDb: agentsDB },
        );

        const response = await app.request(`/${sourceAgent.id}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "Test message",
            clone_and_send: false,
          }),
        });

        expect(response.status).toBe(200);

        // Verify NO events were inserted
        const sourceEvents = agentsDB.getEventsByAgentId(sourceAgent.id);
        expect(sourceEvents).toHaveLength(0);
      });
    });

    test("does not forward noReply in async endpoint mode", async () => {
      const sourceAgent = createRootAgent(agentsDB, {
        id: "agent_async_no_reply",
        session_id: "ses_async_no_reply",
        title: "Async No Reply Agent",
      });

      let capturedNoReply: boolean | undefined;
      const mockMessage = {
        info: {
          id: "msg_async_no_reply",
          sessionID: "ses_async_no_reply",
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
        parts: [],
      } as Message;

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;
      deps.harness.sendMessage = async (_sessionId, _text, options) => {
        capturedNoReply = options?.noReply;
        return mockMessage;
      };

      await withDeps(deps, async () => {
        const app = await withWorkspaceContext(
          () => {
            const hono = new Hono();
            hono.post("/:id/messages", (c) => sendMessage(c, deps));
            return hono;
          },
          { agentsDb: agentsDB },
        );

        const response = await app.request(`/${sourceAgent.id}/messages?wait=false`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: "hello async",
          }),
        });

        expect(response.status).toBe(200);
      });

      expect(capturedNoReply).toBeUndefined();
    });
  });
});
