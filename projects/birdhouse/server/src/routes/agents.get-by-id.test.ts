// ABOUTME: Tests for GET /api/agents/:id endpoint including revert state
// ABOUTME: Verifies that agent metadata includes session revert state when present

import { beforeEach, describe, expect, test } from "bun:test";
import { createTestDeps, withDeps } from "../dependencies";
import { type AgentsDB, initAgentsDB } from "../lib/agents-db";
import type { Session } from "../lib/opencode-client";
import { createRootAgent, createTestApp } from "../test-utils";
import { createAgentRoutes } from "./agents";

describe("GET /api/agents/:id with revert state", () => {
  let agentsDB: AgentsDB;

  beforeEach(async () => {
    agentsDB = await initAgentsDB(":memory:");
  });

  test("includes revert state when session is reverted", async () => {
    const _agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    // Mock session with revert state
    const mockSession: Session = {
      id: "ses_1",
      projectID: "test-project",
      directory: "/test",
      title: "Test Session",
      version: "1.0.0",
      time: {
        created: Date.now(),
        updated: Date.now(),
      },
      revert: {
        messageID: "msg_123",
      },
    };

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.opencode.getSession = async () => mockSession;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      const routes = createAgentRoutes();
      app.route("/", routes);

      const response = await app.request("/agent_1");

      expect(response.status).toBe(200);
      const data = (await response.json()) as { id: string; revert?: { messageID: string } };
      expect(data.id).toBe("agent_1");
      expect(data.revert).toEqual({ messageID: "msg_123" });
    });
  });

  test("does not include revert field when session is not reverted", async () => {
    const _agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    // Mock session without revert state
    const mockSession: Session = {
      id: "ses_1",
      projectID: "test-project",
      directory: "/test",
      title: "Test Session",
      version: "1.0.0",
      time: {
        created: Date.now(),
        updated: Date.now(),
      },
    };

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.opencode.getSession = async () => mockSession;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      const routes = createAgentRoutes();
      app.route("/", routes);

      const response = await app.request("/agent_1");

      expect(response.status).toBe(200);
      const data = (await response.json()) as { id: string; revert?: { messageID: string } };
      expect(data.id).toBe("agent_1");
      expect(data.revert).toBeUndefined();
    });
  });

  test("returns 404 for non-existent agent", async () => {
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      const routes = createAgentRoutes();
      app.route("/", routes);

      const response = await app.request("/agent_nonexistent");

      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("not found");
    });
  });
});
