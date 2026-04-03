// ABOUTME: Tests the Birdhouse harness interfaces with an in-memory fake harness and event stream.
// ABOUTME: Verifies stateful session/message behavior and optional capability exposure for Phase 1.

import { describe, expect, it } from "bun:test";
import type { AgentHarness } from "./agent-harness";
import type { HarnessEvent } from "./harness-events";
import { createTestAgentHarness, createTestHarnessEventStream } from "./test-harness";

describe("createTestAgentHarness", () => {
  it("implements the required AgentHarness contract", async () => {
    const harness: AgentHarness = createTestAgentHarness();

    const session = await harness.createSession("Planner");

    expect(session.title).toBe("Planner");
    expect(await harness.getSession(session.id)).toEqual(session);

    await harness.updateSessionTitle(session.id, "Updated Planner");

    expect((await harness.getSession(session.id)).title).toBe("Updated Planner");
    expect(await harness.getProviders()).toEqual({ providers: [] });
  });

  it("stores sent messages, completion state, and abort state in memory", async () => {
    const harness = createTestAgentHarness();
    const session = await harness.createSession("Worker");

    expect(await harness.getMessages(session.id)).toEqual([]);
    expect(await harness.getSessionStatus()).toEqual({ [session.id]: { type: "idle" } });

    const message = await harness.sendMessage(session.id, "Build the feature", {
      model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      system: "system prompt",
      metadata: { sent_by_agent_id: "agent_parent" },
      parts: [
        {
          type: "text",
          text: "Build the feature",
          metadata: { sent_by_agent_id: "agent_parent" },
        },
      ],
    });

    const messages = await harness.getMessages(session.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(message);
    expect(messages[0]?.info.role).toBe("assistant");

    if (messages[0]?.info.role !== "assistant") {
      throw new Error("Expected assistant message");
    }

    expect(messages[0].info.modelID).toBe("claude-sonnet-4");

    expect(await harness.waitForCompletion(session.id)).toEqual(message);
    expect(await harness.getSessionStatus()).toEqual({ [session.id]: { type: "idle" } });

    await harness.abortSession(session.id);

    expect(harness.recorded.abortSessionCalls).toEqual([session.id]);
    expect(await harness.getSessionStatus()).toEqual({ [session.id]: { type: "idle" } });
  });

  it("supports seeding sessions, messages, statuses, and completion results", async () => {
    const harness = createTestAgentHarness();

    harness.seedSession({
      id: "ses_seeded",
      title: "Seeded Session",
      projectID: "project_seeded",
      directory: "/seeded",
      version: "1.0.0",
      time: { created: 100, updated: 200 },
    });
    harness.seedMessages("ses_seeded", [
      {
        info: {
          id: "msg_seeded",
          sessionID: "ses_seeded",
          role: "assistant",
          time: { created: 300, completed: 400 },
          parentID: "msg_user_seeded",
          modelID: "claude-haiku-4",
          providerID: "anthropic",
          mode: "build",
          cost: 0,
          tokens: {
            input: 10,
            output: 5,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          path: { cwd: "/seeded", root: "/seeded" },
          finish: "stop",
        },
        parts: [{ type: "text", text: "Seeded response" }],
      },
    ]);
    harness.seedSessionStatus("ses_seeded", { type: "busy" });
    harness.seedCompletion("ses_seeded", {
      info: {
        id: "msg_completion",
        sessionID: "ses_seeded",
        role: "assistant",
        time: { created: 500, completed: 600 },
        parentID: "msg_user_seeded",
        modelID: "claude-haiku-4",
        providerID: "anthropic",
        mode: "build",
        cost: 0,
        tokens: {
          input: 11,
          output: 6,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        path: { cwd: "/seeded", root: "/seeded" },
        finish: "stop",
      },
      parts: [{ type: "text", text: "Completion response" }],
    });

    expect((await harness.getSession("ses_seeded")).title).toBe("Seeded Session");
    expect((await harness.getMessages("ses_seeded"))[0]?.info.id).toBe("msg_seeded");
    expect((await harness.getSessionStatus()).ses_seeded).toEqual({ type: "busy" });
    expect((await harness.waitForCompletion("ses_seeded")).info.id).toBe("msg_completion");
  });

  it("exposes optional capabilities only when enabled", async () => {
    const harness = createTestAgentHarness({
      skills: [
        {
          name: "find-docs",
          description: "Retrieve docs",
          location: "/skills/find-docs",
          content: "# Find Docs",
        },
      ],
      questionRequests: [
        {
          id: "question_1",
          sessionID: "ses_question",
          questions: [
            {
              question: "Choose one",
              header: "Question",
              options: [{ label: "Yes", description: "Approve" }],
            },
          ],
        },
      ],
      generatedText: "Generated title",
      enableRevert: true,
      enableSkills: true,
      enableGenerate: true,
      enableQuestions: true,
    });

    expect(harness.capabilities.revert).toBeDefined();
    expect(harness.capabilities.skills).toBeDefined();
    expect(harness.capabilities.generate).toBeDefined();
    expect(harness.capabilities.questions).toBeDefined();

    await harness.capabilities.revert?.revertSession("ses_question", "msg_1");
    await harness.capabilities.revert?.unrevertSession("ses_question");
    expect(harness.recorded.revertSessionCalls).toEqual([{ sessionId: "ses_question", messageId: "msg_1" }]);
    expect(harness.recorded.unrevertSessionCalls).toEqual(["ses_question"]);

    expect(await harness.capabilities.skills?.listSkills()).toEqual([
      {
        name: "find-docs",
        description: "Retrieve docs",
        location: "/skills/find-docs",
        content: "# Find Docs",
      },
    ]);
    await harness.capabilities.skills?.reloadSkills();
    expect(harness.recorded.reloadSkillsCalls).toBe(1);

    expect(
      await harness.capabilities.generate?.generate({
        message: "Generate a title",
      }),
    ).toBe("Generated title");

    expect(await harness.capabilities.questions?.listPendingQuestions()).toHaveLength(1);
    await harness.capabilities.questions?.replyToQuestion("question_1", [["Yes"]]);
    expect(harness.recorded.replyToQuestionCalls).toEqual([{ requestId: "question_1", answers: [["Yes"]] }]);
  });

  it("omits optional capabilities by default", () => {
    const harness = createTestAgentHarness();

    expect(harness.capabilities.revert).toBeUndefined();
    expect(harness.capabilities.skills).toBeUndefined();
    expect(harness.capabilities.generate).toBeUndefined();
    expect(harness.capabilities.questions).toBeUndefined();
  });
});

describe("createTestHarnessEventStream", () => {
  it("publishes harness-originated events to subscribers", () => {
    const stream = createTestHarnessEventStream();
    const received: HarnessEvent[] = [];

    const unsubscribe = stream.subscribe((event) => {
      received.push(event);
    });

    stream.emit({
      type: "message.updated",
      sessionID: "ses_1",
      properties: { messageID: "msg_1" },
    });
    unsubscribe();
    stream.emit({
      type: "session.idle",
      sessionID: "ses_1",
      properties: {},
    });

    expect(received).toEqual([
      {
        type: "message.updated",
        sessionID: "ses_1",
        properties: { messageID: "msg_1" },
      },
    ]);
  });
});
