// ABOUTME: Tests for the message search endpoint — verifies response shape, param validation, and agent ID lookup
// ABOUTME: Uses injectable searchMessages dep so tests don't need a real OpenCode SQLite file

import { describe, expect, test } from "bun:test";
import { createTestDeps, withDeps } from "../../dependencies";
import { initAgentsDB } from "../../lib/agents-db";
import type { MessageSearchResult } from "../../lib/search-opencode-messages";
import { createTestApp } from "../../test-utils";
import { createRootAgent } from "../../test-utils/agent-factories";
import { searchMessages } from "./search-messages";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION_ID = "ses_abc123";
const AGENT_ID = "agent_abc123";
const MSG_ID = "msg_001";
const CTX_ID = "msg_000";

function makeTextResult(overrides?: Partial<MessageSearchResult>): MessageSearchResult {
  return {
    sessionId: SESSION_ID,
    matchedMessage: {
      id: MSG_ID,
      role: "assistant",
      parts: [{ type: "text", text: "hello world" }],
    },
    contextMessage: {
      id: CTX_ID,
      role: "user",
      parts: [{ type: "text", text: "say hello" }],
    },
    matchedAt: 1234567890,
    ...overrides,
  };
}

function makeToolResult(): MessageSearchResult {
  return {
    sessionId: SESSION_ID,
    matchedMessage: {
      id: MSG_ID,
      role: "assistant",
      parts: [{ type: "tool", toolName: "bash", command: "ls -la", output: "total 42" }],
    },
    contextMessage: null,
    matchedAt: 1234567890,
  };
}

// ── Helper to build app + deps ────────────────────────────────────────────────

