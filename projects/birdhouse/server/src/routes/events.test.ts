// ABOUTME: Tests for SSE event streaming endpoint.
// ABOUTME: Verifies merged runtime and Birdhouse event delivery over the frontend SSE contract.

import { afterEach, describe, expect, test } from "bun:test";
import { createTestDeps, useDeps, withDeps } from "../dependencies";
import { createTestHarnessEventStream, type TestHarnessEventStream } from "../harness";
import { getWorkspaceEventBus, resetBirdhouseEventBus } from "../lib/birdhouse-event-bus";
import { resetStream } from "../lib/opencode-stream";
import { withWorkspaceContext } from "../test-utils";
import { createRootAgent } from "../test-utils/agent-factories";
import { createEventRoutes } from "./events";

// Helper to read SSE stream
async function readSSEEvents(response: Response, count: number, skipConnectionEvent = true): Promise<string[]> {
  if (!response.body) return [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: string[] = [];

  while (events.length < count) {
    const { value, done } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    // Parse SSE format: "data: {...}\n\n"
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const eventData = line.substring(6);
        // Skip connection established event if requested (default behavior)
        if (skipConnectionEvent) {
          try {
            const parsed = JSON.parse(eventData);
            if (parsed.type === "birdhouse.connection.established") {
              continue;
            }
          } catch {
            // If JSON parse fails, include the event anyway
          }
        }
        events.push(eventData);
      }
    }
  }

  return events;
}

function getResolverStream(deps: Awaited<ReturnType<typeof createTestDeps>>): TestHarnessEventStream {
  return deps.harnesses.createDefaultHarnessEventStream() as TestHarnessEventStream;
}

afterEach(() => {
  resetStream();
  resetBirdhouseEventBus();
});

