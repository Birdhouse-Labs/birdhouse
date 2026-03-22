// ABOUTME: Unit tests for unarchive endpoint - unarchiving agents and their descendants
// ABOUTME: Tests recursive unarchiving, SSE events, and error handling

import { describe, expect, test } from "bun:test";
import { createTestDeps, withDeps } from "../../dependencies";
import { initAgentsDB } from "../../lib/agents-db";
import { captureStreamEvents, createTestApp } from "../../test-utils";
import { createAgentTree, createChildAgent, createRootAgent } from "../../test-utils/agent-factories";
import { unarchive } from "./unarchive";

describe("unarchive - Unarchive agent and descendants", () => {
  test("unarchives single agent with no children", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    const root = createRootAgent(agentsDB, {
      id: "agent_root",
      title: "Root Agent",
    });

    agentsDB.archiveAgent(root.id);

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.patch("/:id/unarchive", (c) => unarchive(c, deps));

      const response = await app.request(`/${root.id}/unarchive`, {
        method: "PATCH",
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { unarchivedCount: number; unarchivedIds: string[] };
      expect(data.unarchivedCount).toBe(1);
      expect(data.unarchivedIds).toEqual([root.id]);

      // Verify agent is unarchived in database
      const unarchivedAgent = agentsDB.getAgentById(root.id);
      expect(unarchivedAgent).not.toBeNull();
      expect(unarchivedAgent?.archived_at).toBeNull();
    });
  });

  test("unarchives agent with children recursively", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    // Create tree: root -> child1, child2
    const { root, children } = createAgentTree(agentsDB, {
      rootId: "agent_root",
      rootTitle: "Root Agent",
      childTitles: ["Child 1", "Child 2"],
    });
    const [child1, child2] = children;

    // Archive entire tree
    agentsDB.archiveAgent(root.id);

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.patch("/:id/unarchive", (c) => unarchive(c, deps));

      const response = await app.request(`/${root.id}/unarchive`, {
        method: "PATCH",
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { unarchivedCount: number; unarchivedIds: string[] };
      expect(data.unarchivedCount).toBe(3);
      expect(data.unarchivedIds).toContain(root.id);
      expect(data.unarchivedIds).toContain(child1.id);
      expect(data.unarchivedIds).toContain(child2.id);

      // Verify all agents are unarchived
      const unarchivedRoot = agentsDB.getAgentById(root.id);
      const unarchivedChild1 = agentsDB.getAgentById(child1.id);
      const unarchivedChild2 = agentsDB.getAgentById(child2.id);

      expect(unarchivedRoot?.archived_at).toBeNull();
      expect(unarchivedChild1?.archived_at).toBeNull();
      expect(unarchivedChild2?.archived_at).toBeNull();
    });
  });

  test("unarchives deep tree (grandchildren) recursively", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    // Create tree: root -> child -> grandchild
    const root = createRootAgent(agentsDB, {
      id: "agent_root",
      title: "Root",
    });

    const child = createChildAgent(agentsDB, root.id, {
      title: "Child",
    });

    const grandchild = createChildAgent(agentsDB, child.id, {
      title: "Grandchild",
      model: "anthropic/claude-haiku",
    });

    // Archive entire tree
    agentsDB.archiveAgent(root.id);

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.patch("/:id/unarchive", (c) => unarchive(c, deps));

      const response = await app.request(`/${root.id}/unarchive`, {
        method: "PATCH",
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { unarchivedCount: number; unarchivedIds: string[] };
      expect(data.unarchivedCount).toBe(3);
      expect(data.unarchivedIds).toContain(root.id);
      expect(data.unarchivedIds).toContain(child.id);
      expect(data.unarchivedIds).toContain(grandchild.id);

      // Verify all are unarchived
      expect(agentsDB.getAgentById(root.id)?.archived_at).toBeNull();
      expect(agentsDB.getAgentById(child.id)?.archived_at).toBeNull();
      expect(agentsDB.getAgentById(grandchild.id)?.archived_at).toBeNull();
    });
  });

  test("unarchives only subtree when unarchiving child agent", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    // Create tree: root -> child -> grandchild
    const root = createRootAgent(agentsDB, {
      id: "agent_root",
      title: "Root",
    });

    const child = createChildAgent(agentsDB, root.id, {
      title: "Child",
    });

    const grandchild = createChildAgent(agentsDB, child.id, {
      title: "Grandchild",
      model: "anthropic/claude-haiku",
    });

    // Archive entire tree
    agentsDB.archiveAgent(root.id);

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.patch("/:id/unarchive", (c) => unarchive(c, deps));

      // Unarchive child branch only
      const response = await app.request(`/${child.id}/unarchive`, {
        method: "PATCH",
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { unarchivedCount: number; unarchivedIds: string[] };
      expect(data.unarchivedCount).toBe(2);
      expect(data.unarchivedIds).toContain(child.id);
      expect(data.unarchivedIds).toContain(grandchild.id);

      // Root should STILL be archived (unarchive goes DOWN only, not UP)
      expect(agentsDB.getAgentById(root.id)?.archived_at).not.toBeNull();
      // Child and grandchild should be unarchived
      expect(agentsDB.getAgentById(child.id)?.archived_at).toBeNull();
      expect(agentsDB.getAgentById(grandchild.id)?.archived_at).toBeNull();
    });
  });

  test("returns 404 for non-existent agent", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.patch("/:id/unarchive", (c) => unarchive(c, deps));

      const response = await app.request("/agent_nonexistent/unarchive", {
        method: "PATCH",
      });

      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("not found");
    });
  });

  test("returns 400 when unarchiving non-archived agent", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    const root = createRootAgent(agentsDB, {
      id: "agent_root",
      title: "Root",
      // NOT archived
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.patch("/:id/unarchive", (c) => unarchive(c, deps));

      const response = await app.request(`/${root.id}/unarchive`, {
        method: "PATCH",
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("not archived");
    });
  });

  test("emits birdhouse.agent.unarchived SSE event with correct payload", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    const { root, children } = createAgentTree(agentsDB, {
      rootId: "agent_root",
      rootTitle: "Root",
      childTitles: ["Child"],
    });
    const [child] = children;

    // Archive tree
    agentsDB.archiveAgent(root.id);

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const app = await createTestApp({ agentsDb: agentsDB });
      app.patch("/:id/unarchive", (c) => unarchive(c, deps));

      await app.request(`/${root.id}/unarchive`, {
        method: "PATCH",
      });

      // Verify event was emitted
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("birdhouse.agent.unarchived");
      expect(events[0].properties.agentId).toBe(root.id);
      expect(events[0].properties.unarchivedCount).toBe(2);
      expect(Array.isArray(events[0].properties.unarchivedIds)).toBe(true);
      expect((events[0].properties.unarchivedIds as string[]).length).toBe(2);
      expect(events[0].properties.unarchivedIds as string[]).toContain(root.id);
      expect(events[0].properties.unarchivedIds as string[]).toContain(child.id);

      cleanup();
    });
  });
});
