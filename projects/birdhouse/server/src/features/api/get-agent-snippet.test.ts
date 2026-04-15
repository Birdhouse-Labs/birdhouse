// ABOUTME: Tests for GET /api/agents/:id/messages/snippet
// ABOUTME: Verifies response shape, 404 on unknown agent, and graceful empty-message handling

import { describe, expect, test } from "bun:test";
import { createTestDeps } from "../../dependencies";
import type { BirdhouseMessage as Message } from "../../harness";
import { initAgentsDB } from "../../lib/agents-db";
import { createTestApp } from "../../test-utils";
import { createRootAgent } from "../../test-utils/agent-factories";
import { getAgentSnippet } from "./get-agent-snippet";

const SESSION_ID = "ses_snippet_test";
const AGENT_ID = "agent_snippet_test";

interface SnippetResponse {
  lastMessageAt: number | null;
  lastUserMessage: {
    text: string;
    isAgentSent: boolean;
    sentByAgentTitle?: string;
  } | null;
  lastAgentMessage: string | null;
}

function makeUserMessage(id: string, created: number, text: string, metadata?: Record<string, unknown>): Message {
  return {
    info: { id, sessionID: SESSION_ID, role: "user", time: { created } },
    parts: [
      {
        id: `${id}_part`,
        sessionID: SESSION_ID,
        messageID: id,
        type: "text",
        text,
        ...(metadata ? { metadata } : {}),
      },
    ],
  };
}

function makeAssistantMessage(id: string, created: number, text: string): Message {
  return {
    info: {
      id,
      sessionID: SESSION_ID,
      role: "assistant",
      time: { created },
      parentID: `${id}_parent`,
      modelID: "claude-sonnet-4",
      providerID: "anthropic",
    },
    parts: [{ id: `${id}_part`, sessionID: SESSION_ID, messageID: id, type: "text", text }],
  };
}

async function buildApp(messages: Message[] = []) {
  const agentsDB = await initAgentsDB(":memory:");

  createRootAgent(agentsDB, {
    id: AGENT_ID,
    session_id: SESSION_ID,
    title: "Snippet Test Agent",
  });

  const deps = await createTestDeps();
  deps.agentsDB = agentsDB;
  deps.harness.getMessages = async () => messages;

  const app = await createTestApp({ agentsDb: agentsDB });
  app.get("/:id/messages/snippet", (c) => getAgentSnippet(c, deps));

  return { app };
}

describe("getAgentSnippet - GET /:id/messages/snippet", () => {
  test("returns 404 for unknown agent", async () => {
    const { app } = await buildApp();

    const res = await app.request("/agent_unknown/messages/snippet");
    expect(res.status).toBe(404);
  });

  test("returns null fields when agent has no messages", async () => {
    const { app } = await buildApp([]);

    const res = await app.request(`/${AGENT_ID}/messages/snippet`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as SnippetResponse;
    expect(body.lastMessageAt).toBeNull();
    expect(body.lastUserMessage).toBeNull();
    expect(body.lastAgentMessage).toBeNull();
  });

  test("returns lastAgentMessage from last assistant message", async () => {
    const messages = [
      makeUserMessage("msg_user", 1000, "hello"),
      makeAssistantMessage("msg_asst", 2000, "Hi there, how can I help?"),
    ];

    const { app } = await buildApp(messages);
    const res = await app.request(`/${AGENT_ID}/messages/snippet`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as SnippetResponse;
    expect(body.lastMessageAt).toBe(2000);
    expect(body.lastAgentMessage).toBe("Hi there, how can I help?");
    expect(body.lastUserMessage?.text).toBe("hello");
    expect(body.lastUserMessage?.isAgentSent).toBe(false);
  });

  test("truncates long messages to 200 characters", async () => {
    const longText = "a".repeat(300);
    const messages = [makeAssistantMessage("msg_long", 1000, longText)];

    const { app } = await buildApp(messages);
    const res = await app.request(`/${AGENT_ID}/messages/snippet`);
    const body = (await res.json()) as SnippetResponse;

    expect(body.lastAgentMessage?.length).toBeLessThanOrEqual(203); // 200 + "..."
    expect(body.lastAgentMessage).toMatch(/\.\.\.$/);
  });

  test("detects agent-sent user messages via metadata", async () => {
    const messages = [
      makeUserMessage("msg_agent_sent", 1000, "reply from agent", {
        sent_by_agent_id: "agent_other",
        sent_by_agent_title: "Other Agent",
      }),
    ];

    const { app } = await buildApp(messages);
    const res = await app.request(`/${AGENT_ID}/messages/snippet`);
    const body = (await res.json()) as SnippetResponse;

    expect(body.lastUserMessage?.isAgentSent).toBe(true);
    expect(body.lastUserMessage?.sentByAgentTitle).toBe("Other Agent");
  });
});
