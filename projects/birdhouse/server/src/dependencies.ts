// ABOUTME: AsyncLocalStorage-based dependency injection system for testability
// ABOUTME: Provides request-scoped dependencies with auto test/live switching and context preservation helpers

import { AsyncLocalStorage } from "node:async_hooks";
import type { EventEmitter } from "node:events";
import { type AgentsDB, createAgentsDB, getDefaultDatabasePath } from "./lib/agents-db";
import { type DataDB, getDataDB } from "./lib/data-db";
import { type CapturedLog, createLiveLogger, createTestLogger, type LoggerDeps } from "./lib/logger";
import {
  createLiveOpenCodeClient,
  createTestOpenCodeClient,
  type Message,
  type OpenCodeClient,
  type ProvidersResponse,
  type Session,
} from "./lib/opencode-client";
import { getOpenCodeStream, OpenCodeStream } from "./lib/opencode-stream";
import { createLivePosthogProxy, createTestPosthogProxy, type PosthogProxy } from "./lib/posthog-proxy";
import { createLiveTelemetryClient, createTestTelemetryClient, type TelemetryClient } from "./lib/telemetry";
import { TestDataDB } from "./test-utils/data-db-test";

// ============================================================================
// Type Definitions & Exports
// ============================================================================

// Re-export types from implementations
export type { AgentsDB, CapturedLog, DataDB, LoggerDeps, Message, ProvidersResponse, Session, TelemetryClient };

// Dependencies interface - OpenCode client, logger, agents database, and stream factory
export interface Deps {
  opencode: OpenCodeClient;
  log: LoggerDeps;
  agentsDB: AgentsDB;
  dataDb: DataDB;
  posthog: PosthogProxy;
  telemetry: TelemetryClient;
  getStream: (opencodeBase: string, workspaceDirectory: string) => OpenCodeStream;
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
 * Auto-uses test/live deps if none provided
 */
export function withDeps<T>(deps: Deps | undefined, fn: () => T): T {
  const finalDeps = deps || createDeps();
  return depsContext.run(finalDeps, fn);
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
function getOpenCodeBase(): string {
  if (!process.env.BIRDHOUSE_OPENCODE_BASE) {
    throw new Error("BIRDHOUSE_OPENCODE_BASE environment variable is required");
  }
  return process.env.BIRDHOUSE_OPENCODE_BASE;
}

// Lazy initialization of liveDeps (only created when first accessed in production)
// Note: This is only used by non-workspace routes (like health check).
// Workspace routes use getDepsFromContext() to get workspace-specific deps.
let liveDeps: Deps | undefined;
function getLiveDeps(): Deps {
  if (!liveDeps) {
    liveDeps = {
      opencode: createLiveOpenCodeClient(getOpenCodeBase(), process.env.BIRDHOUSE_WORKSPACE_ROOT || process.cwd()),
      log: createLiveLogger(),
      agentsDB: createAgentsDB(getDefaultDatabasePath(undefined)),
      dataDb: getDataDB(),
      posthog: createLivePosthogProxy(),
      telemetry: createLiveTelemetryClient(getDataDB()),
      getStream: (opencodeBase: string, workspaceDirectory: string) => {
        // Production: Create new stream per request for workspace isolation
        return new OpenCodeStream(opencodeBase, workspaceDirectory);
      },
    };
  }
  return liveDeps;
}

// ============================================================================
// Test Dependencies (Mocked)
// ============================================================================

// Test logger singleton (so captured logs persist across test runs)
const testLoggerInstance = createTestLogger();

const testDeps: Deps = {
  opencode: createTestOpenCodeClient(),
  log: testLoggerInstance.log,
  agentsDB: createAgentsDB(":memory:"), // Use in-memory DB for tests
  dataDb: new TestDataDB(),
  posthog: createTestPosthogProxy(),
  telemetry: createTestTelemetryClient(),
  getStream: (_opencodeBase: string, _workspaceDirectory: string) => {
    // Tests: Return singleton so test events flow through to route
    return getOpenCodeStream();
  },
};

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
export function createTestDeps(opencode?: Partial<Deps["opencode"]>): Deps {
  return {
    opencode: {
      ...createTestOpenCodeClient(),
      ...opencode,
    },
    log: testLoggerInstance.log,
    agentsDB: createAgentsDB(":memory:"),
    dataDb: new TestDataDB(),
    posthog: createTestPosthogProxy(),
    telemetry: createTestTelemetryClient(),
    getStream: (_opencodeBase: string, _workspaceDirectory: string) => {
      // Tests: Return singleton so test events flow through to route
      return getOpenCodeStream();
    },
  };
}

export function createPosthogDeps(): Deps {
  return {
    opencode: createTestOpenCodeClient(),
    log: createLiveLogger(),
    agentsDB: createAgentsDB(getDefaultDatabasePath(undefined)),
    dataDb: new TestDataDB(),
    posthog: createLivePosthogProxy(),
    telemetry: createTestTelemetryClient(),
    getStream: (_opencodeBase: string, _workspaceDirectory: string) => getOpenCodeStream(),
  };
}

// ============================================================================
// Auto Environment Detection
// ============================================================================

/**
 * Create dependencies based on environment
 * Auto-detects test vs production
 */
function createDeps(): Deps {
  const isTest = process.env.NODE_ENV === "test" || (typeof Bun !== "undefined" && Bun?.main?.includes(".test."));
  return isTest ? testDeps : getLiveDeps();
}
