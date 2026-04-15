// ABOUTME: Tests for the GET /agents/recent endpoint
// ABOUTME: Verifies limit param parsing, validation, and that it constrains DB rows before message fetches

import { describe, expect, test } from "bun:test";
import { initAgentsDB } from "../../lib/agents-db";
import { createTestApp } from "../../test-utils";
import { createRootAgent } from "../../test-utils/agent-factories";
import { getRecentAgents } from "./get-recent-agents";

async function buildApp() {
  const agentsDB = await initAgentsDB(":memory:");

  const app = await createTestApp({ agentsDb: agentsDB });
  // Handler only needs agentsDB — pass a minimal deps object
  app.get("/agents/recent", (c) => getRecentAgents(c, { agentsDB }));

  return { app, agentsDB };
}

describe("getRecentAgents - GET /agents/recent", () => {
  test("returns 200 with agents array", async () => {
    const { app } = await buildApp();

    const res = await app.request("/agents/recent");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { agents: unknown[]; total: number };
    expect(Array.isArray(body.agents)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  test("accepts and applies ?limit= to constrain results", async () => {
    const { app, agentsDB } = await buildApp();

    // Insert 5 agents
    for (let i = 1; i <= 5; i++) {
      createRootAgent(agentsDB, {
        id: `agent_lim${i}`,
        session_id: `ses_lim${i}`,
        title: `Limit Test Agent ${i}`,
      });
    }

    const res = await app.request("/agents/recent?limit=2");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { agents: unknown[]; total: number };
    expect(body.agents).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  test("returns 400 when limit is not a positive integer", async () => {
    const { app } = await buildApp();

    const badValues = ["0", "-1", "abc", "1.5"];

    for (const val of badValues) {
      const res = await app.request(`/agents/recent?limit=${val}`);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("limit");
    }
  });

  test("response contains only DB fields — no message fields", async () => {
    const { app, agentsDB } = await buildApp();

    createRootAgent(agentsDB, {
      id: "agent_shape1",
      session_id: "ses_shape1",
      title: "Shape Test Agent",
    });

    const res = await app.request("/agents/recent");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { agents: Record<string, unknown>[] };
    const agent = body.agents[0];
    expect(agent).toBeDefined();
    expect(agent).toHaveProperty("id");
    expect(agent).toHaveProperty("title");
    expect(agent).toHaveProperty("session_id");
    expect(agent).toHaveProperty("parent_id");
    expect(agent).toHaveProperty("tree_id");
    expect(agent).not.toHaveProperty("lastMessageAt");
    expect(agent).not.toHaveProperty("lastUserMessage");
    expect(agent).not.toHaveProperty("lastAgentMessage");
  });

  test("omitting limit returns all recent agents without restriction", async () => {
    const { app, agentsDB } = await buildApp();

    for (let i = 1; i <= 4; i++) {
      createRootAgent(agentsDB, {
        id: `agent_nolim${i}`,
        session_id: `ses_nolim${i}`,
        title: `No Limit Agent ${i}`,
      });
    }

    const res = await app.request("/agents/recent");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { agents: unknown[]; total: number };
    expect(body.agents.length).toBeGreaterThanOrEqual(4);
  });
});
