// ABOUTME: AsyncLocalStorage-based dependency injection system for testability
// ABOUTME: Provides request-scoped dependencies with auto test/live switching and context preservation helpers

import { AsyncLocalStorage } from "node:async_hooks";
import type { EventEmitter } from "node:events";
import { type AgentsDB, initAgentsDB } from "./lib/agents-db";
import type { DataDB } from "./lib/data-db";
import { type CapturedLog, createLiveLogger, createTestLogger, type LoggerDeps } from "./lib/logger";
import {
  createTestOpenCodeClient,
  type Message,
  type OpenCodeClient,
  type ProvidersResponse,
  type Session,
} from "./lib/opencode-client";
import { getOpenCodeStream, type OpenCodeStream } from "./lib/opencode-stream";
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

// Dependencies interface - OpenCode client, logger, agents database, and stream factory
export interface Deps {
  opencode: OpenCodeClient;
  log: LoggerDeps;
  agentsDB: AgentsDB;
  dataDb: DataDB;
  posthog: PosthogProxy;
  telemetry: TelemetryClient;
  getStream: (opencodeBase: string, workspaceDirectory: string) => OpenCodeStream;
  searchMessages: (workspaceId: string, query: string, limit: number) => MessageSearchResult[] | null;
}

function attachUnavailableWorkspaceDeps(
  deps: Omit<Deps, "opencode" | "agentsDB" | "getStream">,
  contextName: string,
): Deps {
  const unavailable = (dependencyName: string): never => {
    throw new Error(`${dependencyName} is unavailable in ${contextName}`);
  };

  Object.defineProperty(deps, "opencode", {
    get() {
      return unavailable("opencode");
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

  Object.defineProperty(deps, "getStream", {
    value: () => unavailable("getStream"),
    enumerable: true,
    configurable: true,
  });

  return deps as Deps;
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
 * Create test deps with optional opencode overrides
 * Includes test logger and in-memory database automatically
 */
export async function createTestDeps(opencode?: Partial<Deps["opencode"]>): Promise<Deps> {
  return {
    opencode: {
      ...createTestOpenCodeClient(),
      ...opencode,
    },
    log: testLoggerInstance.log,
    agentsDB: await initAgentsDB(":memory:"),
    dataDb: new TestDataDB(),
    posthog: createTestPosthogProxy(),
    telemetry: createTestTelemetryClient(),
    getStream: (_opencodeBase: string, _workspaceDirectory: string) => {
      // Tests: Return singleton so test events flow through to route
      return getOpenCodeStream();
    },
    // Tests: returns no results by default; override per-test to inject fixture data
    searchMessages: (_workspaceId: string, _query: string, _limit: number) => [],
  };
}

export async function createPosthogDeps(): Promise<Deps> {
  return attachUnavailableWorkspaceDeps({
    log: createLiveLogger(),
    dataDb: new TestDataDB(),
    posthog: createLivePosthogProxy(),
    telemetry: createTestTelemetryClient(),
    searchMessages: (workspaceId: string, query: string, limit: number) =>
      searchOpenCodeMessages(getOpenCodeDbPath(workspaceId), query, limit),
  }, "PostHog ingest context");
}
