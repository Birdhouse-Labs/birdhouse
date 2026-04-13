// ABOUTME: Wraps the OpenCode EventEmitter stream as a Birdhouse HarnessEventStream.
// ABOUTME: Centralizes raw OpenCode event normalization and sessionID extraction rules.

import type { OpenCodeEvent, OpenCodeStream } from "../lib/opencode-stream";
import type { HarnessEvent, HarnessEventStream } from "./harness-events";

export function extractOpenCodeSessionId(eventType: string, properties: Record<string, unknown>): string | undefined {
  if (typeof properties.sessionID === "string") {
    return properties.sessionID;
  }

  if (eventType.startsWith("session.") && !eventType.includes("tui")) {
    const info = properties.info as { id?: string } | undefined;
    if (typeof info?.id === "string") {
      return info.id;
    }
  }

  if (eventType.startsWith("message.") && !eventType.includes("part")) {
    const info = properties.info as { sessionID?: string } | undefined;
    if (typeof info?.sessionID === "string") {
      return info.sessionID;
    }
  }

  if (eventType.startsWith("message.part.")) {
    const part = properties.part as { sessionID?: string } | undefined;
    if (typeof part?.sessionID === "string") {
      return part.sessionID;
    }
  }

  return undefined;
}

export function mapOpenCodeEventToHarnessEvent(event: OpenCodeEvent): HarnessEvent {
  const properties = { ...event.payload.properties };

  return {
    type: event.payload.type,
    ...(event.directory !== undefined ? { directory: event.directory } : {}),
    ...(extractOpenCodeSessionId(event.payload.type, properties) !== undefined
      ? { sessionID: extractOpenCodeSessionId(event.payload.type, properties) }
      : {}),
    properties,
  };
}

export class OpenCodeHarnessEventStream implements HarnessEventStream {
  constructor(private readonly stream: Pick<OpenCodeStream, "on" | "off">) {}

  subscribe(listener: (event: HarnessEvent) => void | Promise<void>): () => void {
    const handleEvent = (event: OpenCodeEvent) => {
      void listener(mapOpenCodeEventToHarnessEvent(event));
    };

    this.stream.on("*", handleEvent);

    return () => {
      this.stream.off("*", handleEvent);
    };
  }
}
