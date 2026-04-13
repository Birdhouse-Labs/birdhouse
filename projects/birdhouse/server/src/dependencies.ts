// ABOUTME: AsyncLocalStorage-based dependency injection system for testability
// ABOUTME: Provides request-scoped dependencies with auto test/live switching and context preservation helpers

import { AsyncLocalStorage } from "node:async_hooks";
import type { EventEmitter } from "node:events";
import type {
  AgentHarness,
  BirdhouseQuestionRequest,
  BirdhouseSkill,
  BirdhouseMessage as Message,
  BirdhouseProvidersResponse as ProvidersResponse,
  BirdhouseSession as Session,
  WorkspaceHarnessResolver,
} from "./harness";
import { createTestAgentHarness, createTestHarnessEventStream, createWorkspaceHarnessResolver } from "./harness";
import { type AgentsDB, initAgentsDB } from "./lib/agents-db";
import { type BirdhouseEventBus, getWorkspaceEventBus } from "./lib/birdhouse-event-bus";
import type { DataDB } from "./lib/data-db";
import { type CapturedLog, createLiveLogger, createTestLogger, type LoggerDeps } from "./lib/logger";
import { createLivePosthogProxy, createTestPosthogProxy, type PosthogProxy } from "./lib/posthog-proxy";
import { getOpenCodeDbPath, type MessageSearchResult, searchOpenCodeMessages } from "./lib/search-opencode-messages";
import { createTestTelemetryClient, type TelemetryClient } from "./lib/telemetry";
import { TestDataDB } from "./test-utils/data-db-test";

// ============================================================================
// Type Definitions & Exports
// ============================================================================

// Re-export types from implementations
export type {
  AgentsDB,
  CapturedLog,
  DataDB,
  LoggerDeps,
  Message,
  MessageSearchResult,
  ProvidersResponse,
  Session,
  TelemetryClient,
};

type LegacyHarnessOverrides = Partial<AgentHarness> & {
  listSkills?: () => Promise<BirdhouseSkill[]>;
  reloadSkillState?: () => Promise<void>;
  generate?: (options: {
    prompt?: string;
    system?: string[];
    message: string;
    small?: boolean;
    maxTokens?: number;
  }) => Promise<string>;
  listPendingQuestions?: () => Promise<BirdhouseQuestionRequest[]>;
  replyToQuestion?: (requestId: string, answers: string[][]) => Promise<void>;
  revertSession?: (sessionId: string, messageId: string) => Promise<void>;
  unrevertSession?: (sessionId: string) => Promise<void>;
};

// Dependencies interface - harness client, logger, agents database, and stream factory
export interface Deps {
  harnesses: WorkspaceHarnessResolver;
  log: LoggerDeps;
  agentsDB: AgentsDB;
  dataDb: DataDB;
  posthog: PosthogProxy;
  telemetry: TelemetryClient;
  getBirdhouseEventBus: (workspaceDirectory: string) => BirdhouseEventBus;
  searchMessages: (workspaceId: string, query: string, limit: number) => MessageSearchResult[] | null;
}

export type TestDeps = Deps & {
  harness: AgentHarness;
};

export function getDefaultHarness(deps: Pick<Deps, "harnesses">): AgentHarness {
  return deps.harnesses.default();
}

export function getHarnessForKind(deps: Pick<Deps, "harnesses">, kind: string): AgentHarness {
  return deps.harnesses.forKind(kind);
}

export function getHarnessForAgent(
  deps: Pick<Deps, "harnesses">,
  agent: object & { harness_type?: string },
): AgentHarness {
  return deps.harnesses.forAgent(agent);
}

