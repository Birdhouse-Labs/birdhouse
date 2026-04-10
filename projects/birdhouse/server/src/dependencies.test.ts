// ABOUTME: Unit tests for AsyncLocalStorage-based dependency injection system
// ABOUTME: Tests context preservation across async operations, event handlers, and timeouts

import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { Deps } from "./dependencies";
import {
  createPosthogDeps,
  createTestDeps,
  getDefaultHarness,
  onWithDeps,
  setTimeoutWithDeps,
  useDeps,
  withCurrentDeps,
  withDeps,
} from "./dependencies";

// Helper to create mock deps with custom getSession behavior
async function createMockDeps(): Promise<Deps> {
  return createTestDeps({
    getSession: async (sessionId: string) => ({
      id: sessionId,
      title: `Session ${sessionId}`,
      projectID: "test",
      directory: "/test",
      version: "1.0",
      time: { created: 0, updated: 0 },
    }),
  });
}

describe("Dependencies", () => {
  test("useDeps throws error when no context", () => {
    expect(() => useDeps()).toThrow("Dependencies not available");
  });

  test("withDeps provides deps context", async () => {
    const deps = await createMockDeps();

    withDeps(deps, () => {
      const retrieved = useDeps();
      expect(retrieved).toBe(deps);
    });
  });

  test("createTestDeps exposes the default harness through the resolver", async () => {
    const deps = await createTestDeps();

    expect(deps.harnesses.default()).toBe(getDefaultHarness(deps));
    expect(deps.harnesses.forKind(getDefaultHarness(deps).kind)).toBe(getDefaultHarness(deps));
  });

  test("createPosthogDeps does not require OpenCode base", async () => {
    const originalBase = process.env.BIRDHOUSE_OPENCODE_BASE;
    delete process.env.BIRDHOUSE_OPENCODE_BASE;

    const deps = await createPosthogDeps();

    expect(deps.posthog).toBeDefined();

    if (originalBase) {
      process.env.BIRDHOUSE_OPENCODE_BASE = originalBase;
    } else {
      delete process.env.BIRDHOUSE_OPENCODE_BASE;
    }
  });

  test("createPosthogDeps does not expose workspace-scoped deps", async () => {
    const deps = await createPosthogDeps();

    expect(() => deps.agentsDB).toThrow("agentsDB is unavailable in PostHog ingest context");
    expect(() => deps.harnesses).toThrow("harnesses is unavailable in PostHog ingest context");
    expect(() => deps.getBirdhouseEventBus("/tmp")).toThrow(
      "getBirdhouseEventBus is unavailable in PostHog ingest context",
    );
  });

  test("context preserved across async operations", async () => {
    const deps = await createMockDeps();

    await withDeps(deps, async () => {
      const before = useDeps();

      await new Promise((r) => setTimeout(r, 10));

      const after = useDeps();
      expect(after).toBe(before);
    });
  });

  test("withCurrentDeps preserves context in callbacks", async () => {
    const deps = await createMockDeps();
    let capturedDeps: Deps | undefined;

    await withDeps(deps, async () => {
      const callback = withCurrentDeps(() => {
        capturedDeps = useDeps();
      });

      // Call later (outside original context in timer)
      setTimeout(callback, 10);
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(capturedDeps).toBe(deps);
  });

  test("onWithDeps preserves context in event handlers", async () => {
    const emitter = new EventEmitter();
    const received: string[] = [];
    const deps = await createMockDeps();

    await withDeps(deps, async () => {
      const cleanup = onWithDeps<string>(emitter, "test-event", (data) => {
        const harness = getDefaultHarness(useDeps()); // Should work!
        expect(harness).toBeDefined();
        received.push(data);
      });

      emitter.emit("test-event", "hello");
      emitter.emit("test-event", "world");

      cleanup();

      // After cleanup, should not receive
      emitter.emit("test-event", "ignored");
    });

    expect(received).toEqual(["hello", "world"]);
  });

  test("automatically uses test deps in test environment", async () => {
    const deps = await createTestDeps();
    await withDeps(deps, async () => {
      const { getSession } = getDefaultHarness(useDeps());
      const session = await getSession("ses_123");

      // Should be mock data (not real API call)
      expect(session.title).toBe("Session ses_123");
      expect(session.id).toBe("ses_123");
    });
  });

  test("can override specific dependencies", async () => {
    const customDeps = await createTestDeps({
      getSession: async () => ({
        id: "custom",
        title: "Custom Mock",
        projectID: "custom",
        directory: "/custom",
        version: "1.0",
        time: { created: 123, updated: 123 },
      }),
    });

    await withDeps(customDeps, async () => {
      const { getSession } = getDefaultHarness(useDeps());
      const session = await getSession("any");
      expect(session.title).toBe("Custom Mock");
      expect(session.id).toBe("custom");
    });
  });

  test("setTimeoutWithDeps preserves context in timeout callbacks", async () => {
    const calls: string[] = [];
    const deps = await createMockDeps();

    await withDeps(deps, async () => {
      setTimeoutWithDeps(() => {
        const harness = getDefaultHarness(useDeps()); // Should work!
        expect(harness).toBeDefined();
        calls.push("timeout-fired");
      }, 10);

      await new Promise((r) => setTimeout(r, 20));
    });

    expect(calls).toEqual(["timeout-fired"]);
  });

  test("context preserved through nested async functions", async () => {
    const deps = await createMockDeps();

    async function level1() {
      const harness = getDefaultHarness(useDeps());
      expect(harness).toBeDefined();
      return level2();
    }

    async function level2() {
      const harness = getDefaultHarness(useDeps());
      expect(harness).toBeDefined();
      await level3();
    }

    async function level3() {
      const { getSession } = getDefaultHarness(useDeps());
      const session = await getSession("ses_nested");
      expect(session.id).toBe("ses_nested");
    }

    await withDeps(deps, async () => {
      await level1();
    });
  });

  test("context preserved in Promise.all", async () => {
    const deps = await createMockDeps();

    await withDeps(deps, async () => {
      const results = await Promise.all([
        (async () => {
          const { getSession } = getDefaultHarness(useDeps());
          return getSession("ses_1");
        })(),
        (async () => {
          const { getSession } = getDefaultHarness(useDeps());
          return getSession("ses_2");
        })(),
        (async () => {
          const { getSession } = getDefaultHarness(useDeps());
          return getSession("ses_3");
        })(),
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe("ses_1");
      expect(results[1].id).toBe("ses_2");
      expect(results[2].id).toBe("ses_3");
    });
  });
});
