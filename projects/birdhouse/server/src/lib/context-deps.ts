// ABOUTME: Helper to build Deps object from workspace context
// ABOUTME: Used by workspace-scoped routes to pass deps to feature handlers

import type { Context } from "hono";
import { type Deps, depsContext } from "../dependencies";
import { OpenCodeAgentHarness, OpenCodeHarnessEventStream } from "../harness";
import { getWorkspaceEventBus } from "./birdhouse-event-bus";
import { getDataDB } from "./data-db";
import { log } from "./logger";
import { createLiveOpenCodeClient } from "./opencode-client";
import { getWorkspaceStream } from "./opencode-stream";
import { createLivePosthogProxy } from "./posthog-proxy";
import { createLiveTelemetryClient } from "./telemetry";

/**
 * Extract Deps object from workspace context
 * Used by workspace-scoped routes to pass deps to feature handlers
 *
 * In tests, will use existing test deps (from withDeps) if available,
 * only overriding the agentsDB with the workspace-specific instance.
 */
export function getDepsFromContext(c: Context): Deps {
  const agentsDB = c.get("agentsDb");
  const opencodeBase = c.get("opencodeBase");
  const workspace = c.get("workspace");

  if (!agentsDB || !opencodeBase || !workspace) {
    throw new Error("Workspace context not loaded - ensure workspace middleware is applied");
  }

  // In tests, use existing test deps if available (from withDeps)
  // This allows tests to mock the harness while still using workspace-specific agentsDB
  const existingDeps = depsContext.getStore();
  if (existingDeps) {
    return {
      ...existingDeps,
      agentsDB, // Override with workspace-specific agentsDB
    };
  }

  // Production path: create live OpenCode harness and stream factory
  const dataDb = getDataDB();
  return {
    harness: new OpenCodeAgentHarness(createLiveOpenCodeClient(opencodeBase, workspace.directory), workspace.directory),
    log,
    agentsDB,
    dataDb,
    posthog: createLivePosthogProxy(),
    telemetry: createLiveTelemetryClient(dataDb),
    getHarnessEventStream: (streamOpencodeBase: string, workspaceDirectory: string) => {
      return new OpenCodeHarnessEventStream(getWorkspaceStream(streamOpencodeBase, workspaceDirectory));
    },
    getBirdhouseEventBus: (workspaceDirectory: string) => getWorkspaceEventBus(workspaceDirectory),
  };
}
