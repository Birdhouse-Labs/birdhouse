// ABOUTME: Tests for clone-agent endpoint that clones an agent from a specific message
// ABOUTME: Verifies cloning with/without messageId, event emission, and error cases

import { beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createTestDeps, withDeps } from "../../dependencies";
import type { AgentRow, AgentsDB } from "../../lib/agents-db";
import { initAgentsDB } from "../../lib/agents-db";
import { captureStreamEvents, createRootAgent, withWorkspaceContext } from "../../test-utils";
import { cloneAgent } from "./clone-agent";

describe("API clone-agent", () => {
  let agentsDB: AgentsDB;
  let mockForkSession: (
    sessionId: string,
    messageId?: string,
  ) => Promise<{
    id: string;
    title: string;
    projectID: string;
    directory: string;
    version: string;
    time: { created: number; updated: number };
  }>;

  beforeEach(async () => {
    agentsDB = await initAgentsDB(":memory:");

    // Create mock fork function
    mockForkSession = async (_sessionId: string, _messageId?: string) => ({
      id: `ses_fork_${Date.now()}`,
      title: "Fork",
      projectID: "test-project",
      directory: "/test",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    });
  });

  test("clones agent with messageId", async () => {
    // Create source agent
    const sourceAgent = createRootAgent(agentsDB, {
      id: "agent_source",
      session_id: "ses_source",
      title: "Source Agent",
    });

    const deps = await createTestDeps({ forkSession: mockForkSession });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(
        () => {
          const hono = new Hono();
          hono.post("/:id/clone", (c) => cloneAgent(c, deps));
          return hono;
        },
        { agentsDb: agentsDB },
      );

      const response = await app.request(`/${sourceAgent.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: "msg_123" }),
      });

      expect(response.status).toBe(201);
      const clonedAgent = (await response.json()) as AgentRow;

      // Verify cloned agent properties
      expect(clonedAgent.id).toBeDefined();
      expect(clonedAgent.title).toBe("Source Agent"); // Should keep same title
      expect(clonedAgent.parent_id).toBe(sourceAgent.id); // Child of source
      expect(clonedAgent.tree_id).toBe(sourceAgent.tree_id);
      expect(clonedAgent.level).toBe(sourceAgent.level + 1);
      expect(clonedAgent.cloned_from).toBe(sourceAgent.id);
      expect(clonedAgent.cloned_at).toBeDefined();

      // Verify agent exists in database
      const dbAgent = agentsDB.getAgentById(clonedAgent.id);
      expect(dbAgent).not.toBeNull();
      expect(dbAgent?.title).toBe("Source Agent");
    });
  });

  test("clones agent without messageId (full clone)", async () => {
    // Create source agent
    const sourceAgent = createRootAgent(agentsDB, {
      id: "agent_source",
      session_id: "ses_source",
      title: "Source Agent",
    });

    const deps = await createTestDeps({ forkSession: mockForkSession });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(
        () => {
          const hono = new Hono();
          hono.post("/:id/clone", (c) => cloneAgent(c, deps));
          return hono;
        },
        { agentsDb: agentsDB },
      );

      const response = await app.request(`/${sourceAgent.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(201);
      const clonedAgent = (await response.json()) as AgentRow;

      // Verify cloned agent was created
      expect(clonedAgent.id).toBeDefined();
      expect(clonedAgent.parent_id).toBe(sourceAgent.id);
      expect(clonedAgent.cloned_from).toBe(sourceAgent.id);
    });
  });

  test("returns 404 for non-existent agent", async () => {
    const deps = await createTestDeps({ forkSession: mockForkSession });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(
        () => {
          const hono = new Hono();
          hono.post("/:id/clone", (c) => cloneAgent(c, deps));
          return hono;
        },
        { agentsDb: agentsDB },
      );

      const response = await app.request("/agent_nonexistent/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: "msg_123" }),
      });

      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("not found");
    });
  });

  test("emits clone_created events on both source and target timelines", async () => {
    const sourceAgent = createRootAgent(agentsDB, {
      id: "agent_source",
      session_id: "ses_source",
      title: "Source Agent",
    });

    const deps = await createTestDeps({ forkSession: mockForkSession });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const app = await withWorkspaceContext(
        () => {
          const hono = new Hono();
          hono.post("/:id/clone", (c) => cloneAgent(c, deps));
          return hono;
        },
        { agentsDb: agentsDB },
      );

      const response = await app.request(`/${sourceAgent.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: "msg_123" }),
      });

      expect(response.status).toBe(201);
      const clonedAgent = (await response.json()) as AgentRow;

      // Should have 3 events: agent.created, event.created (source), event.created (target)
      expect(events.length).toBeGreaterThanOrEqual(3);

      // Find the agent.created event
      const agentCreatedEvent = events.find((e) => e.type === "birdhouse.agent.created");
      expect(agentCreatedEvent).toBeDefined();
      expect(agentCreatedEvent?.properties.agentId).toBe(clonedAgent.id);

      // Find the event.created events
      const eventCreatedEvents = events.filter((e) => e.type === "birdhouse.event.created");
      expect(eventCreatedEvents.length).toBe(2);

      // Verify one event is on source timeline, one on target timeline
      const sourceEvent = eventCreatedEvents.find((e) => e.properties.agentId === sourceAgent.id);
      const targetEvent = eventCreatedEvents.find((e) => e.properties.agentId === clonedAgent.id);

      expect(sourceEvent).toBeDefined();
      expect(targetEvent).toBeDefined();

      // Verify event properties (with type assertions for event object)
      type EventWithProperties = {
        properties: { event: { event_type: string; source_agent_id: string; target_agent_id: string } };
      };
      expect((sourceEvent as unknown as EventWithProperties)?.properties.event.event_type).toBe("clone_created");
      expect((sourceEvent as unknown as EventWithProperties)?.properties.event.source_agent_id).toBe(sourceAgent.id);
      expect((sourceEvent as unknown as EventWithProperties)?.properties.event.target_agent_id).toBe(clonedAgent.id);

      expect((targetEvent as unknown as EventWithProperties)?.properties.event.event_type).toBe("clone_created");
      expect((targetEvent as unknown as EventWithProperties)?.properties.event.source_agent_id).toBe(sourceAgent.id);
      expect((targetEvent as unknown as EventWithProperties)?.properties.event.target_agent_id).toBe(clonedAgent.id);

      cleanup();
    });
  });
});
