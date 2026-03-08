// ABOUTME: SSE endpoint for streaming OpenCode events to clients with universal agent ID translation
// ABOUTME: Workspace-scoped SSE stream using shared OpenCodeStream singleton

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getDepsFromContext } from "../lib/context-deps";
import { log } from "../lib/logger";
import type { OpenCodeEvent } from "../lib/opencode-stream";
import "../types/context";

export function createEventRoutes() {
  const app = new Hono();

  // GET / - Stream OpenCode events via SSE (workspace-scoped)
  app.get("/", (c) => {
    const { agentsDB, getStream } = getDepsFromContext(c);
    const opencodeBase = c.get("opencodeBase");
    const workspace = c.get("workspace");

    return streamSSE(c, async (stream) => {
      // Get OpenCodeStream from deps (singleton in tests, per-request in production)
      const openCodeStream = getStream(opencodeBase, workspace.directory);
      await openCodeStream.connect();
      let streamClosed = false;

      // Event queue for sequential processing (prevents concurrent writeSSE calls)
      const eventQueue: OpenCodeEvent[] = [];
      let processing = false;

      // Cache for sessionId -> agentId lookups (to avoid DB queries on every event)
      const sessionToAgentCache = new Map<string, string>();

      log.stream.info("Client connected to SSE stream");

      // Send immediate event to trigger browser's onopen and allow reconnection handlers
      // Firefox's EventSource doesn't fire onopen until it receives data
      await stream.writeSSE({
        data: JSON.stringify({
          type: "birdhouse.connection.established",
          properties: { timestamp: Date.now() },
        }),
      });

      // Events that we expect to have agentId (used for logging when translation fails)
      // We attempt translation on ALL events, but only log warnings for these specific events
      const EVENTS_EXPECTING_AGENT_ID = new Set([
        "message.part.updated",
        "message.part.delta",
        "message.updated",
        "message.removed",
        "session.idle",
        "session.error",
        "session.created",
        "session.updated",
        "session.deleted",
        "session.status",
        "session.compacted",
        "session.diff",
        "todo.updated",
        "permission.asked",
        "permission.replied",
        "question.asked",
      ]);

      // Extract sessionID from event properties - tries all known patterns
      // Returns undefined if the event type doesn't contain a sessionID
      const extractSessionId = (eventType: string, properties: Record<string, unknown>): string | undefined => {
        // Pattern 1: Top-level sessionID (most common)
        // Used by: session.idle, session.error, session.status, session.compacted,
        //          session.diff, todo.updated, permission.replied, message.removed
        if (properties.sessionID) {
          return properties.sessionID as string;
        }

        // Pattern 2: Nested in info.id (session lifecycle events)
        // Used by: session.created, session.updated, session.deleted
        if (eventType.startsWith("session.") && !eventType.includes("tui")) {
          const info = properties.info as { id?: string } | undefined;
          if (info?.id) return info.id;
        }

        // Pattern 3: Nested in info.sessionID (message events)
        // Used by: message.updated
        if (eventType.startsWith("message.") && !eventType.includes("part")) {
          const info = properties.info as { sessionID?: string } | undefined;
          if (info?.sessionID) return info.sessionID;
        }

        // Pattern 4: Nested in part.sessionID (message part events)
        // Used by: message.part.updated, message.part.removed
        // Note: message.part.delta has sessionID at top level (Pattern 1), so it never reaches here
        if (eventType.startsWith("message.part.")) {
          const part = properties.part as { sessionID?: string } | undefined;
          if (part?.sessionID) return part.sessionID;
        }

        // Pattern 5: Permission events (at top level, already handled by Pattern 1)
        // Used by: permission.asked (has sessionID at top level in PermissionRequest)

        // No sessionID pattern matched - this event type doesn't have one
        // (e.g., file.edited, vcs.branch.updated, installation.*, etc.)
        return undefined;
      };

      // Process events sequentially to avoid concurrent writeSSE calls
      const processQueue = async () => {
        // Prevent re-entrant calls
        if (processing || streamClosed) return;
        processing = true;

        while (eventQueue.length > 0 && !streamClosed) {
          const event = eventQueue.shift();
          if (!event) break;

          try {
            const properties = event.payload.properties as Record<string, unknown>;
            const eventType = event.payload.type;

            // Try to extract sessionID for ALL events (not just specific ones)
            const sessionID = extractSessionId(eventType, properties);

            if (sessionID) {
              // We found a sessionID - try to translate to agentId

              // Check cache first
              let agentId = sessionToAgentCache.get(sessionID);

              // If not in cache, lookup in database
              if (!agentId) {
                const agent = agentsDB.getAgentBySessionId(sessionID);
                if (agent) {
                  agentId = agent.id;
                  sessionToAgentCache.set(sessionID, agentId);
                }
              }

              if (agentId) {
                // Success: Add agentId to properties
                properties.agentId = agentId;
              } else {
                // Failed to find agentId - only log if we expect this event to have one
                if (EVENTS_EXPECTING_AGENT_ID.has(eventType)) {
                  log.stream.debug({ sessionID, eventType }, "Event from non-Birdhouse session - ignoring");
                }
                // Note: We still forward the event even without agentId
              }
            } else {
              // No sessionID extracted - only warn if this is an event we expected to have one
              if (EVENTS_EXPECTING_AGENT_ID.has(eventType)) {
                log.stream.warn({ eventType }, "Expected event to have sessionID but none found - possible bug");
              }
              // Events without sessionID (like file.edited, vcs.branch.updated) silently pass through
            }

            // Always forward the event (with or without agentId)
            await stream.writeSSE({
              data: JSON.stringify(event.payload),
            });
          } catch (error) {
            // Stream write failed - connection probably closed
            log.stream.warn({ error }, "Failed to write SSE event, closing stream");
            streamClosed = true;
            break;
          }
        }

        processing = false;
      };

      // Subscribe to ALL events from OpenCode
      // Synchronous handler that queues events for sequential processing
      const handleEvent = (event: OpenCodeEvent) => {
        if (streamClosed) return;

        eventQueue.push(event);
        processQueue();
      };

      // Subscribe to the wildcard event (all events)
      openCodeStream.on("*", handleEvent);

      // Keepalive: Send SSE comment every 15 seconds to prevent browser timeout
      const keepaliveInterval = setInterval(() => {
        if (streamClosed) {
          clearInterval(keepaliveInterval);
          return;
        }
        try {
          // Send SSE comment (doesn't trigger onmessage, just keeps connection alive)
          stream.write(": keepalive\n\n");
        } catch {
          streamClosed = true;
          clearInterval(keepaliveInterval);
        }
      }, 15000);

      // Wait for client disconnect (keep stream open)
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          log.stream.info("Client disconnected from SSE stream");
          streamClosed = true;
          clearInterval(keepaliveInterval);
          openCodeStream.off("*", handleEvent);
          resolve();
        });
      });
    });
  });

  return app;
}
