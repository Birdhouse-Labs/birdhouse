// ABOUTME: Tests the agent stop-tree API route against a real in-memory agents database.
// ABOUTME: Verifies the selected agent stops every session in its tree and rejects missing agents.

import { describe, expect, mock, test } from "bun:test";
import { createTestDeps, withDeps } from "../dependencies";
import { initAgentsDB } from "../lib/agents-db";
import { createChildAgent, createRootAgent, withWorkspaceContext } from "../test-utils";
import { createAgentRoutes } from "./agents";

describe("POST /:id/stop-tree", () => {
  test("stops every session in the selected agent tree", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const root = createRootAgent(agentsDB, { id: "agent_root", session_id: "ses_root" });
    const child = createChildAgent(agentsDB, root.id, { session_id: "ses_child" });
    createChildAgent(agentsDB, child.id, { session_id: "ses_grandchild" });
    createRootAgent(agentsDB, { id: "agent_other", session_id: "ses_other" });

    const abortMock = mock(async () => {});
    const deps = await createTestDeps({
      abortSession: abortMock,
    });

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const response = await app.request(`/${child.id}/stop-tree`, { method: "POST" });

      expect(response.status).toBe(200);
      expect(abortMock).toHaveBeenCalledTimes(3);
      expect(abortMock).toHaveBeenNthCalledWith(1, "ses_root");
      expect(abortMock).toHaveBeenNthCalledWith(2, "ses_child");
      expect(abortMock).toHaveBeenNthCalledWith(3, "ses_grandchild");
    });
  });

  test("returns 404 when the selected agent does not exist", async () => {
    const deps = await createTestDeps();

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes);
      const response = await app.request("/agent_missing/stop-tree", { method: "POST" });

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Agent agent_missing not found" });
    });
  });
});
