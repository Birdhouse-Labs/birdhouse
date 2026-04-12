// ABOUTME: Workspace-scoped harness resolver that centralizes harness selection and composition points.
// ABOUTME: Keeps request-time harness lookup, aggregate status queries, and event stream creation in one place.

import type { AgentHarness } from "./agent-harness";
import type { HarnessEventStream } from "./harness-events";
import type { BirdhouseSessionStatusMap } from "./types";

type HarnessAgentLike = object & { harness_type?: string };

export interface WorkspaceHarnessResolver {
  default(): AgentHarness;
  forKind(kind: string): AgentHarness;
  forAgent(agent: HarnessAgentLike): AgentHarness;
  getSessionStatus(): Promise<BirdhouseSessionStatusMap>;
  createHarnessEventStreams(): HarnessEventStream[];
  createDefaultHarnessEventStream(): HarnessEventStream;
}

interface WorkspaceHarnessResolverOptions {
  defaultKind: string;
  harnesses: Record<string, AgentHarness>;
  eventStreams: Record<string, () => HarnessEventStream>;
}

export function createWorkspaceHarnessResolver(options: WorkspaceHarnessResolverOptions): WorkspaceHarnessResolver {
  const orderedKinds = Object.keys(options.harnesses);

  const getHarness = (kind: string): AgentHarness => {
    const harness = options.harnesses[kind];
    if (!harness) {
      throw new Error(`Unsupported harness kind: "${kind}"`);
    }
    return harness;
  };

  const getEventStreamFactory = (kind: string): (() => HarnessEventStream) => {
    const createEventStream = options.eventStreams[kind];
    if (!createEventStream) {
      throw new Error(`No event stream factory registered for harness kind: "${kind}"`);
    }
    return createEventStream;
  };

  return {
    default() {
      return getHarness(options.defaultKind);
    },
    forKind(kind: string) {
      return getHarness(kind);
    },
    forAgent(agent: HarnessAgentLike) {
      return agent.harness_type ? getHarness(agent.harness_type) : getHarness(options.defaultKind);
    },
    async getSessionStatus() {
      const mergedStatuses: BirdhouseSessionStatusMap = {};

      for (const kind of orderedKinds) {
        Object.assign(mergedStatuses, await getHarness(kind).getSessionStatus());
      }

      return mergedStatuses;
    },
    createHarnessEventStreams() {
      return [...new Set(orderedKinds.map((kind) => getEventStreamFactory(kind)()))];
    },
    createDefaultHarnessEventStream() {
      return getEventStreamFactory(options.defaultKind)();
    },
  };
}
