// ABOUTME: Tests the workspace-scoped harness resolver used to centralize harness composition.
// ABOUTME: Verifies default resolution, per-agent lookup, status aggregation, and event stream selection.

import { describe, expect, test } from "bun:test";
import { createTestAgentHarness, createTestHarnessEventStream } from "./test-harness";
import { createWorkspaceHarnessResolver } from "./workspace-harness-resolver";

describe("createWorkspaceHarnessResolver", () => {
  test("returns the default harness and resolves agents by harness_type", async () => {
    const defaultHarness = createTestAgentHarness();
    const alternateHarness = createTestAgentHarness();
    alternateHarness.kind = "alternate";

    const defaultStream = createTestHarnessEventStream();
    const alternateStream = createTestHarnessEventStream();

    const resolver = createWorkspaceHarnessResolver({
      defaultKind: defaultHarness.kind,
      harnesses: {
        [defaultHarness.kind]: defaultHarness,
        [alternateHarness.kind]: alternateHarness,
      },
      eventStreams: {
        [defaultHarness.kind]: () => defaultStream,
        [alternateHarness.kind]: () => alternateStream,
      },
    });

    expect(resolver.default()).toBe(defaultHarness);
    expect(resolver.forKind("alternate")).toBe(alternateHarness);
    expect(resolver.forAgent({ harness_type: "alternate" })).toBe(alternateHarness);
    expect(resolver.createDefaultHarnessEventStream()).toBe(defaultStream);
  });

  test("merges session statuses across registered harnesses", async () => {
    const firstHarness = createTestAgentHarness();
    firstHarness.seedSessionStatus("ses_first", { type: "busy" });

    const secondHarness = createTestAgentHarness();
    secondHarness.kind = "second";
    secondHarness.seedSessionStatus("ses_second", { type: "idle" });

    const resolver = createWorkspaceHarnessResolver({
      defaultKind: firstHarness.kind,
      harnesses: {
        [firstHarness.kind]: firstHarness,
        [secondHarness.kind]: secondHarness,
      },
      eventStreams: {
        [firstHarness.kind]: () => createTestHarnessEventStream(),
        [secondHarness.kind]: () => createTestHarnessEventStream(),
      },
    });

    await expect(resolver.getSessionStatus()).resolves.toEqual({
      ses_first: { type: "busy" },
      ses_second: { type: "idle" },
    });
  });

  test("throws for unknown harness kinds", () => {
    const harness = createTestAgentHarness();
    const resolver = createWorkspaceHarnessResolver({
      defaultKind: harness.kind,
      harnesses: {
        [harness.kind]: harness,
      },
      eventStreams: {
        [harness.kind]: () => createTestHarnessEventStream(),
      },
    });

    expect(() => resolver.forKind("missing")).toThrow('Unsupported harness kind: "missing"');
  });
});
