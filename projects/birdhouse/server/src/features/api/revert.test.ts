// ABOUTME: Tests for revert/unrevert endpoints that reset agent to a specific message
// ABOUTME: Verifies reverting to user messages, extracting message text, and error cases

import { beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createTestDeps, withDeps } from "../../dependencies";
import { createTestAgentHarness, type BirdhouseMessage as Message } from "../../harness";
import { type AgentsDB, initAgentsDB } from "../../lib/agents-db";
import { createRootAgent, withWorkspaceContext } from "../../test-utils";
import { revert, unrevert } from "./revert";

describe("API revert", () => {
  let agentsDB: AgentsDB;

  beforeEach(async () => {
    agentsDB = await initAgentsDB(":memory:");
  });

  test("reverts to user message and returns message text", async () => {
    // Create agent
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    // Mock messages with a user message to revert to
    const mockMessages = [
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
    ] as Message[];

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness.getMessages = async () => mockMessages;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(
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
      const data = (await response.json()) as {
        success: boolean;
        messageText: string;
        attachments: Array<{ type: "file"; mime: string; url: string; filename?: string }>;
      };
      expect(data.success).toBe(true);
      expect(data.messageText).toBe("Please help me debug this");
      expect(data.attachments).toEqual([]);
    });
  });

  test("returns image and pdf attachments from the reverted user message", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_with_image_reset",
      session_id: "ses_with_image_reset",
      title: "Test Agent",
    });

    const mockMessages = [
      {
        info: {
          id: "msg_user_with_image",
          sessionID: "ses_with_image_reset",
          role: "user",
          time: { created: Date.now() },
        } as unknown as Message["info"],
        parts: [
          {
            type: "text",
            text: "Please inspect this screenshot",
            id: "part_text",
            sessionID: "ses_with_image_reset",
            messageID: "msg_user_with_image",
          },
          {
            type: "file",
            mime: "image/png",
            url: "data:image/png;base64,abc123",
            filename: "screenshot.png",
            id: "part_file",
            sessionID: "ses_with_image_reset",
            messageID: "msg_user_with_image",
          },
          {
            type: "file",
            mime: "application/pdf",
            url: "data:application/pdf;base64,pdf123",
            filename: "notes.pdf",
            id: "part_pdf",
            sessionID: "ses_with_image_reset",
            messageID: "msg_user_with_image",
          },
        ],
      },
    ] as Message[];

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness.getMessages = async () => mockMessages;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(
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
        body: JSON.stringify({ messageId: "msg_user_with_image" }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        success: boolean;
        messageText: string;
        attachments: Array<{ type: "file"; mime: string; url: string; filename?: string }>;
      };
      expect(data.success).toBe(true);
      expect(data.messageText).toBe("Please inspect this screenshot");
      expect(data.attachments).toEqual([
        {
          type: "file",
          mime: "image/png",
          url: "data:image/png;base64,abc123",
          filename: "screenshot.png",
        },
        {
          type: "file",
          mime: "application/pdf",
          url: "data:application/pdf;base64,pdf123",
          filename: "notes.pdf",
        },
      ]);
    });
  });

  test("returns 404 for non-existent agent", async () => {
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(
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

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness.getMessages = async () => []; // No messages

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(
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

  test("returns 501 when revert capability is absent", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness = createTestAgentHarness({ enableRevert: false });

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(
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

      expect(response.status).toBe(501);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("Revert not supported by harness");
    });
  });

  test("returns 400 when reverting to non-user message", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    // Mock messages with assistant message
    const mockMessages = [
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
    ] as Message[];

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness.getMessages = async () => mockMessages;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(
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
  let agentsDB: AgentsDB;

  beforeEach(async () => {
    agentsDB = await initAgentsDB(":memory:");
  });

  test("unreverts a reverted session", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(
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
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(
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

  test("returns 501 when unrevert capability is absent", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness = createTestAgentHarness({ enableRevert: false });

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(
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

      expect(response.status).toBe(501);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("Revert not supported by harness");
    });
  });
});
