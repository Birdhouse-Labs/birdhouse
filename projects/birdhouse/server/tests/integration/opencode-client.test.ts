// ABOUTME: Integration tests for OpenCode client against real API
// ABOUTME: Tests actual HTTP calls to running OpenCode instance
// ABOUTME: SKIPPED by default - set RUN_INTEGRATION_TESTS=true to enable
//
// Usage:
//   Regular tests (skipped): bun test
//   Run integration tests:  RUN_INTEGRATION_TESTS=true bun test
//
// NOTE: Integration tests call real OpenCode API and may create sessions.
// Use sparingly to validate implementation, then rely on mocked unit tests.

import { describe, expect, test } from "bun:test";
import { createLiveOpenCodeClient } from "../../src/lib/opencode-client";

// Integration tests require explicit configuration
// WARNING: NEVER point tests at real OpenCode (port 50154)! Use fake port or mocks.
// NOTE: These tests are skipped by default. To run them:
//   RUN_INTEGRATION_TESTS=true OPENCODE_BASE=http://127.0.0.1:99999 bun test
const OPENCODE_BASE = process.env.OPENCODE_BASE;
const TEST_DIR = "/path/to/projects";
const TEST_SESSION = "ses_48f7e9838ffeidDUV45AM6AaX1";

// Skip by default - only run when explicitly enabled
const RUN_INTEGRATION_TESTS = process.env.RUN_INTEGRATION_TESTS === "true" && !!OPENCODE_BASE;

const describeIntegration = RUN_INTEGRATION_TESTS ? describe : describe.skip;

describeIntegration("OpenCode Client (Integration - Real API)", () => {
  // Lazy initialization - only throw error when tests actually run
  let client: ReturnType<typeof createLiveOpenCodeClient>;

  const getClient = () => {
    if (!client) {
      if (!OPENCODE_BASE) {
        throw new Error("OPENCODE_BASE environment variable is required for integration tests");
      }
      client = createLiveOpenCodeClient(OPENCODE_BASE, TEST_DIR);
    }
    return client;
  };

  test("getSession returns real session data", async () => {
    const session = await getClient().getSession(TEST_SESSION);

    expect(session.id).toBe(TEST_SESSION);
    expect(session.title).toBeDefined();
    expect(session.projectID).toBeDefined();
    expect(session.directory).toBe(TEST_DIR);
    expect(session.time.created).toBeGreaterThanOrEqual(1);
    expect(session.time.updated).toBeGreaterThanOrEqual(1);
  });

  test("getMessages returns message array", async () => {
    const messages = await getClient().getMessages(TEST_SESSION, 5);

    expect(Array.isArray(messages)).toBe(true);

    if (messages.length > 0) {
      const firstMessage = messages[0];
      if (firstMessage) {
        expect(firstMessage.info.id).toBeDefined();
        expect(["user", "assistant"]).toContain(firstMessage.info.role);
        expect(Array.isArray(firstMessage.parts)).toBe(true);
      }
    }
  });

  test("handles 404 errors gracefully", async () => {
    await expect(getClient().getSession("ses_nonexistent_fake_id_12345")).rejects.toThrow();
  });

  test("createSession creates new session", async () => {
    const session = await getClient().createSession("Integration Test Session");

    expect(session.id).toMatch(/^ses_/);
    expect(session.title).toBe("Integration Test Session");
    expect(session.projectID).toBeDefined();
    expect(session.time.created).toBeGreaterThanOrEqual(1);
  });
});
