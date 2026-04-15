// ABOUTME: Unit tests for GET /api/agents/recent endpoint
// ABOUTME: Tests recent agent listing and search filtering — DB rows only, no message fields

import { describe, expect, test } from "bun:test";
import { createTestDeps, withDeps } from "../dependencies";
import { initAgentsDB } from "../lib/agents-db";
import { withWorkspaceContext } from "../test-utils";
import { createChildAgent, createRootAgent } from "../test-utils/agent-factories";
import { createAgentRoutes } from "./agents";

interface RecentAgentResponse {
  agents: Array<{
    id: string;
    title: string;
    session_id: string;
    parent_id: string | null;
    tree_id: string;
  }>;
  total: number;
}

describe("GET /api/agents/recent - Basic behavior", () => {
  test("returns empty results when no agents exist", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/recent");

      expect(res.status).toBe(200);
      const data = (await res.json()) as RecentAgentResponse;
      expect(data).toEqual({
        agents: [],
        total: 0,
      });
    });
  });

  test("returns recent agents sorted by updated_at desc", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const older = createRootAgent(agentsDB, {
      id: "agent_older",
      session_id: "ses_older",
      title: "Older Agent",
      created_at: now - 2000,
      updated_at: now - 2000,
    });

    const newer = createRootAgent(agentsDB, {
      id: "agent_newer",
      session_id: "ses_newer",
      title: "Newer Agent",
      created_at: now - 1000,
      updated_at: now - 1000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/recent");

      expect(res.status).toBe(200);
      const data = (await res.json()) as RecentAgentResponse;
      expect(data.total).toBe(2);
      expect(data.agents).toHaveLength(2);
      // Most recent first
      expect(data.agents[0].id).toBe(newer.id);
      expect(data.agents[1].id).toBe(older.id);
    });
  });

  test("excludes archived agents", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    createRootAgent(agentsDB, {
      id: "agent_active",
      session_id: "ses_active",
      title: "Active Agent",
      created_at: now,
      updated_at: now,
    });

    const archived = createRootAgent(agentsDB, {
      id: "agent_archived",
      session_id: "ses_archived",
      title: "Archived Agent",
      created_at: now,
      updated_at: now,
    });

    // Archive the agent
    agentsDB.archiveAgent(archived.id);

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/recent");

      expect(res.status).toBe(200);
      const data = (await res.json()) as RecentAgentResponse;
      expect(data.total).toBe(1);
      expect(data.agents[0].id).toBe("agent_active");
    });
  });

  test("excludes agents older than 30 days", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    // Create a recent agent (within 30 days)
    createRootAgent(agentsDB, {
      id: "agent_recent",
      session_id: "ses_recent",
      title: "Recent Agent",
      created_at: now - 1000,
      updated_at: now - 1000,
    });

    // Create an old agent (older than 30 days)
    createRootAgent(agentsDB, {
      id: "agent_old",
      session_id: "ses_old",
      title: "Old Agent",
      created_at: now - thirtyDaysMs - 1000,
      updated_at: now - thirtyDaysMs - 1000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/recent");

      expect(res.status).toBe(200);
      const data = (await res.json()) as RecentAgentResponse;
      expect(data.total).toBe(1);
      expect(data.agents[0].id).toBe("agent_recent");
    });
  });
});

describe("GET /api/agents/recent - Search filtering", () => {
  test("filters by query matching title", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    createRootAgent(agentsDB, {
      id: "agent_database",
      session_id: "ses_database",
      title: "Database optimization",
      created_at: now,
      updated_at: now,
    });

    createRootAgent(agentsDB, {
      id: "agent_ui",
      session_id: "ses_ui",
      title: "UI redesign",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/recent?q=database");

      expect(res.status).toBe(200);
      const data = (await res.json()) as RecentAgentResponse;
      expect(data.total).toBe(1);
      expect(data.agents[0].title).toBe("Database optimization");
    });
  });

  test("filters by query matching id", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    createRootAgent(agentsDB, {
      id: "agent_abc123",
      session_id: "ses_abc",
      title: "Test Agent",
      created_at: now,
      updated_at: now,
    });

    createRootAgent(agentsDB, {
      id: "agent_xyz789",
      session_id: "ses_xyz",
      title: "Other Agent",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/recent?q=abc123");

      expect(res.status).toBe(200);
      const data = (await res.json()) as RecentAgentResponse;
      expect(data.total).toBe(1);
      expect(data.agents[0].id).toBe("agent_abc123");
    });
  });

  test("filters by query matching project_id", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    createRootAgent(agentsDB, {
      id: "agent_project_a",
      session_id: "ses_a",
      title: "Project A Agent",
      project_id: "project-alpha",
      created_at: now,
      updated_at: now,
    });

    createRootAgent(agentsDB, {
      id: "agent_project_b",
      session_id: "ses_b",
      title: "Project B Agent",
      project_id: "project-beta",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/recent?q=project-alpha");

      expect(res.status).toBe(200);
      const data = (await res.json()) as RecentAgentResponse;
      expect(data.total).toBe(1);
      expect(data.agents[0].id).toBe("agent_project_a");
    });
  });

  test("returns all agents when query is empty", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Agent One",
      created_at: now,
      updated_at: now,
    });

    createRootAgent(agentsDB, {
      id: "agent_2",
      session_id: "ses_2",
      title: "Agent Two",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/recent?q=");

      expect(res.status).toBe(200);
      const data = (await res.json()) as RecentAgentResponse;
      expect(data.total).toBe(2);
    });
  });
});

describe("GET /api/agents/recent - Response fields", () => {
  test("includes all required response fields — no message fields", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const parent = createRootAgent(agentsDB, {
      id: "agent_parent",
      session_id: "ses_parent",
      title: "Parent Agent",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/recent");

      expect(res.status).toBe(200);
      const data = (await res.json()) as RecentAgentResponse;
      const agent = data.agents[0];

      expect(agent.id).toBe("agent_parent");
      expect(agent.title).toBe("Parent Agent");
      expect(agent.session_id).toBe("ses_parent");
      expect(agent.parent_id).toBeNull();
      expect(agent.tree_id).toBe(parent.tree_id);
      // Message fields are no longer in this response — fetched separately via /snippet
      expect(agent).not.toHaveProperty("lastMessageAt");
      expect(agent).not.toHaveProperty("lastUserMessage");
      expect(agent).not.toHaveProperty("lastAgentMessage");
    });
  });

  test("includes parent_id for child agents", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const parent = createRootAgent(agentsDB, {
      id: "agent_parent",
      session_id: "ses_parent",
      title: "Parent Agent",
      created_at: now,
      updated_at: now,
    });

    const child = createChildAgent(agentsDB, parent.id, {
      id: "agent_child",
      session_id: "ses_child",
      title: "Child Agent",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/recent");

      expect(res.status).toBe(200);
      const data = (await res.json()) as RecentAgentResponse;
      const childResult = data.agents.find((a) => a.id === child.id);
      expect(childResult?.parent_id).toBe(parent.id);
    });
  });
});
