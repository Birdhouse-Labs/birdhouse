// ABOUTME: Tests for SSE event streaming endpoint
// ABOUTME: Simple proxy that forwards all OpenCode events to clients

import { afterEach, describe, expect, test } from "bun:test";
import { createTestDeps, useDeps, withDeps } from "../dependencies";
import { getWorkspaceEventBus, resetBirdhouseEventBus } from "../lib/birdhouse-event-bus";
import { getOpenCodeStream, resetStream } from "../lib/opencode-stream";
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

afterEach(() => {
  resetStream();
  resetBirdhouseEventBus();
});

describe("GET /api/events (SSE)", () => {
  test("proxies all event types through wildcard listener", async () => {
    const _deps = await createTestDeps();
    await withDeps(_deps, async () => {
      const app = await withWorkspaceContext(createEventRoutes);
      const stream = getOpenCodeStream();

      const request = new Request("http://localhost:3000/");
      const responsePromise = app.request(request);

      await new Promise((r) => setTimeout(r, 10));

      // Emit events via wildcard (how OpenCodeStream emits them)
      stream.emit("*", {
        payload: {
          type: "message.part.updated",
          properties: {
            part: {
              id: "part_123",
              messageID: "msg_456",
              sessionID: "ses_789",
              type: "text",
              text: "Hello world",
            },
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
      const stream = getOpenCodeStream();

      const request = new Request("http://localhost:3000/");
      const responsePromise = app.request(request);

      await new Promise((r) => setTimeout(r, 10));

      stream.emit("*", {
        payload: {
          type: "session.idle",
          properties: { sessionID: "ses_complete" },
        },
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

  test("handles multiple events in sequence", async () => {
    const _deps = await createTestDeps();
    await withDeps(_deps, async () => {
      const app = await withWorkspaceContext(createEventRoutes);
      const stream = getOpenCodeStream();

      const request = new Request("http://localhost:3000/");
      const responsePromise = app.request(request);

      await new Promise((r) => setTimeout(r, 10));

      // Emit 3 different event types
      stream.emit("*", {
        payload: {
          type: "session.created",
          properties: { info: { id: "ses_1", title: "Session 1" } },
        },
      });
      stream.emit("*", {
        payload: {
          type: "message.part.updated",
          properties: { part: { id: "part_1", text: "Update 1" } },
        },
      });
      stream.emit("*", {
        payload: {
          type: "session.idle",
          properties: { sessionID: "ses_1" },
        },
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
        const stream = getOpenCodeStream();

        const request = new Request("http://localhost:3000/");
        const responsePromise = app.request(request);

        await new Promise((r) => setTimeout(r, 10));

        // Emit message.part.updated with sessionID inside part
        stream.emit("*", {
          payload: {
            type: "message.part.updated",
            properties: {
              part: {
                id: "part_abc",
                messageID: "msg_def",
                sessionID: "ses_test_456",
                type: "text",
                text: "Hello",
              },
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
        const stream = getOpenCodeStream();

        const request = new Request("http://localhost:3000/");
        const responsePromise = app.request(request);

        await new Promise((r) => setTimeout(r, 10));

        // Emit session.idle with sessionID in properties
        stream.emit("*", {
          payload: {
            type: "session.idle",
            properties: {
              sessionID: "ses_idle_789",
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
        const stream = getOpenCodeStream();

        const request = new Request("http://localhost:3000/");
        const responsePromise = app.request(request);

        await new Promise((r) => setTimeout(r, 10));

        stream.emit("*", {
          payload: {
            type: "session.error",
            properties: {
              sessionID: "ses_error_123",
              error: { name: "TestError", data: { message: "Test error" } },
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
        const stream = getOpenCodeStream();

        const request = new Request("http://localhost:3000/");
        const responsePromise = app.request(request);

        await new Promise((r) => setTimeout(r, 10));

        // Emit multiple events with same sessionID
        for (let i = 0; i < 3; i++) {
          stream.emit("*", {
            payload: {
              type: "message.part.updated",
              properties: {
                part: {
                  id: `part_${i}`,
                  messageID: "msg_cache",
                  sessionID: "ses_cache_test",
                  type: "text",
                  text: `Message ${i}`,
                },
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
        const stream = getOpenCodeStream();

        const request = new Request("http://localhost:3000/");
        const responsePromise = app.request(request);

        await new Promise((r) => setTimeout(r, 10));

        // Emit an event type frontend doesn't handle
        stream.emit("*", {
          payload: {
            type: "workspace.updated",
            properties: {
              workspaceId: "ws_123",
              changes: ["file1.ts"],
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
        const stream = getOpenCodeStream();

        const request = new Request("http://localhost:3000/");
        const responsePromise = app.request(request);

        await new Promise((r) => setTimeout(r, 10));

        // Emit event with sessionID that doesn't exist in DB
        stream.emit("*", {
          payload: {
            type: "message.part.updated",
            properties: {
              part: {
                id: "part_orphan",
                messageID: "msg_orphan",
                sessionID: "ses_nonexistent",
                type: "text",
                text: "Orphaned message",
              },
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
