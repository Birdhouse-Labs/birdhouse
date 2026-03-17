// ABOUTME: Tests StreamingProvider dispatch for Birdhouse skill update events.
// ABOUTME: Verifies SSE messages reach subscribers without component-level listeners.

import { render, screen, waitFor } from "@solidjs/testing-library";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StreamingProvider, useStreaming } from "./StreamingContext";

class MockEventSource {
  static latest: MockEventSource | null = null;

  readonly url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockEventSource.latest = this;
  }

  close() {}

  emitMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

function SkillUpdatedSubscriber() {
  const streaming = useStreaming();
  const [skillNames, setSkillNames] = createSignal<string[]>([]);

  createEffect(() => {
    const unsubscribe = streaming.subscribeToSkillUpdated((payload) => {
      setSkillNames((prev) => [...prev, payload.skillName]);
    });

    onCleanup(unsubscribe);
  });

  return <div data-testid="skill-events">{skillNames().join(",")}</div>;
}

describe("StreamingProvider skill updated events", () => {
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    MockEventSource.latest = null;
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
  });

  afterEach(() => {
    globalThis.EventSource = originalEventSource;
  });

  it("dispatches birdhouse.skill.updated to subscribers", async () => {
    render(() => (
      <StreamingProvider workspaceId="ws_test">
        <SkillUpdatedSubscriber />
      </StreamingProvider>
    ));

    expect(MockEventSource.latest).not.toBeNull();
    MockEventSource.latest?.emitMessage({
      type: "birdhouse.skill.updated",
      properties: {
        skillName: "find-docs",
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("skill-events").textContent).toBe("find-docs");
    });
  });
});
