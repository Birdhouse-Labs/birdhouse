// ABOUTME: AsyncLocalStorage-based dependency injection system for testability
// ABOUTME: Provides request-scoped dependencies with auto test/live switching and context preservation helpers

import { AsyncLocalStorage } from "node:async_hooks";
import type { EventEmitter } from "node:events";
import type {
  AgentHarness,
  BirdhouseQuestionRequest,
  BirdhouseMessage as Message,
  BirdhouseSkill,
  HarnessEventStream,
  BirdhouseProvidersResponse as ProvidersResponse,
  BirdhouseSession as Session,
} from "./harness";
import { createTestAgentHarness, OpenCodeHarnessEventStream } from "./harness";
import { type AgentsDB, getDefaultDatabasePath, initAgentsDB } from "./lib/agents-db";
import { type BirdhouseEventBus, getWorkspaceEventBus } from "./lib/birdhouse-event-bus";
import type { DataDB } from "./lib/data-db";
import { type CapturedLog, createLiveLogger, createTestLogger, type LoggerDeps } from "./lib/logger";
import { getOpenCodeStream } from "./lib/opencode-stream";
import { createLivePosthogProxy, createTestPosthogProxy, type PosthogProxy } from "./lib/posthog-proxy";
import { createTestTelemetryClient, type TelemetryClient } from "./lib/telemetry";
import { TestDataDB } from "./test-utils/data-db-test";

// ============================================================================
// Type Definitions & Exports
// ============================================================================

// Re-export types from implementations
export type { AgentsDB, CapturedLog, DataDB, LoggerDeps, Message, ProvidersResponse, Session, TelemetryClient };

type LegacyHarnessOverrides = Partial<Deps["harness"]> & {
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
  harness: AgentHarness;
  log: LoggerDeps;
  agentsDB: AgentsDB;
  dataDb: DataDB;
  posthog: PosthogProxy;
  telemetry: TelemetryClient;
  getHarnessEventStream: (opencodeBase: string, workspaceDirectory: string) => HarnessEventStream;
  getBirdhouseEventBus: (workspaceDirectory: string) => BirdhouseEventBus;
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
export async function createTestDeps(harnessOverrides?: LegacyHarnessOverrides): Promise<Deps> {
  const harness = createTestAgentHarness({
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
    Object.assign(harness, harnessOverrides);

    if (harnessOverrides.capabilities) {
      harness.capabilities = {
        ...harness.capabilities,
        ...harnessOverrides.capabilities,
      };
    }

    if (harnessOverrides.listSkills || harnessOverrides.reloadSkillState) {
      harness.capabilities.skills = {
        listSkills: harnessOverrides.listSkills ?? harness.capabilities.skills?.listSkills ?? (async () => []),
        reloadSkills:
          harnessOverrides.reloadSkillState ?? harness.capabilities.skills?.reloadSkills ?? (async () => {}),
      };
    }

    if (harnessOverrides.generate) {
      harness.capabilities.generate = {
        generate: harnessOverrides.generate,
      };
    }

    if (harnessOverrides.listPendingQuestions || harnessOverrides.replyToQuestion) {
      harness.capabilities.questions = {
        listPendingQuestions:
          harnessOverrides.listPendingQuestions ??
          harness.capabilities.questions?.listPendingQuestions ??
          (async () => []),
        replyToQuestion:
          harnessOverrides.replyToQuestion ?? harness.capabilities.questions?.replyToQuestion ?? (async () => {}),
      };
    }

    if (harnessOverrides.revertSession || harnessOverrides.unrevertSession) {
      harness.capabilities.revert = {
        revertSession: harnessOverrides.revertSession ?? harness.capabilities.revert?.revertSession ?? (async () => {}),
        unrevertSession:
          harnessOverrides.unrevertSession ?? harness.capabilities.revert?.unrevertSession ?? (async () => {}),
      };
    }
  }

  return {
    harness,
    log: testLoggerInstance.log,
    agentsDB: await initAgentsDB(":memory:"),
    dataDb: new TestDataDB(),
    posthog: createTestPosthogProxy(),
    telemetry: createTestTelemetryClient(),
    getHarnessEventStream: (_opencodeBase: string, workspaceDirectory: string) => {
      return new OpenCodeHarnessEventStream(getOpenCodeStream("http://test", workspaceDirectory));
    },
    getBirdhouseEventBus: (workspaceDirectory: string) => getWorkspaceEventBus(workspaceDirectory),
  };
}

export async function createPosthogDeps(): Promise<Deps> {
  return {
    harness: createTestAgentHarness(),
    log: createLiveLogger(),
    agentsDB: await initAgentsDB(getDefaultDatabasePath(undefined)),
    dataDb: new TestDataDB(),
    posthog: createLivePosthogProxy(),
    telemetry: createTestTelemetryClient(),
    getHarnessEventStream: (opencodeBase: string, workspaceDirectory: string) => {
      return new OpenCodeHarnessEventStream(getOpenCodeStream(opencodeBase, workspaceDirectory));
    },
    getBirdhouseEventBus: (workspaceDirectory: string) => getWorkspaceEventBus(workspaceDirectory),
  };
}
