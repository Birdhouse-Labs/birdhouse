// ABOUTME: Tests the OpenCode AgentHarness adapter against the existing OpenCode client boundary.
// ABOUTME: Verifies required methods, optional capabilities, and consistent send/abort behavior.

import { beforeEach, describe, expect, it } from "bun:test";
import type {
  Message,
  OpenCodeClient,
  ProvidersResponse,
  QuestionRequest,
  Session,
  Skill,
} from "../lib/opencode-client";
import { createTestOpenCodeClient, setMockSessionPrompt } from "../lib/opencode-client";
import { OpenCodeAgentHarness } from "./opencode-adapter";

function makeSession(id = "ses_1"): Session {
  return {
    id,
    projectID: "project_1",
    directory: "/workspace",
    title: `Session ${id}`,
    version: "1.0.0",
    time: { created: 100, updated: 200 },
  };
}

function makeMessage(sessionId = "ses_1"): Message {
  return {
    info: {
      id: `msg_${sessionId}`,
      sessionID: sessionId,
      role: "assistant",
      time: { created: 100, completed: 120 },
      parentID: "msg_user",
      modelID: "claude-sonnet-4",
      providerID: "anthropic",
      mode: "build",
      cost: 0,
      tokens: {
        input: 10,
        output: 5,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      path: { cwd: "/workspace", root: "/workspace" },
      finish: "stop",
    },
    parts: [
      {
        id: `part_${sessionId}`,
        sessionID: sessionId,
        messageID: `msg_${sessionId}`,
        type: "text",
        text: "Adapter response",
      } as unknown as Message["parts"][number],
    ],
  };
}

describe("OpenCodeAgentHarness", () => {
  beforeEach(() => {
    setMockSessionPrompt(undefined);
  });

  it("delegates required methods to the wrapped OpenCode client", async () => {
    const opencode = createTestOpenCodeClient();
    opencode.createSession = async (title?: string) => makeSession(title ? `ses_${title}` : "ses_new");
    opencode.forkSession = async (sessionId: string) => ({ ...makeSession("ses_forked"), parentID: sessionId });
    opencode.getSession = async (sessionId: string) => makeSession(sessionId);
    opencode.getMessages = async (sessionId: string) => [makeMessage(sessionId)];
    opencode.getSessionStatus = async () => ({ ses_1: { type: "busy" } });
    opencode.waitForSessionCompletion = async (sessionId: string) => makeMessage(sessionId);
    opencode.getProviders = async () => ({ providers: [] });
    opencode.updateSessionTitle = async () => {};

    const harness = new OpenCodeAgentHarness(opencode, "/workspace");

    expect(harness.kind).toBe("opencode");
    expect((await harness.createSession("Planner")).id).toBe("ses_Planner");
    expect((await harness.forkSession("ses_1")).parentID).toBe("ses_1");
    expect((await harness.getSession("ses_1")).id).toBe("ses_1");
    expect((await harness.getMessages("ses_1"))[0]?.info.id).toBe("msg_ses_1");
    expect((await harness.getSessionStatus()).ses_1).toEqual({ type: "busy" });
    expect((await harness.waitForCompletion("ses_1")).info.id).toBe("msg_ses_1");
    expect(await harness.getProviders()).toEqual({ providers: [] });

    await expect(harness.updateSessionTitle("ses_1", "Updated")).resolves.toBeUndefined();
  });

  it("enables all optional capabilities for OpenCode", async () => {
    const opencode = createTestOpenCodeClient();
    const skills: Skill[] = [
      {
        name: "find-docs",
        description: "Retrieve docs",
        location: "/skills/find-docs",
        content: "# Find Docs",
      },
    ];
    const questions: QuestionRequest[] = [
      {
        id: "question_1",
        sessionID: "ses_1",
        questions: [
          {
            question: "Continue?",
            header: "Question",
            options: [{ label: "Yes", description: "Approve" }],
          },
        ],
      },
    ];
    const providers: ProvidersResponse = {
      providers: [
        {
          id: "anthropic",
          name: "Anthropic",
          models: {
            "claude-sonnet-4": { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
          },
        },
      ],
    };

    opencode.listSkills = async () => skills;
    opencode.reloadSkillState = async () => {};
    opencode.generate = async () => "Generated title";
    opencode.listPendingQuestions = async () => questions;
    opencode.replyToQuestion = async () => {};
    opencode.getProviders = async () => providers;

    const harness = new OpenCodeAgentHarness(opencode, "/workspace");

    expect(await harness.capabilities.skills?.listSkills()).toEqual(skills);
    await expect(harness.capabilities.skills?.reloadSkills()).resolves.toBeUndefined();
    expect(await harness.capabilities.generate?.generate({ message: "Generate" })).toBe("Generated title");
    expect(await harness.capabilities.questions?.listPendingQuestions()).toEqual(questions);
    await expect(harness.capabilities.questions?.replyToQuestion("question_1", [["Yes"]])).resolves.toBeUndefined();
    expect(await harness.getProviders()).toEqual(providers);
  });

  it("uses the SDK client prompt path for sendMessage and maps the response", async () => {
    const opencode = createTestOpenCodeClient();
    const harness = new OpenCodeAgentHarness(opencode, "/workspace");

    setMockSessionPrompt(async (options) => {
      expect(options.path?.id).toBe("ses_sdk");
      expect((options as typeof options & { query?: { directory?: string } }).query?.directory).toBe("/workspace");
      expect(options.body?.model).toEqual({ providerID: "anthropic", modelID: "claude-sonnet-4" });
      expect(options.body?.system).toBe("Birdhouse system prompt");
      expect(options.body?.agent).toBe("planner");
      const promptParts = options.body?.parts as Array<Record<string, unknown>> | undefined;

      expect(promptParts).toHaveLength(2);
      expect(promptParts?.[0]).toEqual({
        type: "text",
        text: "Prompt",
        metadata: { source: "birdhouse" },
      });
      expect(promptParts?.[1]).toEqual({
        type: "file",
        mime: "application/pdf",
        url: "https://example.com/file.pdf",
        filename: "file.pdf",
      });

      return { data: makeMessage("ses_sdk") };
    });

    const message = await harness.sendMessage("ses_sdk", "Prompt", {
      model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
      system: "Birdhouse system prompt",
      agent: "planner",
      metadata: { source: "birdhouse" },
      parts: [
        {
          type: "text",
          text: "Prompt",
          metadata: { source: "birdhouse" },
        },
        {
          type: "file",
          mime: "application/pdf",
          url: "https://example.com/file.pdf",
          filename: "file.pdf",
        },
      ],
    });

    expect(message.info.id).toBe("msg_ses_sdk");
    expect(message.parts[0]).toEqual({ type: "text", text: "Adapter response", metadata: undefined });
  });

  it("returns a placeholder assistant message when OpenCode noReply does not return data", async () => {
    const opencode = createTestOpenCodeClient();
    const harness = new OpenCodeAgentHarness(opencode, "/workspace");

    setMockSessionPrompt(async (options) => {
      expect(options.body?.noReply).toBe(true);
      return { data: undefined as unknown as Message };
    });

    const message = await harness.sendMessage("ses_async", "Prompt", {
      noReply: true,
      model: { providerID: "anthropic", modelID: "claude-haiku-4" },
    });

    expect(message.info.role).toBe("assistant");
    if (message.info.role !== "assistant") {
      throw new Error("Expected assistant placeholder message");
    }
    expect(message.info.sessionID).toBe("ses_async");
    expect(message.info.modelID).toBe("claude-haiku-4");
    expect(message.parts).toEqual([]);
  });

  it("uses the SDK client abort path for abortSession", async () => {
    const opencode = createTestOpenCodeClient();
    let abortCall: unknown;
    opencode.client = {
      session: {
        abort: async (options: unknown) => {
          abortCall = options;
        },
      },
    } as unknown as OpenCodeClient["client"];

    const harness = new OpenCodeAgentHarness(opencode, "/workspace");

    await harness.abortSession("ses_abort");

    expect(abortCall).toEqual({
      path: { id: "ses_abort" },
      query: { directory: "/workspace" },
    });
  });
});
