// ABOUTME: Unit tests for GET /api/agents/search endpoint with tree inclusion support
// ABOUTME: Tests search functionality with both flat and tree response modes

import { describe, expect, test } from "bun:test";
import { createTestDeps, withDeps } from "../dependencies";
import { createTestAgentHarness, createTestHarnessEventStream, createWorkspaceHarnessResolver } from "../harness";
import type { AgentNode, AgentTree } from "../lib/agents-db";
import { initAgentsDB } from "../lib/agents-db";
import { withWorkspaceContext } from "../test-utils";
import { createChildAgent, createRootAgent } from "../test-utils/agent-factories";
import { createAgentRoutes } from "./agents";

// ============================================================================
// Type Definitions for API Responses
// ============================================================================

interface FlatSearchResponse {
  agents: AgentNode[];
  total: number;
}

interface TreeSearchResponse {
  trees: AgentTree[];
  matchedAgentIds: string[];
  total: number;
}

// ============================================================================
// GET /api/agents/search - Search agents with optional tree inclusion
// ============================================================================

describe("GET /api/agents/search - Basic behavior", () => {
  test("returns empty flat results for non-matching query", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=nonexistent");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;
      expect(data).toEqual({
        agents: [],
        total: 0,
      });
    });
  });

  test("returns all agents when query is empty", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    // Create test agents
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
      const res = await app.request("/search");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;
      expect(data.total).toBe(2);
      expect(data.agents).toHaveLength(2);
      expect(data.agents[0]).toHaveProperty("children");
    });
  });

  test("returns empty tree results for non-matching query", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=nonexistent&includeTrees=true");

      expect(res.status).toBe(200);
      const data = (await res.json()) as TreeSearchResponse;
      expect(data).toEqual({
        trees: [],
        matchedAgentIds: [],
        total: 0,
      });
    });
  });

  test("returns 400 for invalid includeTrees parameter", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?includeTrees=invalid");

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data).toEqual({ error: "includeTrees must be 'true' or 'false'" });
    });
  });

  test("handles empty query parameter", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;
      expect(data).toEqual({
        agents: [],
        total: 0,
      });
    });
  });

  test("treats empty query parameter as match-all when agents exist", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const older = createRootAgent(agentsDB, {
      id: "agent_empty_query_older",
      session_id: "ses_empty_query_older",
      title: "Older Agent",
      created_at: now - 2000,
      updated_at: now - 2000,
    });

    const newer = createRootAgent(agentsDB, {
      id: "agent_empty_query_newer",
      session_id: "ses_empty_query_newer",
      title: "Newer Agent",
      created_at: now - 1000,
      updated_at: now - 1000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;
      expect(data.total).toBe(2);
      expect(data.agents.map((agent) => agent.id)).toEqual([newer.id, older.id]);
    });
  });

  test("treats whitespace-only query as empty for default sorting and match-all", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const older = createRootAgent(agentsDB, {
      id: "agent_whitespace_older",
      session_id: "ses_whitespace_older",
      title: "Whitespace Older",
      created_at: now - 2000,
      updated_at: now - 2000,
    });

    const newer = createRootAgent(agentsDB, {
      id: "agent_whitespace_newer",
      session_id: "ses_whitespace_newer",
      title: "Whitespace Newer",
      created_at: now - 1000,
      updated_at: now - 1000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=%20%20");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;
      expect(data.total).toBe(2);
      expect(data.agents.map((agent) => agent.id)).toEqual([newer.id, older.id]);
    });
  });

  test("handles includeTrees=false explicitly", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=test&includeTrees=false");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;
      expect(data).toEqual({
        agents: [],
        total: 0,
      });
    });
  });

  test("combines multiple query parameters correctly", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=database%20optimization&includeTrees=true");

      expect(res.status).toBe(200);
      const data = (await res.json()) as TreeSearchResponse;
      expect(data).toHaveProperty("trees");
      expect(data).toHaveProperty("matchedAgentIds");
      expect(data).toHaveProperty("total");
    });
  });
});

