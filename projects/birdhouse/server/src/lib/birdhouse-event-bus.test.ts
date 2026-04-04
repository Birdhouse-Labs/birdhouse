// ABOUTME: Tests workspace event bus delivery, scoping, and reset semantics.
// ABOUTME: Covers the shared test bus path and the workspace-scoped path used outside tests.

import { beforeEach, describe, expect, test } from "bun:test";
import {
  getWorkspaceEventBus,
  resetBirdhouseEventBus,
  type BirdhouseWorkspaceEvent,
} from "./birdhouse-event-bus";

function createEvent(type: string, properties: Record<string, unknown> = {}): BirdhouseWorkspaceEvent {
  return { type, properties };
}

describe("birdhouse-event-bus", () => {
  beforeEach(() => {
    resetBirdhouseEventBus();
  });

  test("emits events to subscribed listeners", () => {
    const bus = getWorkspaceEventBus("/workspace/test");
    const received: BirdhouseWorkspaceEvent[] = [];

    bus.subscribe((event) => {
      received.push(event);
    });

    const event = createEvent("birdhouse.agent.created", { agentId: "agent_1" });
    bus.emit(event);

    expect(received).toEqual([event]);
  });

  test("unsubscribe stops future event delivery", () => {
    const bus = getWorkspaceEventBus("/workspace/test");
    const received: BirdhouseWorkspaceEvent[] = [];

    const unsubscribe = bus.subscribe((event) => {
      received.push(event);
    });

    bus.emit(createEvent("birdhouse.agent.created", { agentId: "agent_1" }));
    unsubscribe();
    bus.emit(createEvent("birdhouse.agent.updated", { agentId: "agent_1" }));

    expect(received).toEqual([createEvent("birdhouse.agent.created", { agentId: "agent_1" })]);
  });

  test("shares a singleton bus across workspaces in tests by default", () => {
    const busA = getWorkspaceEventBus("/workspace/a");
    const busB = getWorkspaceEventBus("/workspace/b");

    expect(busA).toBe(busB);
  });

  test("isolates listeners by workspace when forced to use workspace scope", () => {
    const busA = getWorkspaceEventBus("/workspace/a", { forceWorkspaceScope: true });
    const busAAgain = getWorkspaceEventBus("/workspace/a", { forceWorkspaceScope: true });
    const busB = getWorkspaceEventBus("/workspace/b", { forceWorkspaceScope: true });
    const receivedA: BirdhouseWorkspaceEvent[] = [];
    const receivedB: BirdhouseWorkspaceEvent[] = [];

    busA.subscribe((event) => {
      receivedA.push(event);
    });
    busB.subscribe((event) => {
      receivedB.push(event);
    });

    const eventA = createEvent("birdhouse.agent.created", { agentId: "agent_a" });
    const eventB = createEvent("birdhouse.agent.created", { agentId: "agent_b" });

    busAAgain.emit(eventA);
    busB.emit(eventB);

    expect(busA).toBe(busAAgain);
    expect(busA).not.toBe(busB);
    expect(receivedA).toEqual([eventA]);
    expect(receivedB).toEqual([eventB]);
  });

  test("reset clears existing listeners and bus instances", () => {
    const busBeforeReset = getWorkspaceEventBus("/workspace/test");
    const received: BirdhouseWorkspaceEvent[] = [];

    busBeforeReset.subscribe((event) => {
      received.push(event);
    });

    resetBirdhouseEventBus();

    const busAfterReset = getWorkspaceEventBus("/workspace/test");
    busAfterReset.emit(createEvent("birdhouse.agent.created", { agentId: "agent_1" }));

    expect(busAfterReset).not.toBe(busBeforeReset);
    expect(received).toEqual([]);
  });
});
