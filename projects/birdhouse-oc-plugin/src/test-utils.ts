// ABOUTME: Type-safe mock factories for plugin tests
// ABOUTME: Creates minimal mocks that satisfy OpenCode plugin type requirements

import type { Project } from "@opencode-ai/sdk";
import type { OpencodeClient } from "@opencode-ai/sdk";
import type { ToolContext } from "@opencode-ai/plugin";

/**
 * Create a mock Project object for testing
 */
export function createMockProject(overrides?: Partial<Project>): Project {
  return {
    id: "test-project-id",
    worktree: "/test",
    time: {
      created: Date.now(),
    },
    ...overrides,
  } as Project;
}

/**
 * Create a mock OpencodeClient for testing
 */
export function createMockClient(
  overrides?: Partial<OpencodeClient>
): OpencodeClient {
  return {
    ...overrides,
  } as OpencodeClient;
}

/**
 * Create a mock ToolContext for testing
 */
export function createMockContext(overrides?: {
  sessionID?: string;
}): ToolContext {
  return {
    sessionID: overrides?.sessionID ?? "ses_test_123",
    messageID: "msg_test",
    agent: "build",
    abort: new AbortController().signal,
  };
}

/**
 * Create a mock BunShell for testing
 * Note: BunShell type is not exported from @opencode-ai/plugin, so we use any
 */
export function createMockShell(): any {
  return {} as any;
}