describe("GET /api/events (SSE)", () => {
  test("proxies all event types through wildcard listener", async () => {
    const _deps = await createTestDeps();
    await withDeps(_deps, async () => {
      const app = await withWorkspaceContext(createEventRoutes);
      const stream = getResolverStream(_deps);

      const request = new Request("http://localhost:3000/");
      const responsePromise = app.request(request);

      await new Promise((r) => setTimeout(r, 10));

      // Emit events via wildcard, matching how the adapter-backed stream forwards runtime events
      stream.emit({
        type: "message.part.updated",
        sessionID: "ses_789",
        properties: {
          part: {
            id: "part_123",
            messageID: "msg_456",
            sessionID: "ses_789",
            type: "text",
            text: "Hello world",
          },
        },
      });

      const response = await responsePromise;
      const events = await Promise.race([
        readSSEEvents(response, 1),
        new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
      ]);

      expect(events).toHaveLength(1);
      const eventData = JSON.parse(events[0]);
      expect(eventData.type).toBe("message.part.updated");
      expect(eventData.properties.part.id).toBe("part_123");
      expect(eventData.properties.part.text).toBe("Hello world");
    });
  });

  test("forwards session.idle events", async () => {
    const _deps = await createTestDeps();
    await withDeps(_deps, async () => {
      const app = await withWorkspaceContext(createEventRoutes);
      const stream = getResolverStream(_deps);

      const request = new Request("http://localhost:3000/");
      const responsePromise = app.request(request);

      await new Promise((r) => setTimeout(r, 10));

      stream.emit({
        type: "session.idle",
        sessionID: "ses_complete",
        properties: { sessionID: "ses_complete" },
      });

      const response = await responsePromise;
      const events = await Promise.race([
        readSSEEvents(response, 1),
        new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
      ]);

      expect(events).toHaveLength(1);
      const eventData = JSON.parse(events[0]);
      expect(eventData.type).toBe("session.idle");
      expect(eventData.properties.sessionID).toBe("ses_complete");
    });
  });

  test("forwards session.status events with status payload and agentId", async () => {
    const deps = await createTestDeps();
    await withDeps(deps, async () => {
      const { agentsDB } = useDeps();

      createRootAgent(agentsDB, {
        id: "agent_status_1",
        session_id: "ses_status_1",
        model: "test-model",
      });

      const app = await withWorkspaceContext(createEventRoutes, { agentsDb: agentsDB });
      const stream = getResolverStream(deps);

      const request = new Request("http://localhost:3000/");
      const responsePromise = app.request(request);

      await new Promise((r) => setTimeout(r, 10));

      stream.emit({
        type: "session.status",
        sessionID: "ses_status_1",
        properties: {
          sessionID: "ses_status_1",
          status: { type: "busy" },
        },
      });

      const response = await responsePromise;
      const events = await Promise.race([
        readSSEEvents(response, 1),
        new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
      ]);

      expect(events).toHaveLength(1);
      expect(JSON.parse(events[0])).toEqual({
        type: "session.status",
        properties: {
          sessionID: "ses_status_1",
          status: { type: "busy" },
          agentId: "agent_status_1",
        },
      });
    });
  });

  test("forwards message.updated events with Birdhouse-owned message info shape", async () => {
    const deps = await createTestDeps();
    await withDeps(deps, async () => {
      const { agentsDB } = useDeps();

      createRootAgent(agentsDB, {
        id: "agent_message_updated_1",
        session_id: "ses_message_updated_1",
        model: "test-model",
      });

      const app = await withWorkspaceContext(createEventRoutes, { agentsDb: agentsDB });
      const stream = getResolverStream(deps);

      const request = new Request("http://localhost:3000/");
      const responsePromise = app.request(request);

      await new Promise((r) => setTimeout(r, 10));

      stream.emit({
        type: "message.updated",
        sessionID: "ses_message_updated_1",
        properties: {
          info: {
            id: "msg_message_updated_1",
            sessionID: "ses_message_updated_1",
            role: "assistant",
            time: { created: 123, completed: 124 },
            parentID: "msg_parent_1",
            modelID: "claude-sonnet-4",
            providerID: "anthropic",
          },
        },
      });

      const response = await responsePromise;
      const events = await Promise.race([
        readSSEEvents(response, 1),
        new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
      ]);

      expect(events).toHaveLength(1);
      expect(JSON.parse(events[0])).toEqual({
        type: "message.updated",
        properties: {
          info: {
            id: "msg_message_updated_1",
            sessionID: "ses_message_updated_1",
            role: "assistant",
            time: { created: 123, completed: 124 },
            parentID: "msg_parent_1",
            modelID: "claude-sonnet-4",
            providerID: "anthropic",
          },
          agentId: "agent_message_updated_1",
        },
      });
    });
  });

  test("forwards question.asked events with Birdhouse-owned payload shape", async () => {
    const deps = await createTestDeps();
    await withDeps(deps, async () => {
      const { agentsDB } = useDeps();

      createRootAgent(agentsDB, {
        id: "agent_question_1",
        session_id: "ses_question_1",
        model: "test-model",
      });

      const app = await withWorkspaceContext(createEventRoutes, { agentsDb: agentsDB });
      const stream = getResolverStream(deps);

      const request = new Request("http://localhost:3000/");
      const responsePromise = app.request(request);

      await new Promise((r) => setTimeout(r, 10));

      stream.emit({
        type: "question.asked",
        sessionID: "ses_question_1",
        properties: {
          id: "req_question_1",
          sessionID: "ses_question_1",
          questions: [
            {
              question: "Which option?",
              header: "Options",
              options: [{ label: "A", description: "First" }],
            },
          ],
          tool: { messageID: "msg_question_1", callID: "call_question_1" },
        },
      });

      const response = await responsePromise;
      const events = await Promise.race([
        readSSEEvents(response, 1),
        new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
      ]);

      expect(events).toHaveLength(1);
      expect(JSON.parse(events[0])).toEqual({
        type: "question.asked",
        properties: {
          id: "req_question_1",
          sessionID: "ses_question_1",
          questions: [
            {
              question: "Which option?",
              header: "Options",
              options: [{ label: "A", description: "First" }],
            },
          ],
          tool: { messageID: "msg_question_1", callID: "call_question_1" },
          agentId: "agent_question_1",
        },
      });
    });
  });

  test("subscribes through the resolver event stream", async () => {
    const deps = await createTestDeps();
    const resolverStream = createTestHarnessEventStream();
    deps.harnesses.createHarnessEventStreams = () => [resolverStream];
    deps.harnesses.createDefaultHarnessEventStream = () => resolverStream;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createEventRoutes);

      const request = new Request("http://localhost:3000/");
      const responsePromise = app.request(request);

      await new Promise((r) => setTimeout(r, 10));

      resolverStream.emit({
        type: "session.idle",
        sessionID: "ses_from_resolver",
        properties: {
          sessionID: "ses_from_resolver",
        },
      });

      const response = await responsePromise;
      const events = await Promise.race([
        readSSEEvents(response, 1),
        new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
      ]);

      expect(events).toHaveLength(1);
      expect(JSON.parse(events[0])).toEqual({
        type: "session.idle",
        properties: {
          sessionID: "ses_from_resolver",
        },
      });
    });
  });

  test("forwards events from non-default resolver streams", async () => {
    const deps = await createTestDeps();
    const defaultStream = createTestHarnessEventStream();
    const alternateStream = createTestHarnessEventStream();
    deps.harnesses.createHarnessEventStreams = () => [defaultStream, alternateStream];
    deps.harnesses.createDefaultHarnessEventStream = () => defaultStream;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createEventRoutes);

      const request = new Request("http://localhost:3000/");
      const responsePromise = app.request(request);

      await new Promise((r) => setTimeout(r, 10));

      alternateStream.emit({
        type: "session.idle",
        sessionID: "ses_from_alternate_stream",
        properties: {
          sessionID: "ses_from_alternate_stream",
        },
      });

      const response = await responsePromise;
      const events = await Promise.race([
        readSSEEvents(response, 1),
        new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
      ]);

      expect(events).toHaveLength(1);
      expect(JSON.parse(events[0])).toEqual({
        type: "session.idle",
        properties: {
          sessionID: "ses_from_alternate_stream",
        },
      });
    });
  });

  test("unsubscribes all resolver streams on abort", async () => {
    const deps = await createTestDeps();
    const streams = [createTestHarnessEventStream(), createTestHarnessEventStream()];
    let activeSubscriptions = 0;

    deps.harnesses.createHarnessEventStreams = () =>
      streams.map((stream) => ({
        subscribe(listener) {
          activeSubscriptions += 1;
          const unsubscribe = stream.subscribe(listener);
          return () => {
            activeSubscriptions -= 1;
            unsubscribe();
          };
        },
      }));
    deps.harnesses.createDefaultHarnessEventStream = () => streams[0];

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createEventRoutes);

      const request = new Request("http://localhost:3000/");
      const response = await app.request(request);

      await new Promise((r) => setTimeout(r, 10));
      expect(activeSubscriptions).toBe(2);

      await response.body?.cancel();
      await new Promise((r) => setTimeout(r, 10));

      expect(activeSubscriptions).toBe(0);
    });
  });

  test("forwards Birdhouse synthetic events from the workspace bus", async () => {
    const _deps = await createTestDeps();
    await withDeps(_deps, async () => {
      const app = await withWorkspaceContext(createEventRoutes);
      const bus = getWorkspaceEventBus("/test/workspace");

      const request = new Request("http://localhost:3000/");
      const responsePromise = app.request(request);

      await new Promise((r) => setTimeout(r, 10));

      bus.emit({
        type: "birdhouse.agent.created",
        properties: {
          agentId: "agent_created_1",
          agent: { id: "agent_created_1", title: "Created Agent" },
        },
      });

      const response = await responsePromise;
      const events = await Promise.race([
        readSSEEvents(response, 1),
        new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
      ]);

      expect(events).toHaveLength(1);
      const eventData = JSON.parse(events[0]);
      expect(eventData.type).toBe("birdhouse.agent.created");
      expect(eventData.properties.agentId).toBe("agent_created_1");
      expect(eventData.properties.agent.title).toBe("Created Agent");
    });
  });

  test("drops malformed frontend-consumed harness events", async () => {
    const deps = await createTestDeps();
    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createEventRoutes);
      const stream = getResolverStream(deps);

      const request = new Request("http://localhost:3000/");
      const responsePromise = app.request(request);

      await new Promise((r) => setTimeout(r, 10));

      stream.emit({
        type: "session.status",
        sessionID: "ses_bad_status",
        properties: {
          sessionID: "ses_bad_status",
          status: { type: "broken" },
        },
      });

      const response = await responsePromise;
      const events = await Promise.race([
        readSSEEvents(response, 1),
        new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
      ]);

      expect(events).toEqual([]);
    });
  });

  test("preserves ordering across harness and Birdhouse event sources", async () => {
    const _deps = await createTestDeps();
    await withDeps(_deps, async () => {
      const app = await withWorkspaceContext(createEventRoutes);
      const stream = getResolverStream(_deps);
      const bus = getWorkspaceEventBus("/test/workspace");

      const request = new Request("http://localhost:3000/");
      const responsePromise = app.request(request);

      await new Promise((r) => setTimeout(r, 10));

      stream.emit({
        type: "session.idle",
        sessionID: "ses_mixed_1",
        properties: { sessionID: "ses_mixed_1" },
      });

      bus.emit({
        type: "birdhouse.agent.created",
        properties: {
          agentId: "agent_mixed_1",
          agent: { id: "agent_mixed_1", title: "Mixed Agent" },
        },
      });

      const response = await responsePromise;
      const events = await Promise.race([
        readSSEEvents(response, 2),
        new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
      ]);

      expect(events).toHaveLength(2);

      const [harnessEvent, birdhouseEvent] = events.map((event) => JSON.parse(event));

      expect(harnessEvent).toEqual({
        type: "session.idle",
        properties: { sessionID: "ses_mixed_1" },
      });
      expect(birdhouseEvent).toEqual({
        type: "birdhouse.agent.created",
        properties: {
          agentId: "agent_mixed_1",
          agent: { id: "agent_mixed_1", title: "Mixed Agent" },
        },
      });
    });
  });

  test("handles multiple events in sequence", async () => {
    const _deps = await createTestDeps();
    await withDeps(_deps, async () => {
      const app = await withWorkspaceContext(createEventRoutes);
      const stream = getResolverStream(_deps);

      const request = new Request("http://localhost:3000/");
      const responsePromise = app.request(request);

      await new Promise((r) => setTimeout(r, 10));

      // Emit 3 different event types
      stream.emit({
        type: "session.created",
        sessionID: "ses_1",
        properties: { info: { id: "ses_1", title: "Session 1" } },
      });
      stream.emit({
        type: "message.part.updated",
        sessionID: "ses_1",
        properties: {
          part: {
            id: "part_1",
            sessionID: "ses_1",
            messageID: "msg_1",
            type: "text",
            text: "Update 1",
          },
        },
      });
      stream.emit({
        type: "session.idle",
        sessionID: "ses_1",
        properties: { sessionID: "ses_1" },
      });

      const response = await responsePromise;
      const events = await Promise.race([
        readSSEEvents(response, 3),
        new Promise<string[]>((r) => setTimeout(() => r([]), 200)),
      ]);

      expect(events.length).toBeGreaterThanOrEqual(3);

      const parsed = events.map((e) => JSON.parse(e));
      expect(parsed[0].type).toBe("session.created");
      expect(parsed[1].type).toBe("message.part.updated");
      expect(parsed[2].type).toBe("session.idle");
    });
  });

  describe("AgentID Translation", () => {
    test("adds agentId to message.part.updated events using part.sessionID", async () => {
      const _deps = await createTestDeps();
      await withDeps(_deps, async () => {
        const { agentsDB } = useDeps();

        // Setup: Create an agent in the database
        createRootAgent(agentsDB, {
          id: "agent_123",
          session_id: "ses_test_456",
          model: "test-model",
        });

        const app = await withWorkspaceContext(createEventRoutes, { agentsDb: agentsDB });
        const stream = getResolverStream(_deps);

        const request = new Request("http://localhost:3000/");
        const responsePromise = app.request(request);

        await new Promise((r) => setTimeout(r, 10));

        // Emit message.part.updated with sessionID inside part
        stream.emit({
          type: "message.part.updated",
          sessionID: "ses_test_456",
          properties: {
            part: {
              id: "part_abc",
              messageID: "msg_def",
              sessionID: "ses_test_456",
              type: "text",
              text: "Hello",
            },
          },
        });

        const response = await responsePromise;
        const events = await Promise.race([
          readSSEEvents(response, 1),
          new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
        ]);

        expect(events).toHaveLength(1);
        const eventData = JSON.parse(events[0]);

        // Verify agentId was added
        expect(eventData.properties.agentId).toBe("agent_123");
        // Verify part is still there
        expect(eventData.properties.part.sessionID).toBe("ses_test_456");
      });
    });

    test("adds agentId to session.idle events using properties.sessionID", async () => {
      const _deps = await createTestDeps();
      await withDeps(_deps, async () => {
        const { agentsDB } = useDeps();

        // Setup: Create an agent
        createRootAgent(agentsDB, {
          id: "agent_456",
          session_id: "ses_idle_789",
          model: "test-model",
        });

        const app = await withWorkspaceContext(createEventRoutes, { agentsDb: agentsDB });
        const stream = getResolverStream(_deps);

        const request = new Request("http://localhost:3000/");
        const responsePromise = app.request(request);

        await new Promise((r) => setTimeout(r, 10));

        // Emit session.idle with sessionID in properties
        stream.emit({
          type: "session.idle",
          sessionID: "ses_idle_789",
          properties: {
            sessionID: "ses_idle_789",
          },
        });

        const response = await responsePromise;
        const events = await Promise.race([
          readSSEEvents(response, 1),
          new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
        ]);

        expect(events).toHaveLength(1);
        const eventData = JSON.parse(events[0]);

        // Verify agentId was added
        expect(eventData.properties.agentId).toBe("agent_456");
        expect(eventData.properties.sessionID).toBe("ses_idle_789");
      });
    });

    test("adds agentId to session.error events", async () => {
      const _deps = await createTestDeps();
      await withDeps(_deps, async () => {
        const { agentsDB } = useDeps();

        createRootAgent(agentsDB, {
          id: "agent_error",
          session_id: "ses_error_123",
          model: "test-model",
        });

        const app = await withWorkspaceContext(createEventRoutes, { agentsDb: agentsDB });
        const stream = getResolverStream(_deps);

        const request = new Request("http://localhost:3000/");
        const responsePromise = app.request(request);

        await new Promise((r) => setTimeout(r, 10));

        stream.emit({
          type: "session.error",
          sessionID: "ses_error_123",
          properties: {
            sessionID: "ses_error_123",
            error: { name: "TestError", data: { message: "Test error" } },
          },
        });

        const response = await responsePromise;
        const events = await Promise.race([
          readSSEEvents(response, 1),
          new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
        ]);

        expect(events).toHaveLength(1);
        const eventData = JSON.parse(events[0]);

        expect(eventData.properties.agentId).toBe("agent_error");
        expect(eventData.properties.sessionID).toBe("ses_error_123");
      });
    });

    test("adds agentId to Birdhouse bus events when sessionID is provided", async () => {
      const _deps = await createTestDeps();
      await withDeps(_deps, async () => {
        const { agentsDB } = useDeps();

        createRootAgent(agentsDB, {
          id: "agent_bus_123",
          session_id: "ses_bus_123",
          model: "test-model",
        });

        const app = await withWorkspaceContext(createEventRoutes, { agentsDb: agentsDB });
        const bus = getWorkspaceEventBus("/test/workspace");

        const request = new Request("http://localhost:3000/");
        const responsePromise = app.request(request);

        await new Promise((r) => setTimeout(r, 10));

        bus.emit({
          type: "birdhouse.agent.updated",
          sessionID: "ses_bus_123",
          properties: {
            agent: { id: "agent_bus_123", title: "Updated Agent" },
          },
        });

        const response = await responsePromise;
        const events = await Promise.race([
          readSSEEvents(response, 1),
          new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
        ]);

        expect(events).toHaveLength(1);
        const eventData = JSON.parse(events[0]);
        expect(eventData.type).toBe("birdhouse.agent.updated");
        expect(eventData.properties.agentId).toBe("agent_bus_123");
        expect(eventData.properties.agent.title).toBe("Updated Agent");
      });
    });

    test("caches sessionID to agentId lookups", async () => {
      const _deps = await createTestDeps();
      await withDeps(_deps, async () => {
        const { agentsDB } = useDeps();

        createRootAgent(agentsDB, {
          id: "agent_cache",
          session_id: "ses_cache_test",
          model: "test-model",
        });

        const app = await withWorkspaceContext(createEventRoutes, { agentsDb: agentsDB });
        const stream = getResolverStream(_deps);

        const request = new Request("http://localhost:3000/");
        const responsePromise = app.request(request);

        await new Promise((r) => setTimeout(r, 10));

        // Emit multiple events with same sessionID
        for (let i = 0; i < 3; i++) {
          stream.emit({
            type: "message.part.updated",
            sessionID: "ses_cache_test",
            properties: {
              part: {
                id: `part_${i}`,
                messageID: "msg_cache",
                sessionID: "ses_cache_test",
                type: "text",
                text: `Message ${i}`,
              },
            },
          });
        }

        const response = await responsePromise;
        const events = await Promise.race([
          readSSEEvents(response, 3),
          new Promise<string[]>((r) => setTimeout(() => r([]), 200)),
        ]);

        // All events should have agentId
        expect(events.length).toBe(3);
        for (const event of events) {
          const eventData = JSON.parse(event);
          expect(eventData.properties.agentId).toBe("agent_cache");
        }
      });
    });

    test("forwards non-session events unchanged (no agentId added)", async () => {
      const _deps = await createTestDeps();
      await withDeps(_deps, async () => {
        const app = await withWorkspaceContext(createEventRoutes);
        const stream = getResolverStream(_deps);

        const request = new Request("http://localhost:3000/");
        const responsePromise = app.request(request);

        await new Promise((r) => setTimeout(r, 10));

        // Emit an event type frontend doesn't handle
        stream.emit({
          type: "workspace.updated",
          properties: {
            workspaceId: "ws_123",
            changes: ["file1.ts"],
          },
        });

        const response = await responsePromise;
        const events = await Promise.race([
          readSSEEvents(response, 1),
          new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
        ]);

        expect(events).toHaveLength(1);
        const eventData = JSON.parse(events[0]);

        // Event should be forwarded unchanged
        expect(eventData.type).toBe("workspace.updated");
        expect(eventData.properties.workspaceId).toBe("ws_123");
        // No agentId should be added
        expect(eventData.properties.agentId).toBeUndefined();
      });
    });

    test("forwards frontend-handled events even when agent lookup fails", async () => {
      const _deps = await createTestDeps();
      await withDeps(_deps, async () => {
        const app = await withWorkspaceContext(createEventRoutes);
        const stream = getResolverStream(_deps);

        const request = new Request("http://localhost:3000/");
        const responsePromise = app.request(request);

        await new Promise((r) => setTimeout(r, 10));

        // Emit event with sessionID that doesn't exist in DB
        stream.emit({
          type: "message.part.updated",
          sessionID: "ses_nonexistent",
          properties: {
            part: {
              id: "part_orphan",
              messageID: "msg_orphan",
              sessionID: "ses_nonexistent",
              type: "text",
              text: "Orphaned message",
            },
          },
        });

        const response = await responsePromise;
        const events = await Promise.race([
          readSSEEvents(response, 1),
          new Promise<string[]>((r) => setTimeout(() => r([]), 100)),
        ]);

        // Event should still be forwarded (just without agentId)
        expect(events).toHaveLength(1);
        const eventData = JSON.parse(events[0]);

        expect(eventData.type).toBe("message.part.updated");
        expect(eventData.properties.part.sessionID).toBe("ses_nonexistent");
        // agentId will be undefined (lookup failed)
        expect(eventData.properties.agentId).toBeUndefined();
      });
    });
  });
});
