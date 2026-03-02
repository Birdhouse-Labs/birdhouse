// ABOUTME: Unit tests for SSEContext provider and hooks
// ABOUTME: Tests reactive store updates, connection lifecycle, and event buffering

import { render, waitFor } from "@solidjs/testing-library";
import { createEffect, createRoot } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDeps, DepsProvider } from "../deps";
import { getMockEventSource, resetMockEventSource } from "../lib/event-source";
import { type SSEEvent, SSEProvider, useSSE } from "./SSEContext";

describe("SSEProvider", () => {
  beforeEach(() => {
    resetMockEventSource();
    vi.clearAllMocks();
  });

  it("creates EventSource with /api/events URL", () => {
    const deps = createTestDeps();
    render(() => (
      <DepsProvider deps={deps}>
        <SSEProvider>
          <div>Test</div>
        </SSEProvider>
      </DepsProvider>
    ));

    const mock = getMockEventSource();
    expect(mock).not.toBeNull();
    expect(mock?.url).toBe("/api/events");
  });

  it("sets connected to true when connection opens", async () => {
    const deps = createTestDeps();
    let storeValue: StoreSnapshot | null = null;

    render(() => (
      <DepsProvider deps={deps}>
        <SSEProvider>
          <TestConsumer
            onRender={(store: StoreSnapshot) => {
              storeValue = store;
            }}
          />
        </SSEProvider>
      </DepsProvider>
    ));

    expect((storeValue as StoreSnapshot | null)?.connected).toBe(false);

    const mock = getMockEventSource();
    mock?.simulateOpen();

    await waitFor(() => {
      expect((storeValue as StoreSnapshot | null)?.connected).toBe(true);
    });
  });

  it("sets error when connection fails", async () => {
    const deps = createTestDeps();
    let storeValue: StoreSnapshot | null = null;

    render(() => (
      <DepsProvider deps={deps}>
        <SSEProvider>
          <TestConsumer
            onRender={(store: StoreSnapshot) => {
              storeValue = store;
            }}
          />
        </SSEProvider>
      </DepsProvider>
    ));

    const mock = getMockEventSource();
    mock?.simulateError();

    await waitFor(() => {
      expect((storeValue as StoreSnapshot | null)?.connected).toBe(false);
      expect((storeValue as StoreSnapshot | null)?.error).toBe("Connection failed");
    });
  });

  it("updates latestEvent when message received", async () => {
    const deps = createTestDeps();
    let storeValue: StoreSnapshot | null = null;

    render(() => (
      <DepsProvider deps={deps}>
        <SSEProvider>
          <TestConsumer
            onRender={(store: StoreSnapshot) => {
              storeValue = store;
            }}
          />
        </SSEProvider>
      </DepsProvider>
    ));

    const testEvent: SSEEvent = {
      type: "test",
      session: { id: "ses_123", title: "Test Session" },
    };

    const mock = getMockEventSource();
    mock?.simulateMessage(testEvent);

    await waitFor(() => {
      expect((storeValue as StoreSnapshot | null)?.latestEvent).toEqual(testEvent);
    });
  });

  it("appends events to events array", async () => {
    const deps = createTestDeps();
    let storeValue: StoreSnapshot | null = null;

    render(() => (
      <DepsProvider deps={deps}>
        <SSEProvider>
          <TestConsumer
            onRender={(store: StoreSnapshot) => {
              storeValue = store;
            }}
          />
        </SSEProvider>
      </DepsProvider>
    ));

    const mock = getMockEventSource();

    // Send events
    mock?.simulateMessage({ type: "test", seq: 1 });

    await waitFor(() => {
      expect((storeValue as StoreSnapshot | null)?.events).toHaveLength(1);
    });

    mock?.simulateMessage({ type: "test", seq: 2 });

    await waitFor(() => {
      expect((storeValue as StoreSnapshot | null)?.events).toHaveLength(2);
    });

    mock?.simulateMessage({ type: "test", seq: 3 });

    await waitFor(() => {
      expect((storeValue as StoreSnapshot | null)?.events).toHaveLength(3);
    });

    // Verify all events are in the array
    expect((storeValue as StoreSnapshot | null)?.events.length).toBe(3);
  });

  it("limits events buffer to 100 items", async () => {
    const deps = createTestDeps();
    let storeValue: StoreSnapshot | null = null;

    render(() => (
      <DepsProvider deps={deps}>
        <SSEProvider>
          <TestConsumer
            onRender={(store: StoreSnapshot) => {
              storeValue = store;
            }}
          />
        </SSEProvider>
      </DepsProvider>
    ));

    const mock = getMockEventSource();

    // Send 105 events
    for (let i = 0; i < 105; i++) {
      mock?.simulateMessage({ type: `event${i}`, index: i });
    }

    await waitFor(() => {
      expect((storeValue as StoreSnapshot | null)?.events).toHaveLength(100);
      // Should have kept the last 100 (events 5-104)
      expect(
        (
          (storeValue as StoreSnapshot | null)?.events[0] as unknown as {
            index: number;
          }
        )?.index,
      ).toBe(5);
      expect(
        (
          (storeValue as StoreSnapshot | null)?.events[99] as unknown as {
            index: number;
          }
        )?.index,
      ).toBe(104);
    });
  });

  it("closes EventSource on cleanup", () => {
    const deps = createTestDeps();
    const closeSpy = vi.fn();

    const { unmount } = render(() => (
      <DepsProvider deps={deps}>
        <SSEProvider>
          <div>Test</div>
        </SSEProvider>
      </DepsProvider>
    ));

    const mock = getMockEventSource();
    if (mock) {
      mock.close = closeSpy;
    }

    unmount();

    expect(closeSpy).toHaveBeenCalledOnce();
  });

  it("logs error for malformed JSON messages", async () => {
    const deps = createTestDeps();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(() => (
      <DepsProvider deps={deps}>
        <SSEProvider>
          <div>Test</div>
        </SSEProvider>
      </DepsProvider>
    ));

    const mock = getMockEventSource();
    // Simulate a message with invalid JSON by directly calling onmessage
    const es = mock as unknown as EventSource;
    es.onmessage?.({ data: "invalid json" } as MessageEvent);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });

  it("throws error when useSSE is called outside provider", () => {
    expect(() => {
      createRoot(() => {
        useSSE();
      });
    }).toThrow("useSSE must be used within SSEProvider");
  });

  it("clears error on successful reconnect", async () => {
    const deps = createTestDeps();
    let storeValue: { connected: boolean; error: string | null } | null = null;

    render(() => (
      <DepsProvider deps={deps}>
        <SSEProvider>
          <TestConsumer
            onRender={(store: StoreSnapshot) => {
              storeValue = store;
            }}
          />
        </SSEProvider>
      </DepsProvider>
    ));

    const mock = getMockEventSource();

    // First, trigger an error
    mock?.simulateError();

    await waitFor(() => {
      expect((storeValue as StoreSnapshot | null)?.error).toBe("Connection failed");
    });

    // Then simulate successful connection
    mock?.simulateOpen();

    await waitFor(() => {
      expect((storeValue as StoreSnapshot | null)?.connected).toBe(true);
      expect((storeValue as StoreSnapshot | null)?.error).toBeNull();
    });
  });
});

// Type alias for store values
type StoreSnapshot = {
  connected: boolean;
  error: string | null;
  latestEvent: SSEEvent | null;
  events: SSEEvent[];
};

// Helper component to access store values
function TestConsumer(props: { onRender: (store: StoreSnapshot) => void }) {
  const { store } = useSSE();

  createEffect(() => {
    props.onRender(store);
  });

  return <div>Consumer</div>;
}
