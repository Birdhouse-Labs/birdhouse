// ABOUTME: Tests for Birdhouse OpenCode plugin
// ABOUTME: Verifies workspace header injection and env validation

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { BirdhousePlugin } from "./plugin";
import {
  createMockProject,
  createMockClient,
  createMockShell,
  createMockContext,
} from "./test-utils";

/**
 * Mock fetch to capture requests and verify headers
 */
class FetchMock {
  calls: Array<{ url: string; init?: RequestInit }> = [];
  mockResponse: any = { ok: true, json: async () => ({}), text: async () => "" };

  mock = async (url: string, init?: RequestInit) => {
    this.calls.push({ url, init });
    return this.mockResponse;
  };

  getLastCall() {
    return this.calls[this.calls.length - 1];
  }

  getHeaders(callIndex = -1): Record<string, string> {
    const call = callIndex < 0 ? this.getLastCall() : this.calls[callIndex];
    return (call?.init?.headers as Record<string, string>) ?? {};
  }

  reset() {
    this.calls = [];
  }

  setResponse(response: any) {
    this.mockResponse = response;
  }
}

/**
 * Helper to temporarily set env vars for a test
 */
async function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => void | Promise<void>
): Promise<void> {
  const original: Record<string, string | undefined> = {};

  // Save originals
  for (const key of Object.keys(vars)) {
    original[key] = process.env[key];
  }

  // Set test values
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await fn();
  } finally {
    // Restore originals
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}



