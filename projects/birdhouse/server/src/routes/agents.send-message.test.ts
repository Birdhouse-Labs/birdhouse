// ABOUTME: Tests for token recording in the POST /agents/:id/messages route
// ABOUTME: Verifies sendMessage calls telemetry correctly and never fails due to telemetry errors

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createTestDeps, withDeps } from "../dependencies";
import { sendMessage } from "../features/api/send-message";
import type { BirdhouseMessage as Message } from "../harness";
import { type AgentsDB, initAgentsDB } from "../lib/agents-db";
import type { TelemetryClient } from "../lib/telemetry";
import { createRootAgent } from "../test-utils/agent-factories";
import { createTestApp } from "../test-utils/workspace-context";

function makeAssistantMessage(sessionId: string): Message {
  return {
    info: {
      id: "msg_response",
      sessionID: sessionId,
      role: "assistant",
      time: { created: Date.now(), completed: Date.now() },
      parentID: "msg_user",
      modelID: "claude-sonnet-4",
      providerID: "anthropic",
      mode: "build",
      cost: 0,
      tokens: { input: 100, output: 75, reasoning: 10, cache: { read: 28_000, write: 450 } },
      path: { cwd: "/test", root: "/" },
    },
    parts: [],
  };
}

describe("POST /agents/:id/messages — token recording", () => {
  let recordMessageTokensSpy: ReturnType<typeof mock>;
  let mockTelemetry: TelemetryClient;
  let agentsDB: AgentsDB;

  beforeEach(async () => {
    recordMessageTokensSpy = mock(() => {});
    mockTelemetry = {
      trackAgentCreated: mock(() => {}),
      trackTokens: mock(() => {}),
      recordMessageTokens: recordMessageTokensSpy,
    };
    agentsDB = await initAgentsDB(":memory:");
  });

  it("calls recordMessageTokens with the agent ID and response message", async () => {
    const agent = createRootAgent(agentsDB, { session_id: "ses_test_tokens" });
    const message = makeAssistantMessage("ses_test_tokens");

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness.sendMessage = async () => message;
    deps.telemetry = mockTelemetry;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.post("/:id/messages", (c) => sendMessage(c, deps));

      await app.request(`/${agent.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello" }),
      });
    });

    expect(recordMessageTokensSpy).toHaveBeenCalledTimes(1);
    expect(recordMessageTokensSpy).toHaveBeenCalledWith(agent.id, message);
  });

  it("does not fail the request if telemetry throws", async () => {
    recordMessageTokensSpy = mock(() => {
      throw new Error("telemetry exploded");
    });
    mockTelemetry.recordMessageTokens = recordMessageTokensSpy;

    const agent = createRootAgent(agentsDB, { session_id: "ses_telemetry_fail" });
    const message = makeAssistantMessage("ses_telemetry_fail");

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness.sendMessage = async () => message;
    deps.telemetry = mockTelemetry;

    let responseStatus: number | undefined;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.post("/:id/messages", (c) => sendMessage(c, deps));

      const response = await app.request(`/${agent.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello" }),
      });
      responseStatus = response.status;
    });

    expect(responseStatus).toBe(200);
  });
});
