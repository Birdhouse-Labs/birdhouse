// ABOUTME: Test helper for capturing SSE events emitted during tests
// ABOUTME: Simplifies event spying by providing cleanup and type-safe event capture

export interface CapturedEvent {
  type: string;
  properties: Record<string, unknown>;
}

/**
 * Set up SSE event capture for tests
 * Spies on stream.emitCustomEvent and captures all events
 *
 * IMPORTANT: Must be called INSIDE withDeps() callback, after dependencies are set up
 *
 * @returns Object with events array and cleanup function
 * @example
 * ```typescript
 * await withDeps(deps, async () => {
 *   const { events, cleanup } = captureStreamEvents();
 *   // ... test code that emits events ...
 *   expect(events).toHaveLength(2);
 *   expect(events[0].type).toBe("birdhouse.agent.created");
 *   cleanup();
 * });
 * ```
 */
export async function captureStreamEvents(): Promise<{
  events: CapturedEvent[];
  cleanup: () => void;
}> {
  const { getWorkspaceEventBus } = await import("../lib/birdhouse-event-bus");
  const bus = getWorkspaceEventBus("/test/workspace");
  const events: CapturedEvent[] = [];
  const unsubscribe = bus.subscribe((event) => {
    events.push({ type: event.type, properties: event.properties });
  });

  // Return events array and cleanup function
  return {
    events,
    cleanup: () => {
      unsubscribe();

      // Warn if no events were captured - likely indicates bus instance mismatch
      if (events.length === 0) {
        // Only show warning in test environment
        const isTest = process.env.NODE_ENV === "test" || (typeof Bun !== "undefined" && Bun?.main?.includes(".test."));
        if (isTest) {
          console.warn(
            "\n⚠️  WARNING: captureStreamEvents() captured 0 events.\n" +
              "This may indicate an event bus instance mismatch issue.\n\n" +
              "Common causes:\n" +
              "  1. Handler emits on a different workspace event bus than the spy\n" +
              "  2. Events are emitted on the harness stream instead of the Birdhouse bus\n" +
              "  3. No events were actually emitted (check handler logic)\n\n" +
              "Fix: Ensure handlers use getWorkspaceEventBus() for Birdhouse synthetic events.\n" +
              "See docs/TESTING.md for more details.\n",
          );
        }
      }
    },
  };
}