describe("GET /api/agents/search - Flat mode with real data", () => {
  test("uses resolver aggregate statuses in flat search results", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const agent = createRootAgent(agentsDB, {
      id: "agent_search_alt",
      session_id: "ses_search_alt",
      title: "Database Search Agent",
      harness_type: "alternate",
      created_at: now,
      updated_at: now,
    });

    const defaultHarness = createTestAgentHarness();
    const alternateHarness = createTestAgentHarness();
    alternateHarness.kind = "alternate";
    alternateHarness.seedSessionStatus(agent.session_id, { type: "retry" });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness = defaultHarness;
    deps.harnesses = createWorkspaceHarnessResolver({
      defaultKind: defaultHarness.kind,
      harnesses: {
        [defaultHarness.kind]: defaultHarness,
        [alternateHarness.kind]: alternateHarness,
      },
      eventStreams: {
        [defaultHarness.kind]: () => createTestHarnessEventStream(),
        [alternateHarness.kind]: () => createTestHarnessEventStream(),
      },
    });

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=database");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;
      expect(data.agents).toEqual([expect.objectContaining({ id: agent.id, status: { type: "retry" } })]);
    });
  });

  test("returns matching agents in flat format", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    // Create test agents
    const root = createRootAgent(agentsDB, {
      id: "agent_db_root",
      session_id: "ses_db_root",
      title: "Database optimization project",
      created_at: now,
      updated_at: now,
    });

    createChildAgent(agentsDB, root.id, {
      session_id: "ses_db_child",
      title: "Fix slow queries",
      created_at: now,
      updated_at: now,
    });

    createRootAgent(agentsDB, {
      id: "agent_other",
      session_id: "ses_other",
      title: "UI redesign",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=database");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;

      // Should only match "Database optimization project"
      expect(data.total).toBe(1);
      expect(data.agents).toHaveLength(1);
      expect(data.agents[0].title).toBe("Database optimization project");
      expect(data.agents[0].children).toEqual([]);
      expect(data.agents[0]).toHaveProperty("status");
    });
  });

  test("searches case-insensitively", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    createRootAgent(agentsDB, {
      id: "agent_case",
      session_id: "ses_case",
      title: "API Development",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=api");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;
      expect(data.total).toBe(1);
      expect(data.agents[0].title).toBe("API Development");
    });
  });

  test("includes status from OpenCode", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    createRootAgent(agentsDB, {
      id: "agent_status_test",
      session_id: "ses_status_test",
      title: "Test Agent",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=test");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;
      expect(data.agents[0].status).toBeDefined();
      expect(data.agents[0].status?.type).toMatch(/idle|busy|retry/);
    });
  });

  test("injects explicit status and falls back to idle in flat mode", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const busyAgent = createRootAgent(agentsDB, {
      id: "agent_busy_flat",
      session_id: "ses_busy_flat",
      title: "api",
      created_at: now - 2000,
      updated_at: now - 2000,
    });

    const idleAgent = createRootAgent(agentsDB, {
      id: "agent_idle_flat",
      session_id: "ses_idle_flat",
      title: "api testing",
      created_at: now - 1000,
      updated_at: now - 1000,
    });

    const deps = await createTestDeps({
      getSessionStatus: async () => ({
        [busyAgent.session_id]: { type: "busy" },
      }),
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=api");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;
      expect(data.agents.map((agent) => ({ id: agent.id, status: agent.status }))).toEqual([
        { id: busyAgent.id, status: { type: "busy" } },
        { id: idleAgent.id, status: { type: "idle" } },
      ]);
    });
  });

  test("keeps relevance order in flat mode even when order=asc is requested", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const exact = createRootAgent(agentsDB, {
      id: "agent_flat_exact",
      session_id: "ses_flat_exact",
      title: "api",
      created_at: now - 2000,
      updated_at: now - 2000,
    });

    const partial = createRootAgent(agentsDB, {
      id: "agent_flat_partial",
      session_id: "ses_flat_partial",
      title: "api planning",
      created_at: now - 1000,
      updated_at: now - 1000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=api&sortBy=relevance&order=asc");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;
      expect(data.agents.map((agent) => agent.id)).toEqual([exact.id, partial.id]);
    });
  });
});

