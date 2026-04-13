// ABOUTME: Wraps the existing OpenCode client behind the Birdhouse AgentHarness contract.
// ABOUTME: Centralizes type mapping and hides raw OpenCode SDK usage from the rest of the server.

import { log } from "../lib/logger";
import type { OpenCodeClient } from "../lib/opencode-client";
import type { AgentHarness, AgentHarnessCapabilities, SendMessageOptions } from "./agent-harness";
import {
  mapBirdhouseInputPartToOpenCodeInputPart,
  mapOpenCodeMessageToBirdhouseMessage,
  mapOpenCodeProvidersResponseToBirdhouseProvidersResponse,
  mapOpenCodeQuestionRequestToBirdhouseQuestionRequest,
  mapOpenCodeSessionStatusMapToBirdhouseSessionStatusMap,
  mapOpenCodeSessionToBirdhouseSession,
  mapOpenCodeSkillToBirdhouseSkill,
} from "./opencode-type-mappers";
import type {
  BirdhouseGenerateOptions,
  BirdhouseMessage,
  BirdhouseProvidersResponse,
  BirdhouseQuestionRequest,
  BirdhouseSession,
  BirdhouseSessionStatusMap,
  BirdhouseSkill,
} from "./types";

function createPlaceholderAssistantMessage(sessionId: string, options?: SendMessageOptions): BirdhouseMessage {
  const now = Date.now();

  return {
    info: {
      id: `msg_opencode_async_${now}`,
      sessionID: sessionId,
      role: "assistant",
      time: { created: now },
      parentID: "msg_opencode_async_user",
      modelID: options?.model?.modelID ?? "unknown",
      providerID: options?.model?.providerID ?? "unknown",
      mode: "build",
      path: {
        cwd: "/",
        root: "/",
      },
    },
    parts: [],
  };
}

function buildPromptParts(text: string, options?: SendMessageOptions) {
  if (options?.parts && options.parts.length > 0) {
    return options.parts.map(mapBirdhouseInputPartToOpenCodeInputPart);
  }

  return [
    mapBirdhouseInputPartToOpenCodeInputPart({
      type: "text",
      text,
      ...(options?.metadata !== undefined ? { metadata: options.metadata } : {}),
    }),
  ];
}

export class OpenCodeAgentHarness implements AgentHarness {
  readonly kind = "opencode";
  readonly capabilities: AgentHarnessCapabilities;

  constructor(
    private readonly opencodeClient: OpenCodeClient,
    private readonly workspaceDirectory: string,
  ) {
    this.capabilities = {
      revert: {
        revertSession: async (sessionId, messageId) => {
          await this.opencodeClient.revertSession(sessionId, messageId);
        },
        unrevertSession: async (sessionId) => {
          await this.opencodeClient.unrevertSession(sessionId);
        },
      },
      skills: {
        listSkills: async (): Promise<BirdhouseSkill[]> => {
          const skills = await this.opencodeClient.listSkills();
          return skills.map(mapOpenCodeSkillToBirdhouseSkill);
        },
        reloadSkills: async () => {
          await this.opencodeClient.reloadSkillState();
        },
      },
      generate: {
        generate: async (options: BirdhouseGenerateOptions) => {
          return this.opencodeClient.generate(options);
        },
      },
      questions: {
        listPendingQuestions: async (): Promise<BirdhouseQuestionRequest[]> => {
          const requests = await this.opencodeClient.listPendingQuestions();
          return requests.map(mapOpenCodeQuestionRequestToBirdhouseQuestionRequest);
        },
        replyToQuestion: async (requestId, answers) => {
          await this.opencodeClient.replyToQuestion(requestId, answers);
        },
      },
    };
  }

  async createSession(title?: string): Promise<BirdhouseSession> {
    return mapOpenCodeSessionToBirdhouseSession(await this.opencodeClient.createSession(title));
  }

  async forkSession(sessionId: string, messageId?: string): Promise<BirdhouseSession> {
    return mapOpenCodeSessionToBirdhouseSession(await this.opencodeClient.forkSession(sessionId, messageId));
  }

  async sendMessage(sessionId: string, text: string, options?: SendMessageOptions): Promise<BirdhouseMessage> {
    const response = await this.opencodeClient.client.session.prompt({
      path: {
        id: sessionId,
      },
      query: {
        directory: this.workspaceDirectory,
      },
      body: {
        parts: buildPromptParts(text, options),
        ...(options?.model !== undefined ? { model: options.model } : {}),
        ...(options?.noReply !== undefined ? { noReply: options.noReply } : {}),
        ...(options?.system !== undefined ? { system: options.system } : {}),
        ...(options?.agent !== undefined ? { agent: options.agent } : {}),
      },
    });

    if (!response.data) {
      log.opencode.debug(
        {
          sessionId,
          noReply: options?.noReply ?? false,
        },
        "SDK returned no response data, using placeholder",
      );
      return createPlaceholderAssistantMessage(sessionId, options);
    }

    return mapOpenCodeMessageToBirdhouseMessage(response.data);
  }

  async getMessages(sessionId: string, limit?: number): Promise<BirdhouseMessage[]> {
    const messages = await this.opencodeClient.getMessages(sessionId, limit);
    return messages.map(mapOpenCodeMessageToBirdhouseMessage);
  }

  async getSession(sessionId: string): Promise<BirdhouseSession> {
    return mapOpenCodeSessionToBirdhouseSession(await this.opencodeClient.getSession(sessionId));
  }

  async getSessionStatus(): Promise<BirdhouseSessionStatusMap> {
    return mapOpenCodeSessionStatusMapToBirdhouseSessionStatusMap(await this.opencodeClient.getSessionStatus());
  }

  async waitForCompletion(sessionId: string): Promise<BirdhouseMessage> {
    return mapOpenCodeMessageToBirdhouseMessage(await this.opencodeClient.waitForSessionCompletion(sessionId));
  }

  async abortSession(sessionId: string): Promise<void> {
    await this.opencodeClient.client.session.abort({
      path: {
        id: sessionId,
      },
      query: {
        directory: this.workspaceDirectory,
      },
    });
  }

  async getProviders(): Promise<BirdhouseProvidersResponse> {
    return mapOpenCodeProvidersResponseToBirdhouseProvidersResponse(await this.opencodeClient.getProviders());
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await this.opencodeClient.updateSessionTitle(sessionId, title);
  }
}
