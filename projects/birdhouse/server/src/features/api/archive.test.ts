// ABOUTME: Unit tests for archive endpoint - archiving agents and their descendants
// ABOUTME: Tests recursive archiving, SSE events, and ancestry checking

import { describe, expect, test } from "bun:test";
import { createTestDeps, withDeps } from "../../dependencies";
import { initAgentsDB } from "../../lib/agents-db";
import { captureStreamEvents, createTestApp } from "../../test-utils";
import { createAgentTree, createChildAgent, createRootAgent } from "../../test-utils/agent-factories";
import { archive } from "./archive";

describe("archive - Archive agent and descendants", () => {
  test("archives single agent with no children", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    const root = createRootAgent(agentsDB, {
      id: "agent_root",
      title: "Root Agent",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.patch("/:id/archive", (c) => archive(c, deps));

      const response = await app.request(`/${root.id}/archive`, {
        method: "PATCH",
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { archivedCount: number; archivedIds: string[] };
      expect(data.archivedCount).toBe(1);
      expect(data.archivedIds).toEqual([root.id]);

      // Verify agent is archived in database
      const archivedAgent = agentsDB.getAgentById(root.id);
      expect(archivedAgent).not.toBeNull();
      expect(archivedAgent?.archived_at).not.toBeNull();
      expect(archivedAgent?.archived_at).toBeGreaterThanOrEqual(1);
    });
  });

  test("archives agent with children recursively", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    // Create tree: root -> child1, child2
    const { root, children } = createAgentTree(agentsDB, {
      rootId: "agent_root",
      rootTitle: "Root Agent",
      childTitles: ["Child 1", "Child 2"],
    });
    const [child1, child2] = children;

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.patch("/:id/archive", (c) => archive(c, deps));

      const response = await app.request(`/${root.id}/archive`, {
        method: "PATCH",
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { archivedCount: number; archivedIds: string[] };
      expect(data.archivedCount).toBe(3);
      expect(data.archivedIds).toContain(root.id);
      expect(data.archivedIds).toContain(child1.id);
      expect(data.archivedIds).toContain(child2.id);

      // Verify all agents are archived
      const archivedRoot = agentsDB.getAgentById(root.id);
      const archivedChild1 = agentsDB.getAgentById(child1.id);
      const archivedChild2 = agentsDB.getAgentById(child2.id);

      expect(archivedRoot?.archived_at).not.toBeNull();
      expect(archivedChild1?.archived_at).not.toBeNull();
      expect(archivedChild2?.archived_at).not.toBeNull();
    });
  });

  test("archives deep tree (grandchildren) recursively", async () => {
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

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.patch("/:id/archive", (c) => archive(c, deps));

      const response = await app.request(`/${root.id}/archive`, {
        method: "PATCH",
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { archivedCount: number; archivedIds: string[] };
      expect(data.archivedCount).toBe(3);
      expect(data.archivedIds).toContain(root.id);
      expect(data.archivedIds).toContain(child.id);
      expect(data.archivedIds).toContain(grandchild.id);

      // Verify all are archived
      expect(agentsDB.getAgentById(root.id)?.archived_at).not.toBeNull();
      expect(agentsDB.getAgentById(child.id)?.archived_at).not.toBeNull();
      expect(agentsDB.getAgentById(grandchild.id)?.archived_at).not.toBeNull();
    });
  });

  test("archives only subtree when archiving child agent", async () => {
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

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.patch("/:id/archive", (c) => archive(c, deps));

      const response = await app.request(`/${child.id}/archive`, {
        method: "PATCH",
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { archivedCount: number; archivedIds: string[] };
      expect(data.archivedCount).toBe(2);
      expect(data.archivedIds).toContain(child.id);
      expect(data.archivedIds).toContain(grandchild.id);

      // Root should NOT be archived
      expect(agentsDB.getAgentById(root.id)?.archived_at).toBeNull();
      // Child and grandchild should be archived
      expect(agentsDB.getAgentById(child.id)?.archived_at).not.toBeNull();
      expect(agentsDB.getAgentById(grandchild.id)?.archived_at).not.toBeNull();
    });
  });

  test("returns 404 for non-existent agent", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.patch("/:id/archive", (c) => archive(c, deps));

      const response = await app.request("/agent_nonexistent/archive", {
        method: "PATCH",
      });

      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("not found");
    });
  });

  test("returns 400 when archiving already archived agent", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    const root = createRootAgent(agentsDB, {
      id: "agent_root",
      title: "Root",
      archived_at: Date.now(), // Already archived
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.patch("/:id/archive", (c) => archive(c, deps));

      const response = await app.request(`/${root.id}/archive`, {
        method: "PATCH",
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("already archived");
    });
  });

  test("emits birdhouse.agent.archived SSE event with correct payload", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    const { root, children } = createAgentTree(agentsDB, {
      rootId: "agent_root",
      rootTitle: "Root",
      childTitles: ["Child"],
    });
    const [child] = children;

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const app = await createTestApp({ agentsDb: agentsDB });
      app.patch("/:id/archive", (c) => archive(c, deps));

      await app.request(`/${root.id}/archive`, {
        method: "PATCH",
      });

      // Verify event was emitted
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("birdhouse.agent.archived");
      expect(events[0].properties.agentId).toBe(root.id);
      expect(events[0].properties.archivedCount).toBe(2);
      expect(Array.isArray(events[0].properties.archivedIds)).toBe(true);
      expect((events[0].properties.archivedIds as string[]).length).toBe(2);
      expect(events[0].properties.archivedIds as string[]).toContain(root.id);
      expect(events[0].properties.archivedIds as string[]).toContain(child.id);

      cleanup();
    });
  });
});