describe("GET /api/agents/search - Tree mode with real data", () => {
  test("returns complete tree when root matches", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    // Create tree with matching root
    const root = createRootAgent(agentsDB, {
      id: "agent_tree_root",
      session_id: "ses_tree_root",
      title: "Bug investigation",
      created_at: now,
      updated_at: now,
    });

    const child = createChildAgent(agentsDB, root.id, {
      session_id: "ses_tree_child",
      title: "Reproduce issue",
      created_at: now,
      updated_at: now,
    });

    createChildAgent(agentsDB, child.id, {
      session_id: "ses_tree_grandchild",
      title: "Write test",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=bug&includeTrees=true");

      expect(res.status).toBe(200);
      const data = (await res.json()) as TreeSearchResponse;

      expect(data.total).toBe(1);
      expect(data.matchedAgentIds).toEqual([root.id]);
      expect(data.trees).toHaveLength(1);

      const tree = data.trees[0] as AgentTree;
      expect(tree.tree_id).toBe(root.tree_id);
      expect(tree.count).toBe(3);
      expect(tree.root.title).toBe("Bug investigation");
      expect(tree.root.children).toHaveLength(1);
      expect(tree.root.children[0].children).toHaveLength(1);
    });
  });

  test("returns complete tree when child matches", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const root = createRootAgent(agentsDB, {
      id: "agent_match_child_root",
      session_id: "ses_match_child_root",
      title: "Feature development",
      created_at: now,
      updated_at: now,
    });

    const child = createChildAgent(agentsDB, root.id, {
      id: "agent_match_child",
      session_id: "ses_match_child",
      title: "Database migration",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=database&includeTrees=true");

      expect(res.status).toBe(200);
      const data = (await res.json()) as TreeSearchResponse;

      // Should match the child and return entire tree from root
      expect(data.total).toBe(1);
      expect(data.matchedAgentIds).toEqual([child.id]);
      expect(data.trees).toHaveLength(1);

      const tree = data.trees[0] as AgentTree;
      expect(tree.root.id).toBe(root.id);
      expect(tree.count).toBe(2);
      expect(tree.root.children).toHaveLength(1);
      expect(tree.root.children[0].title).toBe("Database migration");
    });
  });

  test("deduplicates when multiple agents in same tree match", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const root = createRootAgent(agentsDB, {
      id: "agent_multi_root",
      session_id: "ses_multi_root",
      title: "API Development",
      created_at: now,
      updated_at: now,
    });

    const child1 = createChildAgent(agentsDB, root.id, {
      id: "agent_multi_child1",
      session_id: "ses_multi_child1",
      title: "API endpoints",
      created_at: now,
      updated_at: now,
    });

    const child2 = createChildAgent(agentsDB, root.id, {
      id: "agent_multi_child2",
      session_id: "ses_multi_child2",
      title: "API documentation",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=api&includeTrees=true");

      expect(res.status).toBe(200);
      const data = (await res.json()) as TreeSearchResponse;

      // Three agents match, but only one tree returned
      expect(data.total).toBe(3);
      expect(data.matchedAgentIds).toHaveLength(3);
      expect(data.matchedAgentIds).toContain(root.id);
      expect(data.matchedAgentIds).toContain(child1.id);
      expect(data.matchedAgentIds).toContain(child2.id);
      expect(data.trees).toHaveLength(1);

      const tree = data.trees[0] as AgentTree;
      expect(tree.count).toBe(3);
    });
  });

  test("includes status in all tree nodes", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const root = createRootAgent(agentsDB, {
      id: "agent_status_root",
      session_id: "ses_status_root",
      title: "Status test",
      created_at: now,
      updated_at: now,
    });

    createChildAgent(agentsDB, root.id, {
      session_id: "ses_status_child",
      title: "Child agent",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=status&includeTrees=true");

      expect(res.status).toBe(200);
      const data = (await res.json()) as TreeSearchResponse;

      const tree = data.trees[0] as AgentTree;
      expect(tree.root.status).toBeDefined();
      expect(tree.root.status?.type).toMatch(/idle|busy|retry/);
      expect(tree.root.children[0].status).toBeDefined();
      expect(tree.root.children[0].status?.type).toMatch(/idle|busy|retry/);
    });
  });

  test("injects explicit status and falls back to idle in tree mode", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const root = createRootAgent(agentsDB, {
      id: "agent_tree_status_root",
      session_id: "ses_tree_status_root",
      title: "status root",
      created_at: now,
      updated_at: now,
    });

    const child = createChildAgent(agentsDB, root.id, {
      id: "agent_tree_status_child",
      session_id: "ses_tree_status_child",
      title: "status child",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps({
      getSessionStatus: async () => ({
        [root.session_id]: { type: "retry" },
      }),
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=status&includeTrees=true");

      expect(res.status).toBe(200);
      const data = (await res.json()) as TreeSearchResponse;
      expect(data.trees).toHaveLength(1);
      expect(data.trees[0]?.root.status).toEqual({ type: "retry" });
      expect(data.trees[0]?.root.children).toEqual([
        expect.objectContaining({ id: child.id, status: { type: "idle" } }),
      ]);
    });
  });

  test("tree mode keeps matched ids by relevance but orders trees by updated_at for sortBy=relevance", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const exactTree = createRootAgent(agentsDB, {
      id: "agent_tree_exact",
      session_id: "ses_tree_exact",
      title: "api",
      created_at: now - 3000,
      updated_at: now - 3000,
    });

    const partialTree = createRootAgent(agentsDB, {
      id: "agent_tree_partial",
      session_id: "ses_tree_partial",
      title: "api planning",
      created_at: now - 1000,
      updated_at: now - 1000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=api&includeTrees=true&sortBy=relevance&order=desc");

      expect(res.status).toBe(200);
      const data = (await res.json()) as TreeSearchResponse;
      expect(data.matchedAgentIds).toEqual([exactTree.id, partialTree.id]);
      expect(data.trees.map((tree) => tree.tree_id)).toEqual([partialTree.tree_id, exactTree.tree_id]);
      expect(data.total).toBe(data.matchedAgentIds.length);
      expect(data.trees).toHaveLength(2);
    });
  });
});

