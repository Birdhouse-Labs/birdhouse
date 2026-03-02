// ABOUTME: Tests for revert/unrevert endpoints that reset agent to a specific message
// ABOUTME: Verifies reverting to user messages, extracting message text, and error cases

import { beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createTestDeps, withDeps } from "../../dependencies";
import { createAgentsDB } from "../../lib/agents-db";
import type { Message } from "../../lib/opencode-client";
import { createRootAgent, withWorkspaceContext } from "../../test-utils";
import { revert, unrevert } from "./revert";

describe("API revert", () => {
  let agentsDB: ReturnType<typeof createAgentsDB>;

  beforeEach(() => {
    agentsDB = createAgentsDB(":memory:");
  });

  test("reverts to user message and returns message text", async () => {
    // Create agent
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    // Mock messages with a user message to revert to
    const mockMessages: Message[] = [
      {
        info: {
          id: "msg_user_1",
          sessionID: "ses_1",
          role: "user",
          time: { created: Date.now() },
        } as unknown as Message["info"],
        parts: [
          {
            type: "text",
            text: "Please help me debug this",
            id: "part_1",
            sessionID: "ses_1",
            messageID: "msg_user_1",
          },
        ],
      },
      {
        info: {
          id: "msg_assistant_1",
          sessionID: "ses_1",
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user_1",
          modelID: "claude-sonnet-4",
          providerID: "anthropic",
          mode: "build",
          cost: 0,
          tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } },
          path: { cwd: "/", root: "/" },
        },
        parts: [
          {
            type: "text",
            text: "Sure, I'll help",
            id: "part_2",
            sessionID: "ses_1",
            messageID: "msg_assistant_1",
          },
        ],
      },
    ];

    const deps = createTestDeps();
    deps.agentsDB = agentsDB;
    deps.opencode.getMessages = async () => mockMessages;

    await withDeps(deps, async () => {
      const app = withWorkspaceContext(
        () => {
          const hono = new Hono();
          hono.post("/:id/revert", (c) => revert(c, deps));
          return hono;
        },
        { agentsDb: agentsDB },
      );

      const response = await app.request(`/${agent.id}/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: "msg_user_1" }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { success: boolean; messageText: string };
      expect(data.success).toBe(true);
      expect(data.messageText).toBe("Please help me debug this");
    });
  });

  test("returns 404 for non-existent agent", async () => {
    const deps = createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = withWorkspaceContext(
        () => {
          const hono = new Hono();
          hono.post("/:id/revert", (c) => revert(c, deps));
          return hono;
        },
        { agentsDb: agentsDB },
      );

      const response = await app.request("/agent_nonexistent/revert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: "msg_123" }),
      });

      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("not found");
    });
  });

  test("returns 404 for non-existent message", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    const deps = createTestDeps();
    deps.agentsDB = agentsDB;
    deps.opencode.getMessages = async () => []; // No messages

    await withDeps(deps, async () => {
      const app = withWorkspaceContext(
        () => {
          const hono = new Hono();
          hono.post("/:id/revert", (c) => revert(c, deps));
          return hono;
        },
        { agentsDb: agentsDB },
      );

      const response = await app.request(`/${agent.id}/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: "msg_nonexistent" }),
      });

      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("Message");
      expect(data.error).toContain("not found");
    });
  });

  test("returns 400 when reverting to non-user message", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    // Mock messages with assistant message
    const mockMessages: Message[] = [
      {
        info: {
          id: "msg_assistant_1",
          sessionID: "ses_1",
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user",
          modelID: "claude-sonnet-4",
          providerID: "anthropic",
          mode: "build",
          cost: 0,
          tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } },
          path: { cwd: "/", root: "/" },
        },
        parts: [
          {
            type: "text",
            text: "Assistant response",
            id: "part_1",
            sessionID: "ses_1",
            messageID: "msg_assistant_1",
          },
        ],
      },
    ];

    const deps = createTestDeps();
    deps.agentsDB = agentsDB;
    deps.opencode.getMessages = async () => mockMessages;

    await withDeps(deps, async () => {
      const app = withWorkspaceContext(
        () => {
          const hono = new Hono();
          hono.post("/:id/revert", (c) => revert(c, deps));
          return hono;
        },
        { agentsDb: agentsDB },
      );

      const response = await app.request(`/${agent.id}/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: "msg_assistant_1" }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("user message");
    });
  });
});

describe("API unrevert", () => {
  let agentsDB: ReturnType<typeof createAgentsDB>;

  beforeEach(() => {
    agentsDB = createAgentsDB(":memory:");
  });

  test("unreverts a reverted session", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    const deps = createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = withWorkspaceContext(
        () => {
          const hono = new Hono();
          hono.post("/:id/unrevert", (c) => unrevert(c, deps));
          return hono;
        },
        { agentsDb: agentsDB },
      );

      const response = await app.request(`/${agent.id}/unrevert`, {
        method: "POST",
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { success: boolean };
      expect(data.success).toBe(true);
    });
  });

  test("returns 404 for non-existent agent", async () => {
    const deps = createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = withWorkspaceContext(
        () => {
          const hono = new Hono();
          hono.post("/:id/unrevert", (c) => unrevert(c, deps));
          return hono;
        },
        { agentsDb: agentsDB },
      );

      const response = await app.request("/agent_nonexistent/unrevert", {
        method: "POST",
      });

      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("not found");
    });
  });
});
