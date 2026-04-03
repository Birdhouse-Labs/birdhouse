// ABOUTME: Tests for agent-to-agent message sending with metadata
// ABOUTME: Verifies X-Session-ID header triggers metadata attachment

import { beforeEach, describe, expect, test } from "bun:test";
import { createTestDeps, withDeps } from "../../dependencies";
import { type AgentsDB, initAgentsDB } from "../../lib/agents-db";
import type { Message } from "../../lib/opencode-client";
import { createTestApp } from "../../test-utils";
import { createRootAgent } from "../../test-utils/agent-factories";
import { sendMessage } from "./send-message";

describe("AAPI send-message", () => {
  let agentsDB: AgentsDB;

  beforeEach(async () => {
    agentsDB = await initAgentsDB(":memory:");
  });

  describe("POST /aapi/agents/:id/messages - Agent-to-agent with metadata", () => {
    test("adds metadata when X-Session-ID header is present", async () => {
      // Create calling agent (the one sending the message)
      const callingAgent = createRootAgent(agentsDB, {
        session_id: "ses_calling",
        title: "Calling Agent",
      });

      // Create target agent (the one receiving the message)
      const targetAgent = createRootAgent(agentsDB, {
        session_id: "ses_target",
        title: "Target Agent",
      });

      const mockMessage: Message = {
        info: {
          id: "msg_response",
          sessionID: "ses_target",
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user",
          modelID: "claude-sonnet-4",
          providerID: "anthropic",
          mode: "build",
          cost: 0,
          tokens: {
            input: 100,
            output: 50,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          path: { cwd: "/test", root: "/" },
        },
        parts: [
          {
            type: "text",
            text: "Response from target agent",
            id: "part_1",
            sessionID: "ses_123",
            messageID: "msg_1",
          },
        ],
      };

      let capturedPart: { text: string; metadata?: Record<string, unknown> } | undefined;

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;
      deps.harness.sendMessage = async (_sessionId, _text, options) => {
        capturedPart = options?.parts?.[0] as typeof capturedPart;
        return mockMessage;
      };

      await withDeps(deps, async () => {
        const app = await createTestApp({ agentsDb: agentsDB });
        app.post("/:id/messages", (c) => sendMessage(c, deps));

        const response = await app.request(`/${targetAgent.id}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": callingAgent.session_id,
          },
          body: JSON.stringify({
            text: "Hello from calling agent",
          }),
        });

        expect(response.status).toBe(200);

        // Verify text is unchanged (no signature appended)
        expect(capturedPart?.text).toBeDefined();
        expect(capturedPart?.text).toBe("Hello from calling agent");
        expect(capturedPart?.text).not.toContain("---");
        expect(capturedPart?.text).not.toContain("This reply was sent by");

        // Verify metadata was added
        expect(capturedPart?.metadata).toBeDefined();
        expect(capturedPart?.metadata?.sent_by_agent_id).toBe(callingAgent.id);
        expect(capturedPart?.metadata?.sent_by_agent_title).toBe("Calling Agent");
      });
    });

    test("does not add metadata when X-Session-ID header is missing", async () => {
      // Create target agent only (no calling agent)
      const targetAgent = createRootAgent(agentsDB, {
        session_id: "ses_target_no_sig",
        title: "Target Agent",
      });

      const mockMessage: Message = {
        info: {
          id: "msg_response",
          sessionID: "ses_target_no_sig",
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user",
          modelID: "claude-sonnet-4",
          providerID: "anthropic",
          mode: "build",
          cost: 0,
          tokens: {
            input: 100,
            output: 50,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          path: { cwd: "/test", root: "/" },
        },
        parts: [
          {
            type: "text",
            text: "Response",
            id: "part_1",
            sessionID: "ses_123",
            messageID: "msg_1",
          },
        ],
      };

      let capturedText: string | undefined;

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;
      deps.harness.sendMessage = async (_sessionId, _text, options) => {
        capturedText = (options?.parts?.[0] as { text?: string } | undefined)?.text;
        return mockMessage;
      };

      await withDeps(deps, async () => {
        const app = await createTestApp({ agentsDb: agentsDB });
        app.post("/:id/messages", (c) => sendMessage(c, deps));

        const response = await app.request(`/${targetAgent.id}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // No X-Session-ID header
          },
          body: JSON.stringify({
            text: "Message from UI",
          }),
        });

        expect(response.status).toBe(200);

        // Verify text is unchanged
        expect(capturedText).toBe("Message from UI");
      });
    });

    test("does not add metadata when X-Session-ID is invalid", async () => {
      // Create target agent only
      const targetAgent = createRootAgent(agentsDB, {
        session_id: "ses_target_invalid",
        title: "Target Agent",
      });

      const mockMessage: Message = {
        info: {
          id: "msg_response",
          sessionID: "ses_target_invalid",
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user",
          modelID: "claude-sonnet-4",
          providerID: "anthropic",
          mode: "build",
          cost: 0,
          tokens: {
            input: 100,
            output: 50,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          path: { cwd: "/test", root: "/" },
        },
        parts: [
          {
            type: "text",
            text: "Response",
            id: "part_1",
            sessionID: "ses_123",
            messageID: "msg_1",
          },
        ],
      };

      let capturedText: string | undefined;

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;
      deps.harness.sendMessage = async (_sessionId, _text, options) => {
        capturedText = (options?.parts?.[0] as { text?: string } | undefined)?.text;
        return mockMessage;
      };

      await withDeps(deps, async () => {
        const app = await createTestApp({ agentsDb: agentsDB });
        app.post("/:id/messages", (c) => sendMessage(c, deps));

        const response = await app.request(`/${targetAgent.id}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": "ses_nonexistent",
          },
          body: JSON.stringify({
            text: "Message with bad session",
          }),
        });

        expect(response.status).toBe(200);

        // Verify text is unchanged (invalid session ID)
        expect(capturedText).toBe("Message with bad session");
      });
    });

    test("returns 404 when target agent does not exist", async () => {
      const callingAgent = createRootAgent(agentsDB, {
        session_id: "ses_calling_404",
        title: "Calling Agent",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = await createTestApp({ agentsDb: agentsDB });
        app.post("/:id/messages", (c) => sendMessage(c, deps));

        const response = await app.request("/agent_nonexistent/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": callingAgent.session_id,
          },
          body: JSON.stringify({
            text: "Message to nonexistent agent",
          }),
        });

        expect(response.status).toBe(404);
        const body = (await response.json()) as { error: string };
        expect(body.error).toContain("not found");
      });
    });
  });
});
