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
  // Dynamic import to get the correct stream instance in test context
  const { getOpenCodeStream } = await import("../lib/opencode-stream");
  const stream = getOpenCodeStream();
  const events: CapturedEvent[] = [];
  const originalEmit = stream.emitCustomEvent.bind(stream);

  // Spy on emitCustomEvent
  stream.emitCustomEvent = (type: string, properties: Record<string, unknown>) => {
    events.push({ type, properties });
    originalEmit(type, properties);
  };

  // Return events array and cleanup function
  return {
    events,
    cleanup: () => {
      stream.emitCustomEvent = originalEmit;

      // Warn if no events were captured - likely indicates stream instance mismatch
      // This helps detect bugs where handlers create new OpenCodeStream() instead of using singleton
      if (events.length === 0) {
        // Only show warning in test environment
        const isTest = process.env.NODE_ENV === "test" || (typeof Bun !== "undefined" && Bun?.main?.includes(".test."));
        if (isTest) {
          console.warn(
            "\n⚠️  WARNING: captureStreamEvents() captured 0 events.\n" +
              "This may indicate a stream instance mismatch issue.\n\n" +
              "Common causes:\n" +
              "  1. Handler creates 'new OpenCodeStream()' instead of using getWorkspaceStream()\n" +
              "  2. Events are emitted on a different stream instance than the spy\n" +
              "  3. No events were actually emitted (check handler logic)\n\n" +
              "Fix: Ensure handlers use getWorkspaceStream() or getOpenCodeStream() singleton.\n" +
              "See docs/TESTING.md for more details.\n",
          );
        }
      }
    },
  };
}
