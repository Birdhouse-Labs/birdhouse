// ABOUTME: Tests for AAPI agent creation with clone event insertion
// ABOUTME: Verifies timeline events are created when agents clone via AAPI

import { beforeEach, describe, expect, test } from "bun:test";
import type { Session } from "../../dependencies";
import { createTestDeps, withDeps } from "../../dependencies";
import type { BirdhouseMessage as Message } from "../../harness";
import { type AgentsDB, initAgentsDB } from "../../lib/agents-db";
import { captureStreamEvents, createRootAgent, createTestApp } from "../../test-utils";
import { create } from "./create";

describe("AAPI create agent with cloning", () => {
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
    mockForkSession = async (_sessionId: string) => ({
      id: `ses_fork_${Date.now()}`,
      title: "Fork",
      projectID: "test-project",
      directory: "/test",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    });
  });

  describe("AAPI clone events with currentAgent", () => {
    test("inserts timeline events and emits SSE when agent clones from another agent", async () => {
      // Create calling agent (agent that calls agent_create)
      const callingAgent = createRootAgent(agentsDB, {
        session_id: "ses_calling",
        title: "Calling Agent",
        id: "agent_calling",
      });

      // Create source agent (agent to clone from)
      const sourceAgent = createRootAgent(agentsDB, {
        session_id: "ses_source",
        title: "Source Agent",
        id: "agent_source",
      });

      const mockSession: Session = {
        id: "ses_fork_123",
        title: "Cloned Agent",
        projectID: "test",
        directory: "/test",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      };

      const mockForkSession = async () => mockSession;

      const mockMessage = {
        info: {
          id: "msg_response",
          sessionID: "ses_fork_123",
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user",
          modelID: "claude-sonnet-4",
          providerID: "anthropic",
          mode: "build",
          cost: 0,
          tokens: {
            input: 100,
            output: 50,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          path: { cwd: "/test", root: "/" },
        },
        parts: [
          {
            type: "text",
            text: "Response",
            id: "part_1",
            sessionID: "ses_fork_123",
            messageID: "msg_1",
          },
        ],
      } as Message;

      const deps = await createTestDeps({ forkSession: mockForkSession });
      deps.agentsDB = agentsDB;
      deps.harness.sendMessage = async () => mockMessage;

      await withDeps(deps, async () => {
        const { events, cleanup } = await captureStreamEvents();

        const app = await createTestApp({ agentsDb: agentsDB });
        app.post("/agents", (c) => create(c, deps));

        const response = await app.request("/agents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": callingAgent.session_id,
          },
          body: JSON.stringify({
            prompt: "Test clone",
            title: "Cloned Agent",
            from_agent_id: sourceAgent.id,
          }),
        });

        expect(response.status).toBe(201);
        const newAgent = (await response.json()) as { id: string; title: string };

        // Verify calling agent (actor) event
        const callingEvents = agentsDB.getEventsByAgentId(callingAgent.id);
        expect(callingEvents).toHaveLength(1);
        expect(callingEvents[0].event_type).toBe("clone_created");
        expect(callingEvents[0].actor_agent_id).toBe(callingAgent.id);
        expect(callingEvents[0].source_agent_id).toBe(sourceAgent.id);
        expect(callingEvents[0].target_agent_id).toBe(newAgent.id);
        expect(callingEvents[0].target_agent_title).toBe("Cloned Agent");

        // Verify source agent event
        const sourceEvents = agentsDB.getEventsByAgentId(sourceAgent.id);
        expect(sourceEvents).toHaveLength(1);
        expect(sourceEvents[0].event_type).toBe("clone_created");
        expect(sourceEvents[0].actor_agent_id).toBe(callingAgent.id);
        expect(sourceEvents[0].source_agent_id).toBe(sourceAgent.id);
        expect(sourceEvents[0].target_agent_id).toBe(newAgent.id);

        // Verify target agent (new clone) event
        const newAgentEvents = agentsDB.getEventsByAgentId(newAgent.id);
        expect(newAgentEvents).toHaveLength(1);
        expect(newAgentEvents[0].event_type).toBe("clone_created");
        expect(newAgentEvents[0].actor_agent_id).toBe(callingAgent.id);
        expect(newAgentEvents[0].actor_agent_title).toBe("Calling Agent");
        expect(newAgentEvents[0].source_agent_id).toBe(sourceAgent.id);
        expect(newAgentEvents[0].target_agent_id).toBe(newAgent.id);

        // Verify SSE events were emitted (3 total: actor, source, target)
        const eventCreatedEvents = events.filter((e) => e.type === "birdhouse.event.created");
        expect(eventCreatedEvents).toHaveLength(3); // Actor + source + target events

        // Verify calling agent (actor) SSE event
        const actorSSE = eventCreatedEvents.find((e) => e.properties.agentId === callingAgent.id);
        expect(actorSSE).toBeDefined();
        expect(actorSSE?.properties.event).toMatchObject({
          event_type: "clone_created",
          actor_agent_id: callingAgent.id,
          source_agent_id: sourceAgent.id,
          target_agent_id: newAgent.id,
          target_agent_title: "Cloned Agent",
        });

        // Verify source agent SSE event
        const sourceSSE = eventCreatedEvents.find((e) => e.properties.agentId === sourceAgent.id);
        expect(sourceSSE).toBeDefined();
        expect(sourceSSE?.properties.event).toMatchObject({
          event_type: "clone_created",
          actor_agent_id: callingAgent.id,
          source_agent_id: sourceAgent.id,
          target_agent_id: newAgent.id,
        });

        // Verify new agent (target) SSE event
        const targetSSE = eventCreatedEvents.find((e) => e.properties.agentId === newAgent.id);
        expect(targetSSE).toBeDefined();
        expect(targetSSE?.properties.event).toMatchObject({
          event_type: "clone_created",
          actor_agent_id: callingAgent.id,
          actor_agent_title: "Calling Agent",
          source_agent_id: sourceAgent.id,
          target_agent_id: newAgent.id,
        });

        cleanup();
      });
    });

    test("deduplicates events when agent clones itself (self-cloning)", async () => {
      // Create self-cloning agent (both calling agent AND source agent)
      const selfCloningAgent = createRootAgent(agentsDB, {
        session_id: "ses_self_clone",
        title: "Self Cloning Agent",
        id: "agent_self_clone",
      });

      const mockSession: Session = {
        id: "ses_fork_789",
        title: "Clone of Myself",
        projectID: "test",
        directory: "/test",
        version: "1.0.0",
        time: { created: Date.now(), updated: Date.now() },
      };

      const mockForkSession = async () => mockSession;

      const mockMessage = {
        info: {
          id: "msg_response",
          sessionID: "ses_fork_789",
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user",
          modelID: "claude-sonnet-4",
          providerID: "anthropic",
          mode: "build",
          cost: 0,
          tokens: {
            input: 100,
            output: 50,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          path: { cwd: "/test", root: "/" },
        },
        parts: [
          {
            type: "text",
            text: "Response",
            id: "part_1",
            sessionID: "ses_fork_789",
            messageID: "msg_1",
          },
        ],
      } as Message;

      const deps = await createTestDeps({ forkSession: mockForkSession });
      deps.agentsDB = agentsDB;
      deps.harness.sendMessage = async () => mockMessage;

      await withDeps(deps, async () => {
        const { events, cleanup } = await captureStreamEvents();

        const app = await createTestApp({ agentsDb: agentsDB });
        app.post("/agents", (c) => create(c, deps));

        const response = await app.request("/agents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": selfCloningAgent.session_id, // Calling agent
          },
          body: JSON.stringify({
            prompt: "Clone myself",
            title: "Clone of Myself",
            from_agent_id: selfCloningAgent.id, // Clone FROM same agent
          }),
        });

        expect(response.status).toBe(201);
        const newAgent = (await response.json()) as { id: string; title: string };

        // CRITICAL: Self-cloning agent should have ONLY 1 event (not 2)
        // Actor event and source event would be duplicates, so only keep one
        const selfCloningEvents = agentsDB.getEventsByAgentId(selfCloningAgent.id);
        expect(selfCloningEvents).toHaveLength(1);
        expect(selfCloningEvents[0].event_type).toBe("clone_created");
        expect(selfCloningEvents[0].actor_agent_id).toBe(selfCloningAgent.id);
        expect(selfCloningEvents[0].source_agent_id).toBe(selfCloningAgent.id);
        expect(selfCloningEvents[0].target_agent_id).toBe(newAgent.id);
        expect(selfCloningEvents[0].target_agent_title).toBe("Clone of Myself");

        // New clone should have 1 event
        const newAgentEvents = agentsDB.getEventsByAgentId(newAgent.id);
        expect(newAgentEvents).toHaveLength(1);
        expect(newAgentEvents[0].event_type).toBe("clone_created");
        expect(newAgentEvents[0].actor_agent_id).toBe(selfCloningAgent.id);
        expect(newAgentEvents[0].source_agent_id).toBe(selfCloningAgent.id);
        expect(newAgentEvents[0].target_agent_id).toBe(newAgent.id);

        // Verify SSE events: should be 2 total (self-cloning agent + new agent)
        // NOT 3 because actor and source are the same agent
        const eventCreatedEvents = events.filter((e) => e.type === "birdhouse.event.created");
        expect(eventCreatedEvents).toHaveLength(2);

        // Verify self-cloning agent SSE event (only 1, not 2)
        const selfCloneSSE = eventCreatedEvents.filter((e) => e.properties.agentId === selfCloningAgent.id);
        expect(selfCloneSSE).toHaveLength(1);
        expect(selfCloneSSE[0]?.properties.event).toMatchObject({
          event_type: "clone_created",
          actor_agent_id: selfCloningAgent.id,
          source_agent_id: selfCloningAgent.id,
          target_agent_id: newAgent.id,
        });

        // Verify new agent SSE event
        const targetSSE = eventCreatedEvents.find((e) => e.properties.agentId === newAgent.id);
        expect(targetSSE).toBeDefined();
        expect(targetSSE?.properties.event).toMatchObject({
          event_type: "clone_created",
          actor_agent_id: selfCloningAgent.id,
          source_agent_id: selfCloningAgent.id,
          target_agent_id: newAgent.id,
        });

        cleanup();
      });
    });
  });

  describe("AAPI clone events WITHOUT currentAgent", () => {
    test("inserts only child event when no X-Session-ID header", async () => {
      // Create source agent only
      const sourceAgent = createRootAgent(agentsDB, {
        session_id: "ses_source_no_caller",
        title: "Source Agent",
        id: "agent_source_no_caller",
      });

      const mockMessage = {
        info: {
          id: "msg_response",
          sessionID: "ses_fork_456",
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user",
          modelID: "claude-sonnet-4",
          providerID: "anthropic",
          mode: "build",
          cost: 0,
          tokens: {
            input: 100,
            output: 50,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          path: { cwd: "/test", root: "/" },
        },
        parts: [
          {
            type: "text",
            text: "Response",
            id: "part_1",
            sessionID: "ses_fork_456",
            messageID: "msg_1",
          },
        ],
      } as Message;

      const deps = await createTestDeps({ forkSession: mockForkSession });
      deps.agentsDB = agentsDB;
      deps.harness.sendMessage = async () => mockMessage;

      await withDeps(deps, async () => {
        const app = await createTestApp({ agentsDb: agentsDB });
        app.post("/agents", (c) => create(c, deps));

        const response = await app.request("/agents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // NO X-Session-ID header
          },
          body: JSON.stringify({
            prompt: "Test clone without caller",
            title: "Cloned Agent No Caller",
            from_agent_id: sourceAgent.id,
          }),
        });

        expect(response.status).toBe(201);
        const newAgent = (await response.json()) as { id: string; title: string };

        // Verify source agent event (human-initiated, so actor is null)
        const sourceEvents = agentsDB.getEventsByAgentId(sourceAgent.id);
        expect(sourceEvents).toHaveLength(1);
        expect(sourceEvents[0].event_type).toBe("clone_created");
        expect(sourceEvents[0].actor_agent_id).toBeNull(); // Human initiated
        expect(sourceEvents[0].source_agent_id).toBe(sourceAgent.id);
        expect(sourceEvents[0].target_agent_id).toBe(newAgent.id);

        // Verify target agent event (no calling agent)
        const newAgentEvents = agentsDB.getEventsByAgentId(newAgent.id);
        expect(newAgentEvents).toHaveLength(1);
        expect(newAgentEvents[0].event_type).toBe("clone_created");
        expect(newAgentEvents[0].actor_agent_id).toBeNull(); // No calling agent
        expect(newAgentEvents[0].source_agent_id).toBe(sourceAgent.id);
        expect(newAgentEvents[0].source_agent_title).toBe("Source Agent");
        expect(newAgentEvents[0].target_agent_id).toBe(newAgent.id);
      });
    });
  });
});
