// ABOUTME: Integration tests demonstrating real-world usage of DI helpers
// ABOUTME: Shows how helpers work with EventEmitter streams and timing functions

import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { createTestDeps, onWithDeps, setTimeoutWithDeps, useDeps, withDeps } from "./dependencies";

// Helper
async function createMockDeps() {
  return createTestDeps();
}

describe("Helpers Integration", () => {
  test("SSE-like scenario: event handlers access deps", async () => {
    const emitter = new EventEmitter();
    const processedEvents: string[] = [];

    const deps = await createMockDeps();

    await withDeps(deps, async () => {
      // Subscribe to stream with deps preserved
      const cleanup = onWithDeps<{ sessionId: string }>(emitter, "session.created", async (event) => {
        // Can use useDeps() pattern here!
        const {
          harness: { getSession },
        } = useDeps();

        const session = await getSession(event.sessionId);
        processedEvents.push(`${session.id}:${session.title}`);
      });

      // Emit events
      emitter.emit("session.created", { sessionId: "ses_1" });
      emitter.emit("session.created", { sessionId: "ses_2" });

      // Give async handlers time to complete
      await new Promise((r) => setTimeout(r, 20));

      cleanup();
    });

    expect(processedEvents).toHaveLength(2);
    expect(processedEvents[0]).toBe("ses_1:Session ses_1");
    expect(processedEvents[1]).toBe("ses_2:Session ses_2");
  });

  test("Background job scenario: setTimeout accesses deps", async () => {
    const completedJobs: string[] = [];

    const deps = await createMockDeps();

    await withDeps(deps, async () => {
      // Schedule background job with deps preserved
      setTimeoutWithDeps(async () => {
        const {
          harness: { getSession },
        } = useDeps();

        const session = await getSession("ses_123");
        completedJobs.push(session.title || "No title");
      }, 10);

      // Wait for job to complete
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(completedJobs).toContain("Session ses_123");
  });

  test("Multiple concurrent handlers share same deps", async () => {
    const emitter = new EventEmitter();
    const results = {
      handler1: [] as string[],
      handler2: [] as string[],
    };

    const deps = await createMockDeps();

    await withDeps(deps, async () => {
      const cleanup1 = onWithDeps<string>(emitter, "event", async (data) => {
        const {
          harness: { getSession },
        } = useDeps();
        const session = await getSession(data);
        results.handler1.push(session.title);
      });

      const cleanup2 = onWithDeps<string>(emitter, "event", async (data) => {
        const {
          harness: { getSession },
        } = useDeps();
        const session = await getSession(data);
        results.handler2.push(session.title);
      });

      emitter.emit("event", "ses_concurrent");

      await new Promise((r) => setTimeout(r, 20));

      cleanup1();
      cleanup2();
    });

    // Both handlers got the event and could access deps
    expect(results.handler1).toEqual(["Session ses_concurrent"]);
    expect(results.handler2).toEqual(["Session ses_concurrent"]);
  });
});
