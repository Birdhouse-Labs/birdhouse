// ABOUTME: Tests the OpenCode harness event adapter and centralized session extraction rules.
// ABOUTME: Verifies wildcard subscription, event normalization, and the current sessionID extraction patterns.

import { describe, expect, it } from "bun:test";
import type { OpenCodeEvent } from "../lib/opencode-stream";
import { OpenCodeStream } from "../lib/opencode-stream";
import {
  extractOpenCodeSessionId,
  mapOpenCodeEventToHarnessEvent,
  OpenCodeHarnessEventStream,
} from "./opencode-event-adapter";

describe("extractOpenCodeSessionId", () => {
  it("reads top-level sessionID fields", () => {
    expect(extractOpenCodeSessionId("session.idle", { sessionID: "ses_top" })).toBe("ses_top");
  });

  it("reads session lifecycle info.id fields", () => {
    expect(extractOpenCodeSessionId("session.created", { info: { id: "ses_info" } })).toBe("ses_info");
  });

  it("reads message info.sessionID fields", () => {
    expect(extractOpenCodeSessionId("message.updated", { info: { sessionID: "ses_message" } })).toBe("ses_message");
  });

  it("reads message part sessionIDs from nested part payloads", () => {
    expect(extractOpenCodeSessionId("message.part.updated", { part: { sessionID: "ses_part" } })).toBe("ses_part");
  });

  it("returns undefined when no sessionID pattern matches", () => {
    expect(extractOpenCodeSessionId("file.edited", { path: "src/index.ts" })).toBeUndefined();
  });
});

describe("mapOpenCodeEventToHarnessEvent", () => {
  it("maps the raw OpenCode event envelope into a harness event", () => {
    const event: OpenCodeEvent = {
      directory: "/workspace",
      payload: {
        type: "message.updated",
        properties: {
          info: { sessionID: "ses_1" },
          messageID: "msg_1",
        },
      },
    };

    expect(mapOpenCodeEventToHarnessEvent(event)).toEqual({
      type: "message.updated",
      directory: "/workspace",
      sessionID: "ses_1",
      properties: {
        info: { sessionID: "ses_1" },
        messageID: "msg_1",
      },
    });
  });
});

describe("OpenCodeHarnessEventStream", () => {
  it("subscribes to the wildcard stream and emits normalized harness events", async () => {
    const stream = new OpenCodeStream("http://test", "/workspace");
    const adapter = new OpenCodeHarnessEventStream(stream);
    const received: unknown[] = [];

    const unsubscribe = adapter.subscribe((event) => {
      received.push(event);
    });

    stream.emit("*", {
      directory: "/workspace",
      payload: {
        type: "session.status",
        properties: { sessionID: "ses_1", status: "busy" },
      },
    } satisfies OpenCodeEvent);
    unsubscribe();
    stream.emit("*", {
      directory: "/workspace",
      payload: {
        type: "session.idle",
        properties: { sessionID: "ses_1" },
      },
    } satisfies OpenCodeEvent);

    expect(received).toEqual([
      {
        type: "session.status",
        directory: "/workspace",
        sessionID: "ses_1",
        properties: { sessionID: "ses_1", status: "busy" },
      },
    ]);
  });
});