describe("GET /api/agents/search - Sort functionality", () => {
  test("defaults to relevance sorting when query is provided", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    // Create agents with different match qualities
    createRootAgent(agentsDB, {
      id: "agent_exact",
      session_id: "ses_exact",
      title: "database",
      created_at: now - 1000,
      updated_at: now - 1000,
    });

    createRootAgent(agentsDB, {
      id: "agent_partial",
      session_id: "ses_partial",
      title: "database optimization project",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=database");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;

      // Exact match should come first (relevance sorting)
      expect(data.agents[0].id).toBe("agent_exact");
      expect(data.agents[1].id).toBe("agent_partial");
    });
  });

  test("sorts by updated_at DESC when specified", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const older = createRootAgent(agentsDB, {
      id: "agent_older",
      session_id: "ses_older",
      title: "API Development",
      created_at: now - 2000,
      updated_at: now - 2000,
    });

    const newer = createRootAgent(agentsDB, {
      id: "agent_newer",
      session_id: "ses_newer",
      title: "API Testing",
      created_at: now - 1000,
      updated_at: now - 1000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=API&sortBy=updated_at&order=desc");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;

      // Most recently updated should come first
      expect(data.agents[0].id).toBe(newer.id);
      expect(data.agents[1].id).toBe(older.id);
    });
  });

  test("sorts by updated_at ASC when specified", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const older = createRootAgent(agentsDB, {
      id: "agent_older_asc",
      session_id: "ses_older_asc",
      title: "Feature A",
      created_at: now - 2000,
      updated_at: now - 2000,
    });

    const newer = createRootAgent(agentsDB, {
      id: "agent_newer_asc",
      session_id: "ses_newer_asc",
      title: "Feature B",
      created_at: now - 1000,
      updated_at: now - 1000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=Feature&sortBy=updated_at&order=asc");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;

      // Oldest updated should come first
      expect(data.agents[0].id).toBe(older.id);
      expect(data.agents[1].id).toBe(newer.id);
    });
  });

  test("sorts by created_at DESC when specified", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const oldCreated = createRootAgent(agentsDB, {
      id: "agent_old_created",
      session_id: "ses_old_created",
      title: "Bug Fix A",
      created_at: now - 3000,
      updated_at: now,
    });

    const newCreated = createRootAgent(agentsDB, {
      id: "agent_new_created",
      session_id: "ses_new_created",
      title: "Bug Fix B",
      created_at: now - 1000,
      updated_at: now - 2000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=Bug&sortBy=created_at&order=desc");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;

      // Most recently created should come first
      expect(data.agents[0].id).toBe(newCreated.id);
      expect(data.agents[1].id).toBe(oldCreated.id);
    });
  });

  test("sorts by created_at ASC when specified", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const oldCreated = createRootAgent(agentsDB, {
      id: "agent_old_asc",
      session_id: "ses_old_asc",
      title: "Task X",
      created_at: now - 3000,
      updated_at: now,
    });

    const newCreated = createRootAgent(agentsDB, {
      id: "agent_new_asc",
      session_id: "ses_new_asc",
      title: "Task Y",
      created_at: now - 1000,
      updated_at: now - 2000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=Task&sortBy=created_at&order=asc");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;

      // Oldest created should come first
      expect(data.agents[0].id).toBe(oldCreated.id);
      expect(data.agents[1].id).toBe(newCreated.id);
    });
  });

  test("defaults to updated_at DESC when query is empty", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const older = createRootAgent(agentsDB, {
      id: "agent_empty_older",
      session_id: "ses_empty_older",
      title: "Agent One",
      created_at: now - 2000,
      updated_at: now - 2000,
    });

    const newer = createRootAgent(agentsDB, {
      id: "agent_empty_newer",
      session_id: "ses_empty_newer",
      title: "Agent Two",
      created_at: now - 1000,
      updated_at: now - 1000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search");

      expect(res.status).toBe(200);
      const data = (await res.json()) as FlatSearchResponse;

      // Most recently updated should come first (default behavior)
      expect(data.agents[0].id).toBe(newer.id);
      expect(data.agents[1].id).toBe(older.id);
    });
  });

  test("tree mode respects sort parameters", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    // Older tree
    const olderRoot = createRootAgent(agentsDB, {
      id: "agent_tree_older",
      session_id: "ses_tree_older",
      title: "Old API Project",
      created_at: now - 3000,
      updated_at: now - 3000,
    });

    // Newer tree
    const newerRoot = createRootAgent(agentsDB, {
      id: "agent_tree_newer",
      session_id: "ses_tree_newer",
      title: "New API Project",
      created_at: now - 1000,
      updated_at: now - 1000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });

      // Test DESC (newer first)
      const resDesc = await app.request("/search?q=API&includeTrees=true&sortBy=updated_at&order=desc");
      expect(resDesc.status).toBe(200);
      const dataDesc = (await resDesc.json()) as TreeSearchResponse;
      expect(dataDesc.trees[0].tree_id).toBe(newerRoot.tree_id);
      expect(dataDesc.trees[1].tree_id).toBe(olderRoot.tree_id);

      // Test ASC (older first)
      const resAsc = await app.request("/search?q=API&includeTrees=true&sortBy=updated_at&order=asc");
      expect(resAsc.status).toBe(200);
      const dataAsc = (await resAsc.json()) as TreeSearchResponse;
      expect(dataAsc.trees[0].tree_id).toBe(olderRoot.tree_id);
      expect(dataAsc.trees[1].tree_id).toBe(newerRoot.tree_id);
    });
  });
});

describe("GET /api/agents/search - Sort validation", () => {
  test("returns 400 for invalid sortBy parameter", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?sortBy=invalid");

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data).toEqual({ error: "sortBy must be 'relevance', 'updated_at', or 'created_at'" });
    });
  });

  test("returns 400 for invalid order parameter", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?order=invalid");

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data).toEqual({ error: "order must be 'asc' or 'desc'" });
    });
  });

  test("returns 400 for relevance sorting with empty query", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?sortBy=relevance");

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data).toEqual({ error: "sortBy=relevance requires a non-empty query" });
    });
  });

  test("rejects relevance sorting with whitespace-only query", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/search?q=%20%20&sortBy=relevance");

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data).toEqual({ error: "sortBy=relevance requires a non-empty query" });
    });
  });
});