function attachUnavailableWorkspaceDeps(
  deps: Omit<Deps, "harnesses" | "agentsDB" | "getBirdhouseEventBus">,
  contextName: string,
): Deps {
  const unavailable = (dependencyName: string): never => {
    throw new Error(`${dependencyName} is unavailable in ${contextName}`);
  };

  Object.defineProperty(deps, "harnesses", {
    get() {
      return unavailable("harnesses");
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(deps, "agentsDB", {
    get() {
      return unavailable("agentsDB");
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(deps, "getBirdhouseEventBus", {
    value: () => unavailable("getBirdhouseEventBus"),
    enumerable: true,
    configurable: true,
  });

  return deps as Deps;
}

function attachTestHarnessAlias(
  deps: Deps,
  harnesses: WorkspaceHarnessResolver,
  registeredHarnesses: Record<string, AgentHarness>,
  defaultHarnessKind: string,
): TestDeps {
  const testDeps = deps as TestDeps;

  Object.defineProperty(testDeps, "harness", {
    get() {
      return harnesses.default();
    },
    set(nextHarness: AgentHarness) {
      registeredHarnesses[defaultHarnessKind] = nextHarness;
      registeredHarnesses[nextHarness.kind] = nextHarness;
      registeredHarnesses.opencode = nextHarness;
    },
    enumerable: true,
    configurable: true,
  });

  return testDeps;
}

// ============================================================================
// Context Management (AsyncLocalStorage)
// ============================================================================

// The AsyncLocalStorage context
export const depsContext = new AsyncLocalStorage<Deps>();

export const getWorkspaceRoot = async () => {
  return process.env.BIRDHOUSE_WORKSPACE_ROOT;
};

/**
 * Access dependencies from current async context
 * Throws error if called outside withDeps() context
 *
 * NOTE: Workspace-scoped routes should use context instead of useDeps():
 * - c.get("workspace") - Workspace record
 * - c.get("agentsDb") - Workspace-specific AgentsDB
 * - c.get("opencodeBase") - OpenCode URL for this workspace
 * - c.get("opencodePort") - OpenCode port
 *
 * Use getDepsFromContext(c) to build a Deps object from context.
 */
export function useDeps(): Deps {
  const deps = depsContext.getStore();
  if (!deps) {
    throw new Error(
      "❌ Dependencies not available!\n" +
        "Production: Ensure middleware sets deps.\n" +
        "Tests: Wrap in withDeps(() => { ... })\n" +
        "See docs/DEPENDENCIES.md",
    );
  }
  return deps;
}

/**
 * Run function with dependencies context
 */
export function withDeps<T>(deps: Deps, fn: () => T): T {
  return depsContext.run(deps, fn);
}

// ============================================================================
// Context Preservation Helpers
// ============================================================================

/**
 * Wrap a function to preserve current deps context
 * Used for callbacks, event handlers, timeouts
 */
export function withCurrentDeps<Args extends unknown[], Return>(
  fn: (...args: Args) => Return,
): (...args: Args) => Return {
  const deps = depsContext.getStore();

  if (!deps) {
    throw new Error("withCurrentDeps() must be called within deps context");
  }

  return (...args: Args) => {
    return depsContext.run(deps, () => fn(...args));
  };
}

/**
 * Subscribe to EventEmitter with deps context preserved
 * Returns cleanup function to unsubscribe
 */
export function onWithDeps<T = unknown>(
  emitter: EventEmitter,
  event: string,
  handler: (data: T) => void | Promise<void>,
): () => void {
  const wrappedHandler = withCurrentDeps(handler);
  emitter.on(event, wrappedHandler);

  return () => emitter.off(event, wrappedHandler);
}

/**
 * setTimeout with deps context preserved
 */
export function setTimeoutWithDeps<Args extends unknown[]>(
  fn: (...args: Args) => void | Promise<void>,
  delay: number,
  ...args: Args
): NodeJS.Timeout {
  const wrappedFn = withCurrentDeps(fn);
  return setTimeout(() => wrappedFn(...args), delay);
}

// ============================================================================
// Live Dependencies (Production)
// ============================================================================

// Get OpenCode base URL (required)
function _getOpenCodeBase(): string {
  if (!process.env.BIRDHOUSE_OPENCODE_BASE) {
    throw new Error("BIRDHOUSE_OPENCODE_BASE environment variable is required");
  }
  return process.env.BIRDHOUSE_OPENCODE_BASE;
}

// ============================================================================
// Test Dependencies (Mocked)
// ============================================================================

// Test logger singleton (so captured logs persist across test runs)
const testLoggerInstance = createTestLogger();

/**
 * Get captured logs from test logger
 * Only works in test environment
 */
export function getCapturedLogs(): CapturedLog[] {
  return testLoggerInstance.captured;
}

/**
 * Clear captured logs (call in beforeEach)
 */
export function clearCapturedLogs(): void {
  testLoggerInstance.captured.length = 0;
}

/**
 * Create test deps with optional harness overrides
 * Includes test logger and in-memory database automatically
 */
export async function createTestDeps(harnessOverrides?: LegacyHarnessOverrides): Promise<TestDeps> {
  const defaultHarness: AgentHarness = createTestAgentHarness({
    enableRevert: true,
    enableSkills: true,
    enableGenerate: true,
    enableQuestions: true,
    generatedText: "Mock Generated Title",
    providers: {
      providers: [
        {
          id: "anthropic",
          name: "Anthropic",
          models: {
            "claude-sonnet-4": {
              id: "claude-sonnet-4",
              name: "Claude Sonnet 4",
            },
            "claude-sonnet-4-5": {
              id: "claude-sonnet-4-5",
              name: "Claude Sonnet 4.5",
            },
            "claude-haiku-4": {
              id: "claude-haiku-4",
              name: "Claude Haiku 4",
            },
            "claude-opus-4": {
              id: "claude-opus-4",
              name: "Claude Opus 4",
            },
          },
        },
      ],
    },
  });

  if (harnessOverrides) {
    Object.assign(defaultHarness, harnessOverrides);

    if (harnessOverrides.capabilities) {
      defaultHarness.capabilities = {
        ...defaultHarness.capabilities,
        ...harnessOverrides.capabilities,
      };
    }

    if (harnessOverrides.listSkills || harnessOverrides.reloadSkillState) {
      defaultHarness.capabilities.skills = {
        listSkills: harnessOverrides.listSkills ?? defaultHarness.capabilities.skills?.listSkills ?? (async () => []),
        reloadSkills:
          harnessOverrides.reloadSkillState ?? defaultHarness.capabilities.skills?.reloadSkills ?? (async () => {}),
      };
    }

    if (harnessOverrides.generate) {
      defaultHarness.capabilities.generate = {
        generate: harnessOverrides.generate,
      };
    }

    if (harnessOverrides.listPendingQuestions || harnessOverrides.replyToQuestion) {
      defaultHarness.capabilities.questions = {
        listPendingQuestions:
          harnessOverrides.listPendingQuestions ??
          defaultHarness.capabilities.questions?.listPendingQuestions ??
          (async () => []),
        replyToQuestion:
          harnessOverrides.replyToQuestion ??
          defaultHarness.capabilities.questions?.replyToQuestion ??
          (async () => {}),
      };
    }

    if (harnessOverrides.revertSession || harnessOverrides.unrevertSession) {
      defaultHarness.capabilities.revert = {
        revertSession:
          harnessOverrides.revertSession ?? defaultHarness.capabilities.revert?.revertSession ?? (async () => {}),
        unrevertSession:
          harnessOverrides.unrevertSession ?? defaultHarness.capabilities.revert?.unrevertSession ?? (async () => {}),
      };
    }
  }

  const defaultEventStream = createTestHarnessEventStream();
  const defaultHarnessKind = defaultHarness.kind;
  const registeredHarnesses: Record<string, AgentHarness> = {
    [defaultHarnessKind]: defaultHarness,
    opencode: defaultHarness,
  };

  const harnesses = createWorkspaceHarnessResolver({
    defaultKind: defaultHarnessKind,
    harnesses: registeredHarnesses,
    eventStreams: {
      [defaultHarnessKind]: () => defaultEventStream,
      opencode: () => defaultEventStream,
    },
  });

  const deps = {
    harnesses,
    log: testLoggerInstance.log,
    agentsDB: await initAgentsDB(":memory:"),
    dataDb: new TestDataDB(),
    posthog: createTestPosthogProxy(),
    telemetry: createTestTelemetryClient(),
    getBirdhouseEventBus: (workspaceDirectory: string) => getWorkspaceEventBus(workspaceDirectory),
    searchMessages: (_workspaceId: string, _query: string, _limit: number) => [],
  };

  return attachTestHarnessAlias(deps, harnesses, registeredHarnesses, defaultHarnessKind);
}

export async function createPosthogDeps(): Promise<Deps> {
  return attachUnavailableWorkspaceDeps(
    {
      log: createLiveLogger(),
      dataDb: new TestDataDB(),
      posthog: createLivePosthogProxy(),
      telemetry: createTestTelemetryClient(),
      searchMessages: (workspaceId: string, query: string, limit: number) =>
        searchOpenCodeMessages(getOpenCodeDbPath(workspaceId), query, limit),
    },
    "PostHog ingest context",
  );
}
