// ABOUTME: Tests OpenCode-to-Birdhouse type mappers used at the harness adapter boundary.
// ABOUTME: Verifies sessions, messages, parts, and request/response payloads map cleanly.

import { describe, expect, it } from "bun:test";
import type { AssistantMessage, FilePartInput, Part, TextPartInput, UserMessage } from "@opencode-ai/sdk/client";
import {
  mapBirdhouseInputPartToOpenCodeInputPart,
  mapBirdhouseProvidersResponseToOpenCodeProvidersResponse,
  mapOpenCodeMessageToBirdhouseMessage,
  mapOpenCodeProvidersResponseToBirdhouseProvidersResponse,
  mapOpenCodeQuestionRequestToBirdhouseQuestionRequest,
  mapOpenCodeSessionToBirdhouseSession,
  mapOpenCodeSkillToBirdhouseSkill,
} from "./opencode-type-mappers";

describe("opencode type mappers", () => {
  it("maps an OpenCode session to a Birdhouse session", () => {
    const session = mapOpenCodeSessionToBirdhouseSession({
      id: "ses_1",
      projectID: "project_1",
      directory: "/workspace",
      parentID: "ses_parent",
      title: "Agent Session",
      version: "1.2.3",
      time: {
        created: 100,
        updated: 200,
        compacting: 300,
      },
      summary: {
        additions: 1,
        deletions: 2,
        files: 3,
      },
      revert: {
        messageID: "msg_1",
      },
    });

    expect(session).toEqual({
      id: "ses_1",
      projectID: "project_1",
      directory: "/workspace",
      parentID: "ses_parent",
      title: "Agent Session",
      version: "1.2.3",
      time: {
        created: 100,
        updated: 200,
        compacting: 300,
      },
      summary: {
        additions: 1,
        deletions: 2,
        files: 3,
      },
      revert: {
        messageID: "msg_1",
      },
    });
  });

  it("maps an OpenCode assistant message and preserves supported part types", () => {
    const info = {
      id: "msg_assistant",
      sessionID: "ses_1",
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
        reasoning: 1,
        cache: { read: 0, write: 0 },
      },
      path: { cwd: "/workspace", root: "/workspace" },
      finish: "stop",
      summary: {
        diffs: [{ file: "src/index.ts", status: "modified", additions: 3, deletions: 1 }],
      },
      error: { name: "UnknownError", data: { message: "Tool failed" } },
    } as unknown as AssistantMessage;
    const parts: Part[] = [
      {
        id: "part_text",
        sessionID: "ses_1",
        messageID: "msg_assistant",
        type: "text",
        text: "Hello",
        metadata: { source: "birdhouse" },
      } as unknown as Part,
      {
        id: "part_reasoning",
        sessionID: "ses_1",
        messageID: "msg_assistant",
        type: "reasoning",
        text: "Thinking",
        time: { start: 105, end: 110 },
      } as Part,
      {
        id: "part_tool",
        sessionID: "ses_1",
        messageID: "msg_assistant",
        type: "tool",
        tool: "bash",
        callID: "call_1",
        state: { status: "completed" },
        summary: "Run bash",
      } as unknown as Part,
      {
        id: "part_file",
        sessionID: "ses_1",
        messageID: "msg_assistant",
        type: "file",
        mime: "image/png",
        url: "https://example.com/image.png",
        filename: "image.png",
      } as Part,
      {
        id: "part_patch",
        sessionID: "ses_1",
        messageID: "msg_assistant",
        hash: "patch_hash",
        files: [],
        type: "patch",
        text: "diff --git a/file b/file",
      } as unknown as Part,
      {
        id: "part_step_start",
        sessionID: "ses_1",
        messageID: "msg_assistant",
        type: "step-start",
        foo: "bar",
      } as unknown as Part,
    ];

    const message = mapOpenCodeMessageToBirdhouseMessage({ info, parts });

    expect(message.info).toEqual({
      id: "msg_assistant",
      sessionID: "ses_1",
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
        reasoning: 1,
        cache: { read: 0, write: 0 },
      },
      path: { cwd: "/workspace", root: "/workspace" },
      finish: "stop",
      summary: {
        diffs: [{ file: "src/index.ts", status: "modified", additions: 3, deletions: 1 }],
      },
      error: { name: "UnknownError", data: { message: "Tool failed" } },
    });
    expect(message.parts).toEqual([
      {
        id: "part_text",
        sessionID: "ses_1",
        messageID: "msg_assistant",
        type: "text",
        text: "Hello",
        metadata: { source: "birdhouse" },
      },
      {
        id: "part_reasoning",
        sessionID: "ses_1",
        messageID: "msg_assistant",
        type: "reasoning",
        text: "Thinking",
        time: { start: 105, end: 110 },
      },
      {
        id: "part_tool",
        sessionID: "ses_1",
        messageID: "msg_assistant",
        type: "tool",
        tool: "bash",
        callID: "call_1",
        state: { status: "completed" },
        summary: "Run bash",
      },
      {
        id: "part_file",
        sessionID: "ses_1",
        messageID: "msg_assistant",
        type: "file",
        mime: "image/png",
        url: "https://example.com/image.png",
        filename: "image.png",
      },
      {
        id: "part_patch",
        sessionID: "ses_1",
        messageID: "msg_assistant",
        type: "patch",
        text: "diff --git a/file b/file",
      },
      {
        type: "step-start",
        foo: "bar",
        id: "part_step_start",
        sessionID: "ses_1",
        messageID: "msg_assistant",
      },
    ]);
  });

  it("maps an OpenCode user message to a Birdhouse message", () => {
    const info: UserMessage = {
      id: "msg_user",
      sessionID: "ses_1",
      role: "user",
      time: { created: 100 },
      agent: "planner",
      model: { providerID: "anthropic", modelID: "claude-haiku-4" },
    };

    const message = mapOpenCodeMessageToBirdhouseMessage({
      info,
      parts: [
        {
          id: "part_user_text",
          sessionID: "ses_1",
          messageID: "msg_user",
          type: "text",
          text: "Please help",
        } as Part,
      ],
    });

    expect(message.info).toEqual(info);
    expect(message.parts).toEqual([
      {
        id: "part_user_text",
        sessionID: "ses_1",
        messageID: "msg_user",
        type: "text",
        text: "Please help",
        metadata: undefined,
      },
    ]);
  });

  it("maps Birdhouse input parts to OpenCode input parts", () => {
    const textPart = mapBirdhouseInputPartToOpenCodeInputPart({
      type: "text",
      text: "Prompt",
      metadata: { source: "birdhouse" },
    });
    const filePart = mapBirdhouseInputPartToOpenCodeInputPart({
      type: "file",
      mime: "application/pdf",
      url: "https://example.com/file.pdf",
      filename: "file.pdf",
    });

    expect(textPart).toEqual({
      type: "text",
      text: "Prompt",
      metadata: { source: "birdhouse" },
    } satisfies TextPartInput);
    expect(filePart).toEqual({
      type: "file",
      mime: "application/pdf",
      url: "https://example.com/file.pdf",
      filename: "file.pdf",
    } satisfies FilePartInput);
  });

  it("throws when mapping an unsupported Birdhouse input part to OpenCode", () => {
    expect(() =>
      mapBirdhouseInputPartToOpenCodeInputPart({
        type: "custom-tool-input",
        payload: "value",
      }),
    ).toThrow("Unsupported OpenCode input part type: custom-tool-input");
  });

  it("maps providers, skills, and questions between OpenCode and Birdhouse shapes", () => {
    const providers = {
      providers: [
        {
          id: "anthropic",
          name: "Anthropic",
          models: {
            "claude-sonnet-4": {
              id: "claude-sonnet-4",
              name: "Claude Sonnet 4",
            },
          },
        },
      ],
    };

    expect(mapOpenCodeProvidersResponseToBirdhouseProvidersResponse(providers)).toEqual(providers);
    expect(mapBirdhouseProvidersResponseToOpenCodeProvidersResponse(providers)).toEqual(providers);

    const skill = {
      name: "find-docs",
      description: "Retrieve docs",
      location: "/skills/find-docs",
      content: "# Find Docs",
    };
    expect(mapOpenCodeSkillToBirdhouseSkill(skill)).toEqual(skill);

    const question = {
      id: "question_1",
      sessionID: "ses_1",
      questions: [
        {
          question: "Choose one",
          header: "Question",
          options: [{ label: "Yes", description: "Approve" }],
          multiple: true,
          custom: true,
        },
      ],
      tool: { messageID: "msg_1", callID: "call_1" },
    };
    expect(mapOpenCodeQuestionRequestToBirdhouseQuestionRequest(question)).toEqual(question);
  });

  it("preserves model limit through OpenCode-to-Birdhouse provider mapping", () => {
    const withLimit = {
      providers: [
        {
          id: "anthropic",
          name: "Anthropic",
          models: {
            "claude-sonnet-4-6": {
              id: "claude-sonnet-4-6",
              name: "Claude Sonnet 4.6",
              limit: { context: 200_000, output: 64_000 },
            },
          },
        },
      ],
    };

    const mapped = mapOpenCodeProvidersResponseToBirdhouseProvidersResponse(withLimit);
    expect(mapped.providers[0].models["claude-sonnet-4-6"].limit).toEqual({ context: 200_000, output: 64_000 });
  });

  it("omits limit when not present in OpenCode provider model", () => {
    const withoutLimit = {
      providers: [
        {
          id: "custom",
          name: "Custom",
          models: {
            "some-model": { id: "some-model", name: "Some Model" },
          },
        },
      ],
    };

    const mapped = mapOpenCodeProvidersResponseToBirdhouseProvidersResponse(withoutLimit);
    expect(mapped.providers[0].models["some-model"].limit).toBeUndefined();
  });
});
