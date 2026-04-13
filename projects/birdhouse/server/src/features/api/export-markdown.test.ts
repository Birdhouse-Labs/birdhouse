// ABOUTME: Tests for markdown export endpoint
// ABOUTME: Validates formatting of messages, events, and HTTP response structure

import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createTestDeps, withDeps } from "../../dependencies";
import type { BirdhouseMessage as Message } from "../../harness";
import { initAgentsDB } from "../../lib/agents-db";
import { createRootAgent } from "../../test-utils/agent-factories";
import { exportMarkdown } from "./export-markdown";

describe("exportMarkdown", () => {
  test("returns 404 when agent not found", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = new Hono();
      app.get("/:id/export", (c) => exportMarkdown(c, deps));

      const response = await app.request("/nonexistent/export");

      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("Agent nonexistent not found");
    });
  });

  test("exports empty timeline with placeholder message", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const agent = createRootAgent(agentsDB, {
      session_id: "ses_test",
      id: "agent_test",
      created_at: 1704067200000,
      updated_at: 1704153600000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = new Hono();
      app.get("/:id/export", (c) => exportMarkdown(c, deps));

      const response = await app.request(`/${agent.id}/export`);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
      expect(response.headers.get("Content-Disposition")).toMatch(
        /^attachment; filename="test-agent-\d{4}-\d{2}-\d{2}-\d{4}\.md"$/,
      );

      const markdown = await response.text();
      expect(markdown).toContain("# Test Agent");
      expect(markdown).toContain(`**Agent ID:** ${agent.id}`);
      expect(markdown).toContain("_No messages or events yet._");
    });
  });

  test("formats human user message correctly", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const agent = createRootAgent(agentsDB, {
      session_id: "ses_test",
      id: "agent_test",
    });

    const userMessage = {
      info: {
        id: "msg_user",
        sessionID: agent.session_id,
        role: "user",
        time: { created: 1704067200000 },
        model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
        agent: "birdhouse",
      },
      parts: [
        {
          type: "text",
          text: "Hello, please help me with this task.",
          id: "part_1",
          sessionID: agent.session_id,
          messageID: "msg_user",
        },
      ],
    } as Message;

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness.getMessages = async () => [userMessage];

    await withDeps(deps, async () => {
      const app = new Hono();
      app.get("/:id/export", (c) => exportMarkdown(c, deps));

      const response = await app.request(`/${agent.id}/export`);
      const markdown = await response.text();

      expect(markdown).toContain("## User");
      expect(markdown).toContain("Hello, please help me with this task.");
      expect(markdown).not.toContain("From Agent");
    });
  });

  test("formats agent-sent message with metadata", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const agent = createRootAgent(agentsDB, {
      session_id: "ses_test",
      id: "agent_test",
    });

    const agentMessage = {
      info: {
        id: "msg_user",
        sessionID: agent.session_id,
        role: "user",
        time: { created: 1704067200000 },
        model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
        agent: "birdhouse",
      },
      parts: [
        {
          type: "text",
          text: "I've completed the analysis.",
          id: "part_1",
          sessionID: agent.session_id,
          messageID: "msg_user",
          metadata: {
            sent_by_agent_id: "agent_sender",
            sent_by_agent_title: "Sender Agent",
          },
        },
      ],
    } as Message;

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness.getMessages = async () => [agentMessage];

    await withDeps(deps, async () => {
      const app = new Hono();
      app.get("/:id/export", (c) => exportMarkdown(c, deps));

      const response = await app.request(`/${agent.id}/export`);
      const markdown = await response.text();

      expect(markdown).toContain("## From Agent [Sender Agent](birdhouse:agent/agent_sender)");
      expect(markdown).toContain("I've completed the analysis.");
    });
  });

  test("formats assistant message with duration", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const agent = createRootAgent(agentsDB, {
      session_id: "ses_test",
      id: "agent_test",
    });

    const assistantMessage = {
      info: {
        id: "msg_assistant",
        sessionID: agent.session_id,
        role: "assistant",
        time: { created: 1704067200000, completed: 1704067205400 }, // 5.4s duration
        parentID: "msg_user",
        modelID: "claude-sonnet-4-5",
        providerID: "anthropic",
        mode: "build",
        cost: 0,
        tokens: {
          input: 1000,
          output: 500,
          reasoning: 200,
          cache: { read: 500, write: 100 },
        },
        path: { cwd: "/test", root: "/" },
      },
      parts: [
        {
          type: "text",
          text: "I'll help you with that task.",
          id: "part_1",
          sessionID: agent.session_id,
          messageID: "msg_assistant",
        },
      ],
    } as Message;

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness.getMessages = async () => [assistantMessage];

    await withDeps(deps, async () => {
      const app = new Hono();
      app.get("/:id/export", (c) => exportMarkdown(c, deps));

      const response = await app.request(`/${agent.id}/export`);
      const markdown = await response.text();

      expect(markdown).toContain("## Assistant (claude-sonnet-4-5 · anthropic · 5.4s)");
      expect(markdown).toContain("I'll help you with that task.");
    });
  });

  test("formats assistant message without duration when not completed", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const agent = createRootAgent(agentsDB, {
      session_id: "ses_test",
      id: "agent_test",
    });

    const assistantMessage = {
      info: {
        id: "msg_assistant",
        sessionID: agent.session_id,
        role: "assistant",
        time: { created: 1704067200000 }, // No completed time
        parentID: "msg_user",
        modelID: "claude-sonnet-4-5",
        providerID: "anthropic",
        mode: "build",
        cost: 0,
        tokens: {
          input: 1000,
          output: 500,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        path: { cwd: "/test", root: "/" },
      },
      parts: [
        {
          type: "text",
          text: "Working on it...",
          id: "part_1",
          sessionID: agent.session_id,
          messageID: "msg_assistant",
        },
      ],
    } as Message;

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness.getMessages = async () => [assistantMessage];

    await withDeps(deps, async () => {
      const app = new Hono();
      app.get("/:id/export", (c) => exportMarkdown(c, deps));

      const response = await app.request(`/${agent.id}/export`);
      const markdown = await response.text();

      expect(markdown).toContain("## Assistant (claude-sonnet-4-5 · anthropic)");
      expect(markdown).not.toContain(" · 0.0s");
    });
  });

  test("formats tool call with completed status", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const agent = createRootAgent(agentsDB, {
      session_id: "ses_test",
      id: "agent_test",
    });

    const assistantMessage = {
      info: {
        id: "msg_assistant",
        sessionID: agent.session_id,
        role: "assistant",
        time: { created: 1704067200000, completed: 1704067203000 },
        parentID: "msg_user",
        modelID: "claude-sonnet-4-5",
        providerID: "anthropic",
        mode: "build",
        cost: 0,
        tokens: {
          input: 1000,
          output: 500,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        path: { cwd: "/test", root: "/" },
      },
      parts: [
        {
          type: "tool",
          tool: "bash",
          callID: "call_1",
          id: "part_1",
          sessionID: agent.session_id,
          messageID: "msg_assistant",
          state: {
            status: "completed",
            input: {
              command: "ls -la",
              description: "List files",
            },
            output: "total 8\ndrwxr-xr-x  2 user  staff   64 Jan  1 00:00 .",
            title: "bash",
            metadata: {},
            time: {
              start: 1704067200000,
              end: 1704067201000,
            },
          },
        },
      ],
    } as Message;

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness.getMessages = async () => [assistantMessage];

    await withDeps(deps, async () => {
      const app = new Hono();
      app.get("/:id/export", (c) => exportMarkdown(c, deps));

      const response = await app.request(`/${agent.id}/export`);
      const markdown = await response.text();

      expect(markdown).toContain("Tool: bash");
      expect(markdown).toContain("**Input:**");
      expect(markdown).toContain('"command": "ls -la"');
      expect(markdown).toContain("**Output:**");
      expect(markdown).toContain("total 8");
    });
  });

  test("formats tool call with error status", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const agent = createRootAgent(agentsDB, {
      session_id: "ses_test",
      id: "agent_test",
    });

    const assistantMessage = {
      info: {
        id: "msg_assistant",
        sessionID: agent.session_id,
        role: "assistant",
        time: { created: 1704067200000, completed: 1704067203000 },
        parentID: "msg_user",
        modelID: "claude-sonnet-4-5",
        providerID: "anthropic",
        mode: "build",
        cost: 0,
        tokens: {
          input: 1000,
          output: 500,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        path: { cwd: "/test", root: "/" },
      },
      parts: [
        {
          type: "tool",
          tool: "read",
          callID: "call_1",
          id: "part_1",
          sessionID: agent.session_id,
          messageID: "msg_assistant",
          state: {
            status: "error",
            input: {
              filePath: "/nonexistent/file.txt",
            },
            error: "File not found: /nonexistent/file.txt",
            time: {
              start: 1704067200000,
              end: 1704067201000,
            },
          },
        },
      ],
    } as Message;

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness.getMessages = async () => [assistantMessage];

    await withDeps(deps, async () => {
      const app = new Hono();
      app.get("/:id/export", (c) => exportMarkdown(c, deps));

      const response = await app.request(`/${agent.id}/export`);
      const markdown = await response.text();

      expect(markdown).toContain("Tool: read");
      expect(markdown).toContain("**Error:**");
      expect(markdown).toContain("File not found");
    });
  });

  test("formats system event (clone_created)", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const agent = createRootAgent(agentsDB, {
      session_id: "ses_test",
      id: "agent_test",
    });

    // Create the agents referenced in the event (FK constraints)
    const actorAgent = createRootAgent(agentsDB, {
      session_id: "ses_actor",
      id: "agent_actor",
      title: "Actor Agent",
    });

    const sourceAgent = createRootAgent(agentsDB, {
      session_id: "ses_source",
      id: "agent_source",
      title: "Source Agent",
    });

    const targetAgent = createRootAgent(agentsDB, {
      session_id: "ses_target",
      id: "agent_target",
      title: "Target Agent",
    });

    agentsDB.insertEvent({
      agent_id: agent.id,
      event_type: "clone_created",
      timestamp: 1704067200000,
      actor_agent_id: actorAgent.id,
      actor_agent_title: "Actor Agent",
      source_agent_id: sourceAgent.id,
      source_agent_title: "Source Agent",
      target_agent_id: targetAgent.id,
      target_agent_title: "Target Agent",
      metadata: null,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = new Hono();
      app.get("/:id/export", (c) => exportMarkdown(c, deps));

      const response = await app.request(`/${agent.id}/export`);
      const markdown = await response.text();

      expect(markdown).toContain("## System Event");
      expect(markdown).toContain("**Agent [Actor Agent](birdhouse:agent/");
      expect(markdown).toContain("cloned");
      expect(markdown).toContain("**[Source Agent](birdhouse:agent/");
      expect(markdown).toContain("to create");
      expect(markdown).toContain("**[Target Agent](birdhouse:agent/");
    });
  });

  test("generates valid filename from title with special characters", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const agent = createRootAgent(agentsDB, {
      session_id: "ses_test",
      id: "agent_test",
      title: "Fix: API/HTTP Errors!",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = new Hono();
      app.get("/:id/export", (c) => exportMarkdown(c, deps));

      const response = await app.request(`/${agent.id}/export`);

      const disposition = response.headers.get("Content-Disposition");
      expect(disposition).not.toBeNull();
      const filename = disposition?.match(/filename="(.+)"/)?.[1];
      expect(filename).toMatch(/^fix-api-http-errors-\d{4}-\d{2}-\d{2}-\d{4}\.md$/);
    });
  });
});