async function buildApp(searchReturnValue: MessageSearchResult[] | null, agentSessionId?: string) {
  const agentsDB = await initAgentsDB(":memory:");

  if (agentSessionId) {
    createRootAgent(agentsDB, {
      id: AGENT_ID,
      title: "Test Agent",
      session_id: agentSessionId,
    });
  }

  const deps = await createTestDeps();
  deps.agentsDB = agentsDB;
  deps.searchMessages = () => searchReturnValue;

  const app = await createTestApp({ agentsDb: agentsDB });

  return { app, deps };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("searchMessages - GET /search", () => {
  test("returns 400 when q param is missing", async () => {
    const { app, deps } = await buildApp([]);

    await withDeps(deps, async () => {
      app.get("/search", (c) => searchMessages(c, deps));
      const res = await app.request("/search");
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("q");
    });
  });

  test("returns 400 when q param is empty string", async () => {
    const { app, deps } = await buildApp([]);

    await withDeps(deps, async () => {
      app.get("/search", (c) => searchMessages(c, deps));
      const res = await app.request("/search?q=");
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("q");
    });
  });

  test("returns empty results when searchMessages returns empty array", async () => {
    const { app, deps } = await buildApp([]);

    await withDeps(deps, async () => {
      app.get("/search", (c) => searchMessages(c, deps));
      const res = await app.request("/search?q=hello");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: unknown[] };
      expect(body.results).toEqual([]);
    });
  });

  test("returns empty results when searchMessages returns null (DB not found)", async () => {
    const { app, deps } = await buildApp(null);

    await withDeps(deps, async () => {
      app.get("/search", (c) => searchMessages(c, deps));
      const res = await app.request("/search?q=hello");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: unknown[] };
      expect(body.results).toEqual([]);
    });
  });

  test("returns matched message with text parts", async () => {
    const { app, deps } = await buildApp([makeTextResult()], SESSION_ID);

    await withDeps(deps, async () => {
      app.get("/search", (c) => searchMessages(c, deps));
      const res = await app.request("/search?q=hello");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { results: ReturnType<typeof makeExpectedResult>[] };
      expect(body.results).toHaveLength(1);

      const result = body.results[0];
      expect(result.agentId).toBe(AGENT_ID);
      expect(result.sessionId).toBe(SESSION_ID);
      expect(result.matchedMessage.id).toBe(MSG_ID);
      expect(result.matchedMessage.role).toBe("assistant");
      expect(result.matchedMessage.parts).toEqual([{ type: "text", text: "hello world" }]);
      expect(result.contextMessage?.id).toBe(CTX_ID);
      expect(result.contextMessage?.role).toBe("user");
      expect(result.matchedAt).toBe(1234567890);
    });
  });

  test("returns agentId as null when session has no matching agent", async () => {
    // searchMessages returns a result for SESSION_ID, but no agent is registered for it
    const { app, deps } = await buildApp([makeTextResult()]);

    await withDeps(deps, async () => {
      app.get("/search", (c) => searchMessages(c, deps));
      const res = await app.request("/search?q=hello");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { results: { agentId: string | null }[] };
      expect(body.results[0].agentId).toBeNull();
    });
  });

  test("returns tool parts with toolName, command, and output", async () => {
    const { app, deps } = await buildApp([makeToolResult()], SESSION_ID);

    await withDeps(deps, async () => {
      app.get("/search", (c) => searchMessages(c, deps));
      const res = await app.request("/search?q=ls");
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        results: {
          matchedMessage: { parts: { type: string; toolName?: string; command?: string; output?: string }[] };
        }[];
      };
      const parts = body.results[0].matchedMessage.parts;
      expect(parts).toHaveLength(1);
      expect(parts[0].type).toBe("tool");
      expect(parts[0].toolName).toBe("bash");
      expect(parts[0].command).toBe("ls -la");
      expect(parts[0].output).toBe("total 42");
    });
  });

  test("null contextMessage is preserved in response", async () => {
    const { app, deps } = await buildApp([makeToolResult()]);

    await withDeps(deps, async () => {
      app.get("/search", (c) => searchMessages(c, deps));
      const res = await app.request("/search?q=ls");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { results: { contextMessage: null }[] };
      expect(body.results[0].contextMessage).toBeNull();
    });
  });

  test("respects limit param and passes it to searchMessages", async () => {
    let capturedLimit = 0;
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.searchMessages = (_wsId, _query, limit) => {
      capturedLimit = limit;
      return [];
    };

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.get("/search", (c) => searchMessages(c, deps));
      await app.request("/search?q=hello&limit=5");
      expect(capturedLimit).toBe(5);
    });
  });

  test("defaults limit to 20 when not provided", async () => {
    let capturedLimit = 0;
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.searchMessages = (_wsId, _query, limit) => {
      capturedLimit = limit;
      return [];
    };

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.get("/search", (c) => searchMessages(c, deps));
      await app.request("/search?q=hello");
      expect(capturedLimit).toBe(20);
    });
  });

  test("returns results from multiple sessions", async () => {
    const results = [
      makeTextResult({ sessionId: "ses_aaa" }),
      makeTextResult({ sessionId: "ses_bbb", matchedAt: 9999999999 }),
    ];

    const agentsDB = await initAgentsDB(":memory:");
    createRootAgent(agentsDB, { id: "agent_aaa", title: "A", session_id: "ses_aaa" });
    createRootAgent(agentsDB, { id: "agent_bbb", title: "B", session_id: "ses_bbb" });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.searchMessages = () => results;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.get("/search", (c) => searchMessages(c, deps));
      const res = await app.request("/search?q=hello");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { results: { agentId: string; sessionId: string }[] };
      expect(body.results).toHaveLength(2);
      expect(body.results.map((r) => r.sessionId)).toContain("ses_aaa");
      expect(body.results.map((r) => r.sessionId)).toContain("ses_bbb");
    });
  });

  test("passes workspaceId from context to searchMessages", async () => {
    let capturedWorkspaceId = "";
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.searchMessages = (wsId, _query, _limit) => {
      capturedWorkspaceId = wsId;
      return [];
    };

    const { createMockWorkspace } = await import("../../test-utils/workspace-context");
    const workspace = createMockWorkspace({ workspace_id: "ws_test123" });

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB, workspace });
      app.get("/search", (c) => searchMessages(c, deps));
      await app.request("/search?q=hello");
      expect(capturedWorkspaceId).toBe("ws_test123");
    });
  });
});

// Unused but kept for type-checking the shape
function makeExpectedResult() {
  return {
    agentId: AGENT_ID as string | null,
    sessionId: SESSION_ID,
    title: "Test Agent" as string | null,
    matchedMessage: {
      id: MSG_ID,
      role: "assistant",
      parts: [{ type: "text", text: "hello world" }] as { type: string; text?: string }[],
    },
    contextMessage: {
      id: CTX_ID,
      role: "user",
      parts: [{ type: "text", text: "say hello" }] as { type: string; text?: string }[],
    } as null | { id: string; role: string; parts: { type: string; text?: string }[] },
    matchedAt: 1234567890,
  };
}
