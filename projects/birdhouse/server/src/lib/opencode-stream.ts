// ABOUTME: OpenCode global event stream singleton using EventEmitter
// ABOUTME: Auto test/live - only connects to real OpenCode in production

import { EventEmitter } from "node:events";
import { EventSource } from "eventsource";
import { getWorkspaceEventBus } from "./birdhouse-event-bus";
import { log } from "./logger";

// Event payload structure (from OpenCode's GlobalBus)
export interface OpenCodeEvent {
  directory?: string;
  payload: {
    type: string;
    properties: Record<string, unknown>;
  };
}

// Typed EventEmitter for OpenCode events
export class OpenCodeStream extends EventEmitter {
  private evtSource?: EventSource;
  private readonly baseUrl: string;
  private readonly workspaceRoot: string;

  constructor(baseUrl: string, workspaceRoot: string) {
    super();
    this.baseUrl = baseUrl;
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Connect to OpenCode global event stream
   * Only call in production - tests don't need real connection
   */
  async connect(): Promise<void> {
    if (this.evtSource) {
      return; // Already connected
    }

    const url = `${this.baseUrl}/global/event?directory=${encodeURIComponent(this.workspaceRoot)}`;
    log.stream.info({ url }, "Connecting to OpenCode event stream");

    this.evtSource = new EventSource(url);

    this.evtSource.onopen = () => {
      log.stream.info("OpenCode event stream connected");
    };

    this.evtSource.onmessage = (evt: MessageEvent) => {
      try {
        const event: OpenCodeEvent = JSON.parse(evt.data as string);
        log.stream.trace({ type: event.payload.type }, "Received OpenCode event");
        // Emit event with type from payload
        this.emit(event.payload.type, event.payload.properties);
        // Also emit raw event
        this.emit("*", event);
      } catch (error) {
        log.stream.error({ error, rawData: evt.data }, "Failed to parse OpenCode event");
      }
    };

    this.evtSource.onerror = (_error: Event) => {
      log.stream.error("OpenCode stream error");
    };
  }

  /**
   * Emit a custom Birdhouse event (not from OpenCode)
   * These events flow through the same stream as OpenCode events
   */
  emitCustomEvent(type: string, properties: Record<string, unknown>): void {
    const event: OpenCodeEvent = {
      directory: this.workspaceRoot,
      payload: {
        type,
        properties,
      },
    };
    log.stream.info({ type }, "Emitting custom Birdhouse event");
    // Emit both the typed event and wildcard (same pattern as OpenCode events)
    this.emit(type, properties);
    this.emit("*", event);
  }

  /**
   * Disconnect from OpenCode event stream
   */
  disconnect(): void {
    if (this.evtSource) {
      this.evtSource.close();
      this.evtSource = undefined as unknown as EventSource;
    }
    this.removeAllListeners();
  }
}

// Singleton instances (legacy global - kept for backward compatibility)
let liveStream: OpenCodeStream | null = null;
let testStream: OpenCodeStream | null = null;

// Workspace-scoped streams (multi-workspace support)
const workspaceStreams: Map<string, OpenCodeStream> = new Map();

/**
 * Get workspace-scoped OpenCode stream singleton
 * Returns the same stream instance for the same workspace
 *
 * @param baseUrl - OpenCode base URL for this workspace
 * @param workspaceDirectory - Workspace directory (used as the key)
 * @returns OpenCodeStream instance for this workspace
 */
/**
 * Broadcast Birdhouse synthetic events to all active workspace event buses.
 * Used for cross-workspace events like skill updates.
 */
export function broadcastToAllWorkspaces(eventType: string, properties: Record<string, unknown>): void {
  const isTest = process.env.NODE_ENV === "test" || (typeof Bun !== "undefined" && Bun?.main?.includes(".test."));

  if (isTest) {
    getWorkspaceEventBus("/test/workspace").emit({
      type: eventType,
      properties,
    });
    return;
  }

  for (const workspaceDirectory of workspaceStreams.keys()) {
    getWorkspaceEventBus(workspaceDirectory).emit({
      type: eventType,
      properties,
    });
  }

  log.stream.debug({ eventType, workspaceCount: workspaceStreams.size }, "Broadcasted event to all workspaces");
}

export function getWorkspaceStream(baseUrl: string, workspaceDirectory: string): OpenCodeStream {
  const isTest = process.env.NODE_ENV === "test" || (typeof Bun !== "undefined" && Bun?.main?.includes(".test."));

  if (isTest) {
    // In tests, return single test stream (tests don't need workspace isolation)
    if (!testStream) {
      testStream = new OpenCodeStream("http://test", "/test");
    }
    return testStream;
  }

  // Production: Use workspace directory as the key for singleton lookup
  let stream = workspaceStreams.get(workspaceDirectory);

  if (!stream) {
    stream = new OpenCodeStream(baseUrl, workspaceDirectory);
    stream.connect(); // Auto-connect in production
    workspaceStreams.set(workspaceDirectory, stream);
    log.stream.info({ workspaceDirectory, baseUrl }, "Created workspace-scoped stream");
  }

  return stream;
}

/**
 * Get OpenCode stream singleton (legacy - uses global BIRDHOUSE_WORKSPACE_ROOT)
 * Auto test/live switching - test stream doesn't connect
 *
 * @deprecated Use getWorkspaceStream() for multi-workspace support
 */
export function getOpenCodeStream(baseUrl?: string, workspaceRoot?: string): OpenCodeStream {
  const isTest = process.env.NODE_ENV === "test" || (typeof Bun !== "undefined" && Bun?.main?.includes(".test."));

  if (isTest) {
    if (!testStream) {
      testStream = new OpenCodeStream("http://test", "/test");
      // Don't connect in tests - events are emitted programmatically
    }
    return testStream;
  }

  // Production
  if (!liveStream) {
    // Use provided baseUrl or BIRDHOUSE_OPENCODE_BASE
    const url = baseUrl || process.env.BIRDHOUSE_OPENCODE_BASE;
    if (!url) {
      throw new Error("BIRDHOUSE_OPENCODE_BASE environment variable is required");
    }
    const root = workspaceRoot || process.env.BIRDHOUSE_WORKSPACE_ROOT || process.cwd();

    liveStream = new OpenCodeStream(url, root);
    liveStream.connect(); // Auto-connect in production
  }

  return liveStream;
}

/**
 * Reset stream (for tests)
 */
export function resetStream(): void {
  if (liveStream) {
    liveStream.disconnect();
    liveStream = null;
  }
  if (testStream) {
    testStream.disconnect();
    testStream = null;
  }
  // Clear workspace streams
  for (const stream of workspaceStreams.values()) {
    stream.disconnect();
  }
  workspaceStreams.clear();
}
