// ABOUTME: SSE endpoint that merges harness runtime events with Birdhouse synthetic events.
// ABOUTME: Resolves session IDs to agent IDs and forwards Birdhouse-owned events over one client stream.

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  type BirdhouseEvent,
  type HarnessEvent,
  hasValidFrontendConsumedHarnessEventProperties,
  isFrontendConsumedHarnessEventType,
} from "../harness";
import { getDepsFromContext } from "../lib/context-deps";
import { log } from "../lib/logger";
import "../types/context";

interface QueuedEvent {
  event: BirdhouseEvent;
  sessionID?: string;
  expectsAgentId: boolean;
}

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

function mapHarnessEventToBirdhouseEvent(event: HarnessEvent): BirdhouseEvent {
  return {
    type: event.type,
    properties: { ...event.properties },
  };
}

export function createEventRoutes() {
  const app = new Hono();

  app.get("/", (c) => {
    const { agentsDB, harnesses, getBirdhouseEventBus } = getDepsFromContext(c);
    const workspace = c.get("workspace");

    return streamSSE(c, async (stream) => {
      const harnessEventStreams = harnesses.createHarnessEventStreams();
      const birdhouseEventBus = getBirdhouseEventBus(workspace.directory);
      let streamClosed = false;
      const eventQueue: QueuedEvent[] = [];
      let processing = false;
      const sessionToAgentCache = new Map<string, string>();

      log.stream.info("Client connected to SSE stream");

      await stream.writeSSE({
        data: JSON.stringify({
          type: "birdhouse.connection.established",
          properties: { timestamp: Date.now() },
        }),
      });

      const processQueue = async () => {
        if (processing || streamClosed) return;
        processing = true;

        while (eventQueue.length > 0 && !streamClosed) {
          const queued = eventQueue.shift();
          if (!queued) break;

          try {
            const properties = { ...queued.event.properties };

            if (queued.sessionID) {
              let agentId = sessionToAgentCache.get(queued.sessionID);
              if (!agentId) {
                const agent = agentsDB.getAgentBySessionId(queued.sessionID);
                if (agent) {
                  agentId = agent.id;
                  sessionToAgentCache.set(queued.sessionID, agentId);
                }
              }

              if (agentId) {
                properties.agentId = agentId;
              } else if (queued.expectsAgentId) {
                log.stream.debug(
                  { sessionID: queued.sessionID, eventType: queued.event.type },
                  "Event from non-Birdhouse session - ignoring",
                );
              }
            } else if (queued.expectsAgentId) {
              log.stream.warn(
                { eventType: queued.event.type },
                "Expected event to have sessionID but none found - possible bug",
              );
            }

            await stream.writeSSE({
              data: JSON.stringify({
                type: queued.event.type,
                properties,
              }),
            });
          } catch (error) {
            log.stream.warn({ error }, "Failed to write SSE event, closing stream");
            streamClosed = true;
            break;
          }
        }

        processing = false;
      };

      const unsubscribeHarnesses = harnessEventStreams.map((harnessEventStream) =>
        harnessEventStream.subscribe((event) => {
          if (streamClosed) return;

          if (isFrontendConsumedHarnessEventType(event.type) && !hasValidFrontendConsumedHarnessEventProperties(event)) {
            log.stream.warn(
              { eventType: event.type, properties: event.properties },
              "Dropped malformed frontend-consumed harness event",
            );
            return;
          }

          eventQueue.push({
            event: mapHarnessEventToBirdhouseEvent(event),
            sessionID: event.sessionID,
            expectsAgentId: EVENTS_EXPECTING_AGENT_ID.has(event.type),
          });
          void processQueue();
        }),
      );

      const unsubscribeBirdhouse = birdhouseEventBus.subscribe((event) => {
        if (streamClosed) return;
        eventQueue.push({
          event: { type: event.type, properties: { ...event.properties } },
          sessionID: event.sessionID,
          expectsAgentId: false,
        });
        void processQueue();
      });

      const keepaliveInterval = setInterval(() => {
        if (streamClosed) {
          clearInterval(keepaliveInterval);
          return;
        }
        try {
          stream.write(": keepalive\n\n");
        } catch {
          streamClosed = true;
          clearInterval(keepaliveInterval);
        }
      }, 15000);

      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          log.stream.info("Client disconnected from SSE stream");
          streamClosed = true;
          clearInterval(keepaliveInterval);
          for (const unsubscribeHarness of unsubscribeHarnesses) {
            unsubscribeHarness();
          }
          unsubscribeBirdhouse();
          resolve();
        });
      });
    });
  });

  return app;
}
