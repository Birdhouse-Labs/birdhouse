// ABOUTME: Tests for agent-messaging first-message sending and telemetry integration
// ABOUTME: Verifies sendFirstMessage calls telemetry correctly with the right message and agent ID

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createTestDeps, withDeps } from "../dependencies";
import { sendFirstMessage } from "./agent-messaging";
import type { Message, Skill } from "./opencode-client";
import type { TelemetryClient } from "./telemetry";

function makeAssistantMessage(tokens: {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
}): Message {
  return {
    info: {
      id: "msg_test",
      sessionID: "ses_test",
      role: "assistant",
      time: { created: Date.now(), completed: Date.now() },
      parentID: "msg_user",
      modelID: "claude-sonnet-4",
      providerID: "anthropic",
      mode: "build",
      cost: 0,
      tokens,
      path: { cwd: "/test", root: "/" },
    },
    parts: [],
  };
}

function makeUserMessage(): Message {
  return {
    info: {
      id: "msg_user",
      sessionID: "ses_test",
      role: "user",
      time: { created: Date.now() },
      agent: "test-agent",
      model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
    },
    parts: [],
  };
}

describe("agent-messaging token recording", () => {
  let recordMessageTokensSpy: ReturnType<typeof mock>;
  let mockTelemetry: TelemetryClient;

  beforeEach(() => {
    recordMessageTokensSpy = mock(() => {});
    mockTelemetry = {
      trackAgentCreated: mock(() => {}),
      trackTokens: mock(() => {}),
      recordMessageTokens: recordMessageTokensSpy,
    };
  });

  describe("sendFirstMessage — token recording (blocking mode)", () => {
    it("attaches matching skills before sending the first message", async () => {
      let capturedPrompt = "";
      const visibleSkills: Skill[] = [
        {
          name: "find-docs",
          description: "Retrieve current docs.",
          location: "/Users/test/.claude/skills/find-docs/SKILL.md",
          content: "# Find Docs",
        },
      ];

      const deps = createTestDeps({
        listSkills: async () => visibleSkills,
        sendMessage: async (_sessionId, text) => {
          capturedPrompt = text;
          return makeAssistantMessage({
            input: 100,
            output: 50,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          });
        },
      });
      deps.dataDb.setSkillTriggerPhrases("find-docs", ["docs please"]);
      deps.telemetry = mockTelemetry;

      await withDeps(deps, () =>
        sendFirstMessage(deps, {
          agentId: "agent_first_skill",
          sessionId: "ses_test",
          model: "anthropic/claude-sonnet-4",
          prompt: "docs please before you start",
          wait: true,
        }),
      );

      expect(capturedPrompt).toBe(`docs please before you start

<skill name="find-docs">
# Find Docs
</skill>`);
    });

    it("calls recordMessageTokens with the agent ID and message", async () => {
      const message = makeAssistantMessage({
        input: 100,
        output: 50,
        reasoning: 5,
        cache: { read: 27_000, write: 500 },
      });

      const deps = createTestDeps({ sendMessage: async () => message });
      deps.telemetry = mockTelemetry;

      await withDeps(deps, () =>
        sendFirstMessage(deps, {
          agentId: "agent_test123",
          sessionId: "ses_test",
          model: "anthropic/claude-sonnet-4",
          prompt: "Hello",
          wait: true,
        }),
      );

      expect(recordMessageTokensSpy).toHaveBeenCalledTimes(1);
      expect(recordMessageTokensSpy).toHaveBeenCalledWith("agent_test123", message);
    });

    it("does not call recordMessageTokens for user-role messages", async () => {
      const userMessage = makeUserMessage();
      const deps = createTestDeps({ sendMessage: async () => userMessage });
      deps.telemetry = mockTelemetry;

      await withDeps(deps, () =>
        sendFirstMessage(deps, {
          agentId: "agent_user_msg",
          sessionId: "ses_test",
          model: "anthropic/claude-sonnet-4",
          prompt: "Hello",
          wait: true,
        }),
      );

      // recordMessageTokens is called — it's telemetry's job to skip user messages
      // (the role check lives inside TelemetryClient.recordMessageTokens)
      expect(recordMessageTokensSpy).toHaveBeenCalledTimes(1);
      expect(recordMessageTokensSpy).toHaveBeenCalledWith("agent_user_msg", userMessage);
    });

    it("does not throw if telemetry throws", async () => {
      const message = makeAssistantMessage({
        input: 100,
        output: 50,
        reasoning: 0,
        cache: { read: 5000, write: 100 },
      });

      recordMessageTokensSpy = mock(() => {
        throw new Error("telemetry failed");
      });
      mockTelemetry.recordMessageTokens = recordMessageTokensSpy;

      const deps = createTestDeps({ sendMessage: async () => message });
      deps.telemetry = mockTelemetry;

      await expect(
        withDeps(deps, () =>
          sendFirstMessage(deps, {
            agentId: "agent_fail",
            sessionId: "ses_test",
            model: "anthropic/claude-sonnet-4",
            prompt: "Hello",
            wait: true,
          }),
        ),
      ).resolves.toBeDefined();
    });
  });

  describe("sendFirstMessage — token recording (async/fire-and-forget mode)", () => {
    it("calls recordMessageTokens after async message completes", async () => {
      const message = makeAssistantMessage({
        input: 200,
        output: 100,
        reasoning: 0,
        cache: { read: 15_000, write: 300 },
      });

      const deps = createTestDeps({ sendMessage: async () => message });
      deps.telemetry = mockTelemetry;

      await withDeps(deps, () =>
        sendFirstMessage(deps, {
          agentId: "agent_async",
          sessionId: "ses_test",
          model: "anthropic/claude-sonnet-4",
          prompt: "Hello",
          wait: false,
        }),
      );

      // Give the async chain time to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(recordMessageTokensSpy).toHaveBeenCalledTimes(1);
      expect(recordMessageTokensSpy).toHaveBeenCalledWith("agent_async", message);
    });
  });
});