describe("BirdhousePlugin - Comprehensive Tests", () => {
  let fetchMock: FetchMock;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    fetchMock = new FetchMock();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("agent_create: comprehensive request and response validation", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_production_123",
      },
      async () => {
        // Mock successful response
        fetchMock.setResponse({
          ok: true,
          json: async () => ({
            id: "agent_new_456",
            title: "Test Agent",
            session_id: "ses_new_789",
            model: "anthropic/claude-sonnet-4",
          }),
          text: async () =>
            JSON.stringify({
              id: "agent_new_456",
              title: "Test Agent",
              session_id: "ses_new_789",
              model: "anthropic/claude-sonnet-4",
            }),
        });

        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        // Execute agent_create tool
        const result = await plugin.tool!.agent_create.execute(
          {
            prompt: "Implement feature X",
            title: "Feature X Implementation",
            model: "anthropic/claude-opus-4",
            wait: false,
          },
          createMockContext({ sessionID: "ses_caller_123" })
        );

        // ========================================
        // REQUEST ASSERTIONS
        // ========================================
        
        expect(fetchMock.calls.length).toBe(1);
        const call = fetchMock.getLastCall();

        // Verify URL
        expect(call?.url).toBe("http://localhost:3000/aapi/agents");

        // Verify HTTP method
        expect(call?.init?.method).toBe("POST");

        // 🎯 CRITICAL: Verify headers (workspace isolation)
        const headers = fetchMock.getHeaders();
        expect(headers["X-Birdhouse-Workspace-ID"]).toBe("ws_production_123");
        expect(headers["Content-Type"]).toBe("application/json");
        expect(headers["X-Session-ID"]).toBe("ses_caller_123");

        // Verify request body
        const body = JSON.parse(call?.init?.body as string);
        expect(body.prompt).toBe("Implement feature X");
        expect(body.title).toBe("Feature X Implementation");
        expect(body.model).toBe("anthropic/claude-opus-4");
        expect(body.wait).toBe(false);

        // ========================================
        // RESPONSE ASSERTIONS
        // ========================================

        // Verify response parsing (uses server response, not request)
        expect(result).toContain("agent_new_456");
        expect(result).toContain("Test Agent"); // Title from response
        expect(result).toContain("ses_new_789");
        expect(result).toContain("Fresh agent"); // Not cloned

        // Verify async mode message
        expect(result).toContain("background");
        expect(result).toContain("agent_read");
      }
    );
  });

  test("agent_create with cloning: request includes from_agent_id", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_test_456",
      },
      async () => {
        fetchMock.setResponse({
          ok: true,
          json: async () => ({
            id: "agent_cloned_999",
            title: "Cloned Agent",
            session_id: "ses_cloned_888",
            model: "anthropic/claude-sonnet-4",
          }),
          text: async () => JSON.stringify({
            id: "agent_cloned_999",
            title: "Cloned Agent",
            session_id: "ses_cloned_888",
            model: "anthropic/claude-sonnet-4",
          }),
        });

        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        await plugin.tool!.agent_create.execute(
          {
            prompt: "Continue the work",
            title: "Continuation",
            from_agent_id: "agent_source_123",
            from_message_id: "msg_fork_point",
            wait: false,
          },
          createMockContext({ sessionID: "ses_caller" })
        );

        // ========================================
        // REQUEST ASSERTIONS (CLONING)
        // ========================================

        const call = fetchMock.getLastCall();
        const body = JSON.parse(call?.init?.body as string);

        // Verify cloning parameters included
        expect(body.from_agent_id).toBe("agent_source_123");
        expect(body.from_message_id).toBe("msg_fork_point");
        expect(body.prompt).toBe("Continue the work");
        
        // Verify from_self is NOT included (conflicting params)
        expect(body.from_self).toBeUndefined();

        // Verify headers still correct
        const headers = fetchMock.getHeaders();
        expect(headers["X-Birdhouse-Workspace-ID"]).toBe("ws_test_456");
      }
    );
  });

  test("agent_read: verifies headers on both wait and messages endpoints", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_staging_789",
      },
      async () => {
        // Mock responses for both endpoints
        globalThis.fetch = (async (url: string, init?: RequestInit) => {
          fetchMock.calls.push({ url, init });

          if (url.includes("/wait")) {
            return {
              ok: true,
              json: async () => ({}),
              text: async () => "",
            };
          }

          return {
            ok: true,
            json: async () => [
              {
                info: { role: "assistant", time: { created: 123, completed: 456 } },
                parts: [{ type: "text", text: "Agent completed successfully" }],
              },
            ],
            text: async () => JSON.stringify([
              {
                info: { role: "assistant", time: { created: 123, completed: 456 } },
                parts: [{ type: "text", text: "Agent completed successfully" }],
              },
            ]),
          };
        }) as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        const result = await plugin.tool!.agent_read.execute(
          { agent_id: "agent_target_999", latest_turn: true },
          createMockContext()
        );

        // ========================================
        // REQUEST ASSERTIONS (Multiple Endpoints)
        // ========================================

        expect(fetchMock.calls.length).toBe(2);

        // First call: /wait endpoint
        const waitCall = fetchMock.calls[0];
        expect(waitCall?.url).toBe("http://localhost:3000/aapi/agents/agent_target_999/wait");
        const waitHeaders = (waitCall?.init?.headers as Record<string, string>) ?? {};
        expect(waitHeaders["X-Birdhouse-Workspace-ID"]).toBe("ws_staging_789");

        // Second call: /messages endpoint
        const messagesCall = fetchMock.calls[1];
        expect(messagesCall?.url).toContain("/aapi/agents/agent_target_999/messages");
        expect(messagesCall?.url).toContain("mode=latest_turn");
        const messagesHeaders = (messagesCall?.init?.headers as Record<string, string>) ?? {};
        expect(messagesHeaders["X-Birdhouse-Workspace-ID"]).toBe("ws_staging_789");

        // ========================================
        // RESPONSE ASSERTIONS
        // ========================================

        expect(result).toContain("agent_target_999");
        expect(result).toContain("latest turn");
        expect(result).toContain("Messages: 1");
        expect(result).toContain("Agent completed successfully");
      }
    );
  });

  test("agent_create: handles HTTP error responses correctly", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_error_test",
      },
      async () => {
        // Mock error response
        fetchMock.setResponse({
          ok: false,
          status: 400,
          text: async () => JSON.stringify({
            error: "Agent with title 'Duplicate' already exists",
          }),
          json: async () => ({
            error: "Agent with title 'Duplicate' already exists",
          }),
        });

        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        const result = await plugin.tool!.agent_create.execute(
          {
            prompt: "Test error",
            title: "Duplicate",
            wait: false,
          },
          createMockContext()
        );

        // ========================================
        // ERROR RESPONSE ASSERTIONS
        // ========================================

        // Verify error message is returned
        expect(result).toContain("Agent with title 'Duplicate' already exists");
        
        // Verify it doesn't contain success indicators
        expect(result).not.toContain("✅");
        expect(result).not.toContain("Created agent");

        // Verify request was still made with correct headers
        const headers = fetchMock.getHeaders();
        expect(headers["X-Birdhouse-Workspace-ID"]).toBe("ws_error_test");
      }
    );
  });

  test("agent_create: validates conflicting parameters", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_validation",
      },
      async () => {
        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        // Try to use both from_self and from_agent_id (invalid)
        const result = await plugin.tool!.agent_create.execute(
          {
            prompt: "Test",
            title: "Test",
            from_self: true,
            from_agent_id: "agent_other",
            wait: false,
          },
          createMockContext()
        );

        // ========================================
        // VALIDATION ASSERTIONS
        // ========================================

        // Should return error message, not make request
        expect(result).toContain("Error");
        expect(result).toContain("Cannot specify both from_self and from_agent_id");
        
        // Should NOT have made any fetch calls
        expect(fetchMock.calls.length).toBe(0);
      }
    );
  });

  test("agent_reply: comprehensive request and response validation (wait=true)", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_reply_test",
      },
      async () => {
        // Mock successful blocking response
        fetchMock.setResponse({
          ok: true,
          json: async () => ({
            parts: [
              {
                type: "text",
                text: "I've completed the requested changes to the authentication flow.",
              },
            ],
          }),
          text: async () =>
            JSON.stringify({
              parts: [
                {
                  type: "text",
                  text: "I've completed the requested changes to the authentication flow.",
                },
              ],
            }),
        });

        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        // Execute agent_reply tool (blocking mode - default wait=true)
        const result = await plugin.tool!.agent_reply.execute(
          {
            agent_id: "agent_target_123",
            message: "Please add error handling for the edge case we discussed",
            wait: true,
          },
          createMockContext({ sessionID: "ses_caller_456" })
        );

        // ========================================
        // REQUEST ASSERTIONS
        // ========================================

        expect(fetchMock.calls.length).toBe(1);
        const call = fetchMock.getLastCall();

        // Verify URL with wait parameter
        expect(call?.url).toBe("http://localhost:3000/aapi/agents/agent_target_123/messages?wait=true");

        // Verify HTTP method
        expect(call?.init?.method).toBe("POST");

        // 🎯 CRITICAL: Verify headers
        const headers = fetchMock.getHeaders();
        expect(headers["X-Birdhouse-Workspace-ID"]).toBe("ws_reply_test");
        expect(headers["X-Session-ID"]).toBe("ses_caller_456");
        expect(headers["Content-Type"]).toBe("application/json");

        // Verify request body
        const body = JSON.parse(call?.init?.body as string);
        expect(body.text).toBe("Please add error handling for the edge case we discussed");

        // ========================================
        // RESPONSE ASSERTIONS
        // ========================================

        // Verify blocking mode response format
        expect(result).toContain("✅");
        expect(result).toContain("agent_target_123");
        expect(result).toContain("responded");
        expect(result).toContain("I've completed the requested changes to the authentication flow");
      }
    );
  });

  test("agent_reply: async mode with wait=false", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_async_reply",
      },
      async () => {
        // Mock successful async response (message sent, agent working)
        fetchMock.setResponse({
          ok: true,
          json: async () => ({}),
          text: async () => "{}",
        });

        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        // Execute with wait=false
        const result = await plugin.tool!.agent_reply.execute(
          {
            agent_id: "agent_async_789",
            message: "Start working on the next feature",
            wait: false,
          },
          createMockContext({ sessionID: "ses_manager" })
        );

        // ========================================
        // REQUEST ASSERTIONS (ASYNC MODE)
        // ========================================

        const call = fetchMock.getLastCall();

        // Verify URL has wait=false parameter
        expect(call?.url).toBe("http://localhost:3000/aapi/agents/agent_async_789/messages?wait=false");

        // Verify headers
        const headers = fetchMock.getHeaders();
        expect(headers["X-Birdhouse-Workspace-ID"]).toBe("ws_async_reply");
        expect(headers["X-Session-ID"]).toBe("ses_manager");

        // ========================================
        // RESPONSE ASSERTIONS (ASYNC MODE)
        // ========================================

        // Verify async mode message
        expect(result).toContain("✅");
        expect(result).toContain("Message sent");
        expect(result).toContain("agent_async_789");
        expect(result).toContain("background");
        expect(result).toContain("agent_read");
      }
    );
  });

  test("agent_reply: handles agent not found error", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_error_reply",
      },
      async () => {
        // Mock 404 error response
        fetchMock.setResponse({
          ok: false,
          status: 404,
          text: async () =>
            JSON.stringify({
              error: "Agent not found",
            }),
          json: async () => ({
            error: "Agent not found",
          }),
        });

        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        const result = await plugin.tool!.agent_reply.execute(
          {
            agent_id: "agent_nonexistent_999",
            message: "Hello?",
            wait: true,
          },
          createMockContext()
        );

        // ========================================
        // ERROR RESPONSE ASSERTIONS
        // ========================================

        // Verify error message
        expect(result).toContain("Agent not found");
        expect(result).toContain("agent_nonexistent_999");
        expect(result).toContain("does not exist");
        expect(result).toContain("correct agent_id");

        // Verify request was still made with correct headers
        const headers = fetchMock.getHeaders();
        expect(headers["X-Birdhouse-Workspace-ID"]).toBe("ws_error_reply");
      }
    );
  });

  test("agent_tree: verifies headers on both endpoints", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_tree_test",
      },
      async () => {
        // Mock responses for both endpoints
        globalThis.fetch = (async (url: string, init?: RequestInit) => {
          fetchMock.calls.push({ url, init });

          // First call: getCurrentAgentId lookup
          if (url.includes("/by-session/")) {
            return {
              ok: true,
              json: async () => ({ id: "agent_current_123" }),
              text: async () => JSON.stringify({ id: "agent_current_123" }),
            };
          }

          // Second call: tree fetch
          return {
            ok: true,
            text: async () => `
🌲 Agent Tree

agent_root_000 [THIS IS YOU]
├─ agent_child_001
│  └─ agent_grandchild_002
└─ agent_child_003`,
            json: async () => ({}),
          };
        }) as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        const result = await plugin.tool!.agent_tree.execute(
          {},
          createMockContext({ sessionID: "ses_tree_test_456" })
        );

        // ========================================
        // REQUEST ASSERTIONS (Multiple Endpoints)
        // ========================================

        expect(fetchMock.calls.length).toBe(2);

        // First call: getCurrentAgentId via /by-session
        const lookupCall = fetchMock.calls[0];
        expect(lookupCall?.url).toBe("http://localhost:3000/aapi/agents/by-session/ses_tree_test_456");
        const lookupHeaders = (lookupCall?.init?.headers as Record<string, string>) ?? {};
        expect(lookupHeaders["X-Birdhouse-Workspace-ID"]).toBe("ws_tree_test");
        expect(lookupHeaders["Content-Type"]).toBe("application/json");

        // Second call: tree fetch with requesting_agent_id
        const treeCall = fetchMock.calls[1];
        expect(treeCall?.url).toBe(
          "http://localhost:3000/aapi/agents/agent_current_123/tree?requesting_agent_id=agent_current_123"
        );
        const treeHeaders = (treeCall?.init?.headers as Record<string, string>) ?? {};
        expect(treeHeaders["X-Birdhouse-Workspace-ID"]).toBe("ws_tree_test");
        expect(treeHeaders["Content-Type"]).toBe("application/json");

        // ========================================
        // RESPONSE ASSERTIONS
        // ========================================

        // Verify tree text is returned
        expect(result).toContain("🌲 Agent Tree");
        expect(result).toContain("[THIS IS YOU]");
        expect(result).toContain("agent_child_001");
        expect(result).toContain("agent_grandchild_002");
      }
    );
  });

  test("agent_tree: handles session not found error", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_tree_error",
      },
      async () => {
        // Mock failed session lookup
        globalThis.fetch = (async (url: string, init?: RequestInit) => {
          fetchMock.calls.push({ url, init });

          // Session lookup fails
          if (url.includes("/by-session/")) {
            return {
              ok: false,
              status: 404,
              json: async () => ({}),
              text: async () => "Session not found",
            };
          }

          // Should never reach tree fetch
          return {
            ok: false,
            status: 500,
            text: async () => "Should not be called",
            json: async () => ({}),
          };
        }) as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        const result = await plugin.tool!.agent_tree.execute(
          {},
          createMockContext({ sessionID: "ses_unknown_999" })
        );

        // ========================================
        // ERROR RESPONSE ASSERTIONS
        // ========================================

        // Verify error message
        expect(result).toContain("Error");
        expect(result).toContain("Could not determine agent ID");
        expect(result).toContain("not be registered");

        // Verify only one call was made (lookup failed, tree fetch never attempted)
        expect(fetchMock.calls.length).toBe(1);
        expect(fetchMock.calls[0]?.url).toContain("/by-session/");
      }
    );
  });

  test("agent_tree: handles tree fetch error after successful lookup", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_tree_fetch_error",
      },
      async () => {
        // Mock responses: successful lookup, failed tree fetch
        globalThis.fetch = (async (url: string, init?: RequestInit) => {
          fetchMock.calls.push({ url, init });

          // First call: successful session lookup
          if (url.includes("/by-session/")) {
            return {
              ok: true,
              json: async () => ({ id: "agent_valid_123" }),
              text: async () => JSON.stringify({ id: "agent_valid_123" }),
            };
          }

          // Second call: failed tree fetch (e.g., agent was deleted)
          return {
            ok: false,
            status: 500,
            text: async () =>
              JSON.stringify({
                error: "Database error while fetching tree",
              }),
            json: async () => ({
              error: "Database error while fetching tree",
            }),
          };
        }) as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        const result = await plugin.tool!.agent_tree.execute({}, createMockContext());

        // ========================================
        // ERROR RESPONSE ASSERTIONS
        // ========================================

        // Verify error message contains the specific error
        expect(result).toContain("Database error while fetching tree");

        // Verify both calls were made
        expect(fetchMock.calls.length).toBe(2);
        expect(fetchMock.calls[0]?.url).toContain("/by-session/");
        expect(fetchMock.calls[1]?.url).toContain("/tree?requesting_agent_id=");

        // Verify headers were correct on both calls
        const lookupHeaders = (fetchMock.calls[0]?.init?.headers as Record<string, string>) ?? {};
        expect(lookupHeaders["X-Birdhouse-Workspace-ID"]).toBe("ws_tree_fetch_error");

        const treeHeaders = (fetchMock.calls[1]?.init?.headers as Record<string, string>) ?? {};
        expect(treeHeaders["X-Birdhouse-Workspace-ID"]).toBe("ws_tree_fetch_error");
      }
    );
  });

  // ========================================
  // birdhouse_export_agent_markdown Tests
  // ========================================

  test("birdhouse_export_agent_markdown: comprehensive request and response validation", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_export_123",
      },
      async () => {
        // Mock successful export response
        fetchMock.setResponse({
          ok: true,
          json: async () => ({
            filepath: "/Users/test/exports/agent_abc123_timeline.md",
            filename: "agent_abc123_timeline.md",
            agent_id: "agent_abc123",
          }),
          text: async () =>
            JSON.stringify({
              filepath: "/Users/test/exports/agent_abc123_timeline.md",
              filename: "agent_abc123_timeline.md",
              agent_id: "agent_abc123",
            }),
        });

        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        // Execute export tool
        const result = await plugin.tool!.birdhouse_export_agent_markdown.execute(
          {
            agent_id: "agent_abc123",
            directory: "/Users/test/exports",
          },
          createMockContext()
        );

        // ========================================
        // REQUEST ASSERTIONS
        // ========================================

        expect(fetchMock.calls.length).toBe(1);
        const call = fetchMock.getLastCall();

        // Verify URL
        expect(call?.url).toBe("http://localhost:3000/aapi/agents/agent_abc123/export");

        // Verify HTTP method
        expect(call?.init?.method).toBe("POST");

        // 🎯 CRITICAL: Verify headers (workspace isolation)
        const headers = fetchMock.getHeaders();
        expect(headers["X-Birdhouse-Workspace-ID"]).toBe("ws_export_123");
        expect(headers["Content-Type"]).toBe("application/json");

        // Verify request body
        const body = JSON.parse(call?.init?.body as string);
        expect(body.directory).toBe("/Users/test/exports");

        // ========================================
        // RESPONSE ASSERTIONS
        // ========================================

        // Verify response parsing
        expect(result).toContain("agent_abc123");
        expect(result).toContain("agent_abc123_timeline.md");
        expect(result).toContain("/Users/test/exports/agent_abc123_timeline.md");
        
        // Verify success indicator
        expect(result).toContain("✅");
        expect(result).toContain("Exported agent");
      }
    );
  });

  test("birdhouse_export_agent_markdown: handles agent not found (404)", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_export_error",
      },
      async () => {
        // Mock 404 response
        fetchMock.setResponse({
          ok: false,
          status: 404,
          text: async () => JSON.stringify({
            error: "Agent not found",
          }),
          json: async () => ({
            error: "Agent not found",
          }),
        });

        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        const result = await plugin.tool!.birdhouse_export_agent_markdown.execute(
          {
            agent_id: "agent_nonexistent",
            directory: "/tmp/exports",
          },
          createMockContext()
        );

        // ========================================
        // ERROR RESPONSE ASSERTIONS
        // ========================================

        // Verify error message
        expect(result).toContain("Agent not found");
        expect(result).toContain("agent_nonexistent");
        
        // Verify helpful hints
        expect(result).toContain("does not exist");
        expect(result).toContain("correct agent_id");
        
        // Should not contain success indicators
        expect(result).not.toContain("✅");
      }
    );
  });

  test("birdhouse_export_agent_markdown: handles missing directory parameter", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_export_validation",
      },
      async () => {
        // Mock validation error response
        fetchMock.setResponse({
          ok: false,
          status: 400,
          text: async () => JSON.stringify({
            error: "directory parameter is required",
          }),
          json: async () => ({
            error: "directory parameter is required",
          }),
        });

        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        const result = await plugin.tool!.birdhouse_export_agent_markdown.execute(
          {
            agent_id: "agent_test",
            directory: "",
          },
          createMockContext()
        );

        // ========================================
        // VALIDATION ERROR ASSERTIONS
        // ========================================

        // Verify error message
        expect(result).toContain("directory parameter is required");
        
        // Verify helpful hints with examples
        expect(result).toContain("must specify where to write");
        expect(result).toContain("Current directory");
        expect(result).toContain("Downloads");
      }
    );
  });

  // ========================================
  // birdhouse_agent_tree Tests
  // ========================================

  test("birdhouse_agent_tree: comprehensive request and response validation", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_tree_123",
      },
      async () => {
        // Mock tree response (plain text)
        const mockTreeText = `agent_root_123 - Root Agent [anthropic/claude-sonnet-4]
├─ agent_child_456 - Child Agent [anthropic/claude-sonnet-4]
└─ agent_child_789 - Another Child [anthropic/claude-opus-4]`;

        fetchMock.setResponse({
          ok: true,
          text: async () => mockTreeText,
          json: async () => ({}), // Tree endpoint returns text, not JSON
        });

        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        // Execute tree tool
        const result = await plugin.tool!.birdhouse_agent_tree.execute(
          {
            agent_id: "agent_root_123",
          },
          createMockContext()
        );

        // ========================================
        // REQUEST ASSERTIONS
        // ========================================

        expect(fetchMock.calls.length).toBe(1);
        const call = fetchMock.getLastCall();

        // Verify URL
        expect(call?.url).toBe("http://localhost:3000/aapi/agents/agent_root_123/tree");

        // Verify HTTP method (GET is default)
        expect(call?.init?.method).toBeUndefined(); // GET doesn't need explicit method

        // 🎯 CRITICAL: Verify headers (workspace isolation)
        const headers = fetchMock.getHeaders();
        expect(headers["X-Birdhouse-Workspace-ID"]).toBe("ws_tree_123");

        // ========================================
        // RESPONSE ASSERTIONS
        // ========================================

        // Verify tree text is returned as plain text
        expect(result).toBe(mockTreeText);
        expect(result).toContain("agent_root_123");
        expect(result).toContain("Root Agent");
        expect(result).toContain("agent_child_456");
        expect(result).toContain("agent_child_789");
      }
    );
  });

  test("birdhouse_agent_tree: handles agent not found (404)", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_tree_error",
      },
      async () => {
        // Mock 404 response
        fetchMock.setResponse({
          ok: false,
          status: 404,
          text: async () => JSON.stringify({
            error: "Agent not found",
          }),
          json: async () => ({
            error: "Agent not found",
          }),
        });

        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        const result = await plugin.tool!.birdhouse_agent_tree.execute(
          {
            agent_id: "agent_nonexistent",
          },
          createMockContext()
        );

        // ========================================
        // ERROR RESPONSE ASSERTIONS
        // ========================================

        // Verify error message
        expect(result).toContain("Agent not found");
        expect(result).toContain("agent_nonexistent");
        
        // Verify helpful hints
        expect(result).toContain("does not exist");
        expect(result).toContain("correct agent_id");
      }
    );
  });

  // ========================================
  // birdhouse_export_tree_markdown Tests
  // ========================================

  test("birdhouse_export_tree_markdown: comprehensive request and response validation", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_tree_export_123",
      },
      async () => {
        // Mock successful tree export response
        fetchMock.setResponse({
          ok: true,
          json: async () => ({
            success: true,
            directory: "/Users/test/tree-exports",
            files_created: {
              tree: "tree.txt",
              agent_data: "agents.txt",
              agents: [
                "agent_root_123_timeline.md",
                "agent_child_456_timeline.md",
                "agent_child_789_timeline.md",
              ],
            },
            summary: {
              total_agents: 3,
              exported_count: 3,
              failed_count: 0,
              failures: [],
            },
          }),
          text: async () =>
            JSON.stringify({
              success: true,
              directory: "/Users/test/tree-exports",
              files_created: {
                tree: "tree.txt",
                agent_data: "agents.txt",
                agents: [
                  "agent_root_123_timeline.md",
                  "agent_child_456_timeline.md",
                  "agent_child_789_timeline.md",
                ],
              },
              summary: {
                total_agents: 3,
                exported_count: 3,
                failed_count: 0,
                failures: [],
              },
            }),
        });

        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        // Execute tree export tool
        const result = await plugin.tool!.birdhouse_export_tree_markdown.execute(
          {
            root_agent_id: "agent_root_123",
            directory: "/Users/test/tree-exports",
          },
          createMockContext()
        );

        // ========================================
        // REQUEST ASSERTIONS
        // ========================================

        expect(fetchMock.calls.length).toBe(1);
        const call = fetchMock.getLastCall();

        // Verify URL
        expect(call?.url).toBe("http://localhost:3000/aapi/agents/agent_root_123/export-tree");

        // Verify HTTP method
        expect(call?.init?.method).toBe("POST");

        // 🎯 CRITICAL: Verify headers (workspace isolation)
        const headers = fetchMock.getHeaders();
        expect(headers["X-Birdhouse-Workspace-ID"]).toBe("ws_tree_export_123");
        expect(headers["Content-Type"]).toBe("application/json");

        // Verify request body
        const body = JSON.parse(call?.init?.body as string);
        expect(body.directory).toBe("/Users/test/tree-exports");

        // ========================================
        // RESPONSE ASSERTIONS (Complex structure)
        // ========================================

        // Verify success indicator
        expect(result).toContain("✅");
        expect(result).toContain("Exported agent tree from agent_root_123");

        // Verify directory path
        expect(result).toContain("/Users/test/tree-exports");

        // Verify files created section
        expect(result).toContain("Files created");
        expect(result).toContain("tree.txt");
        expect(result).toContain("agents.txt");
        expect(result).toContain("3 agent markdown files");

        // Verify summary statistics
        expect(result).toContain("Total agents exported: 3/3");
        
        // Should not contain failure indicators
        expect(result).not.toContain("failed");
        expect(result).not.toContain("Failed exports");
      }
    );
  });

  test("birdhouse_export_tree_markdown: handles partial failure (some agents fail)", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_tree_partial",
      },
      async () => {
        // Mock response with partial failures
        fetchMock.setResponse({
          ok: true,
          json: async () => ({
            success: true,
            directory: "/tmp/exports",
            files_created: {
              tree: "tree.txt",
              agent_data: "agents.txt",
              agents: [
                "agent_root_123_timeline.md",
                "agent_child_456_timeline.md",
              ],
            },
            summary: {
              total_agents: 4,
              exported_count: 2,
              failed_count: 2,
              failures: [
                { agent_id: "agent_broken_111", error: "Message parsing failed" },
                { agent_id: "agent_broken_222", error: "File write error" },
              ],
            },
          }),
          text: async () =>
            JSON.stringify({
              success: true,
              directory: "/tmp/exports",
              files_created: {
                tree: "tree.txt",
                agent_data: "agents.txt",
                agents: [
                  "agent_root_123_timeline.md",
                  "agent_child_456_timeline.md",
                ],
              },
              summary: {
                total_agents: 4,
                exported_count: 2,
                failed_count: 2,
                failures: [
                  { agent_id: "agent_broken_111", error: "Message parsing failed" },
                  { agent_id: "agent_broken_222", error: "File write error" },
                ],
              },
            }),
        });

        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        const result = await plugin.tool!.birdhouse_export_tree_markdown.execute(
          {
            root_agent_id: "agent_root_123",
            directory: "/tmp/exports",
          },
          createMockContext()
        );

        // ========================================
        // PARTIAL FAILURE ASSERTIONS
        // ========================================

        // Verify success indicator still present
        expect(result).toContain("✅");

        // Verify failure count in summary
        expect(result).toContain("2 agent markdown files (2 failed)");
        expect(result).toContain("Total agents exported: 2/4");

        // Verify detailed failure list
        expect(result).toContain("Failed exports:");
        expect(result).toContain("agent_broken_111: Message parsing failed");
        expect(result).toContain("agent_broken_222: File write error");
      }
    );
  });

  test("birdhouse_export_tree_markdown: handles agent not found (404)", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_tree_export_error",
      },
      async () => {
        // Mock 404 response
        fetchMock.setResponse({
          ok: false,
          status: 404,
          text: async () => JSON.stringify({
            error: "Agent not found",
          }),
          json: async () => ({
            error: "Agent not found",
          }),
        });

        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        const result = await plugin.tool!.birdhouse_export_tree_markdown.execute(
          {
            root_agent_id: "agent_nonexistent",
            directory: "/tmp/exports",
          },
          createMockContext()
        );

        // ========================================
        // ERROR RESPONSE ASSERTIONS
        // ========================================

        // Verify error message
        expect(result).toContain("Agent not found");
        expect(result).toContain("agent_nonexistent");
        
        // Verify helpful hints
        expect(result).toContain("does not exist");
        expect(result).toContain("correct agent_id");
        
        // Should not contain success indicators
        expect(result).not.toContain("✅");
      }
    );
  });

  test("birdhouse_export_tree_markdown: handles missing directory parameter", async () => {
    await withEnv(
      {
        BIRDHOUSE_SERVER: "http://localhost:3000",
        BIRDHOUSE_WORKSPACE_ID: "ws_tree_validation",
      },
      async () => {
        // Mock validation error response
        fetchMock.setResponse({
          ok: false,
          status: 400,
          text: async () => JSON.stringify({
            error: "directory parameter is required",
          }),
          json: async () => ({
            error: "directory parameter is required",
          }),
        });

        globalThis.fetch = fetchMock.mock as any;

        const plugin = await BirdhousePlugin({
          client: createMockClient(),
          directory: "/test",
          project: createMockProject(),
          worktree: "/test",
          $: createMockShell(),
        });

        const result = await plugin.tool!.birdhouse_export_tree_markdown.execute(
          {
            root_agent_id: "agent_test",
            directory: "",
          },
          createMockContext()
        );

        // ========================================
        // VALIDATION ERROR ASSERTIONS
        // ========================================

        // Verify error message
        expect(result).toContain("directory parameter is required");
        
        // Verify helpful hints with examples
        expect(result).toContain("must specify where to write");
        expect(result).toContain("Current directory");
        expect(result).toContain("tree-exports");
      }
    );
  });
});
