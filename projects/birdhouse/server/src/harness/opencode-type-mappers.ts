// ABOUTME: Maps OpenCode-native session, message, provider, skill, and question shapes to Birdhouse-owned types.
// ABOUTME: Keeps OpenCode SDK types isolated at the adapter boundary and centralizes part conversion logic.

import type { AssistantMessage, FilePartInput, Part, TextPartInput, UserMessage } from "@opencode-ai/sdk/client";
import type {
  Message as OpenCodeMessage,
  ProvidersResponse as OpenCodeProvidersResponse,
  QuestionRequest as OpenCodeQuestionRequest,
  Session as OpenCodeSession,
  SessionStatusMap as OpenCodeSessionStatusMap,
  Skill as OpenCodeSkill,
} from "../lib/opencode-client";
import type {
  BirdhouseInputPart,
  BirdhouseMessage,
  BirdhouseMessageInfo,
  BirdhousePart,
  BirdhouseProvidersResponse,
  BirdhouseQuestionRequest,
  BirdhouseSession,
  BirdhouseSessionStatusMap,
  BirdhouseSkill,
} from "./types";

function mapOpenCodePartBaseToBirdhousePart(part: Part) {
  return {
    id: part.id,
    sessionID: part.sessionID,
    messageID: part.messageID,
  };
}

function clonePartTime(part: Part): Record<string, unknown> | undefined {
  if (!("time" in part) || part.time === undefined || part.time === null || typeof part.time !== "object") {
    return undefined;
  }

  return structuredClone(part.time as Record<string, unknown>);
}

function mapOpenCodeMessageInfoToBirdhouseMessageInfo(info: UserMessage | AssistantMessage): BirdhouseMessageInfo {
  if (info.role === "user") {
    return {
      id: info.id,
      sessionID: info.sessionID,
      role: info.role,
      time: {
        created: info.time.created,
      },
      ...(info.agent !== undefined ? { agent: info.agent } : {}),
      ...(info.model !== undefined ? { model: { ...info.model } } : {}),
    };
  }

  const assistantInfo = info as AssistantMessage & { summary?: unknown };

  return {
    id: assistantInfo.id,
    sessionID: assistantInfo.sessionID,
    role: assistantInfo.role,
    time: {
      created: assistantInfo.time.created,
      ...(assistantInfo.time.completed !== undefined ? { completed: assistantInfo.time.completed } : {}),
    },
    parentID: assistantInfo.parentID,
    modelID: assistantInfo.modelID,
    providerID: assistantInfo.providerID,
    ...(assistantInfo.mode !== undefined ? { mode: assistantInfo.mode } : {}),
    ...(assistantInfo.cost !== undefined ? { cost: assistantInfo.cost } : {}),
    ...(assistantInfo.tokens !== undefined
      ? {
          tokens: {
            input: assistantInfo.tokens.input,
            output: assistantInfo.tokens.output,
            reasoning: assistantInfo.tokens.reasoning,
            cache: {
              read: assistantInfo.tokens.cache.read,
              write: assistantInfo.tokens.cache.write,
            },
          },
        }
      : {}),
    ...(assistantInfo.path !== undefined
      ? {
          path: {
            cwd: assistantInfo.path.cwd,
            root: assistantInfo.path.root,
          },
        }
      : {}),
    ...(assistantInfo.finish !== undefined ? { finish: assistantInfo.finish } : {}),
    ...(assistantInfo.error !== undefined
      ? {
          error: {
            name: assistantInfo.error.name,
            ...(assistantInfo.error.data !== undefined ? { data: { ...assistantInfo.error.data } } : {}),
          },
        }
      : {}),
    ...(assistantInfo.summary !== undefined
      ? {
          summary:
            typeof assistantInfo.summary === "object" && assistantInfo.summary !== null
              ? structuredClone(assistantInfo.summary)
              : assistantInfo.summary,
        }
      : {}),
  };
}

export function mapOpenCodePartToBirdhousePart(part: Part): BirdhousePart {
  if (part.type === "text") {
    const metadata = part.metadata;
    const time = clonePartTime(part);

    return {
      ...mapOpenCodePartBaseToBirdhousePart(part),
      type: "text",
      text: part.text,
      ...(typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
        ? { metadata: metadata as Record<string, unknown> }
        : {}),
      ...(time !== undefined ? { time: time as { start: number; end?: number } } : {}),
    };
  }

  if (part.type === "reasoning") {
    const time = clonePartTime(part);

    return {
      ...mapOpenCodePartBaseToBirdhousePart(part),
      type: "reasoning",
      text: part.text,
      ...(time !== undefined ? { time: time as { start: number; end?: number } } : {}),
    };
  }

  if (part.type === "tool") {
    const toolPart = part as unknown as { summary?: string };
    const time = clonePartTime(part);

    return {
      ...mapOpenCodePartBaseToBirdhousePart(part),
      type: "tool",
      ...(part.tool !== undefined ? { tool: part.tool } : {}),
      ...(part.callID !== undefined ? { callID: part.callID } : {}),
      ...(part.state !== undefined ? { state: structuredClone(part.state) } : {}),
      ...(toolPart.summary !== undefined ? { summary: toolPart.summary } : {}),
      ...(time !== undefined ? { time: time as { start: number; end?: number } } : {}),
    };
  }

  if (part.type === "file") {
    const time = clonePartTime(part);

    return {
      ...mapOpenCodePartBaseToBirdhousePart(part),
      type: "file",
      mime: part.mime,
      url: part.url,
      ...(part.filename !== undefined ? { filename: part.filename } : {}),
      ...(time !== undefined ? { time } : {}),
    };
  }

  if (part.type === "patch") {
    const time = clonePartTime(part);

    return {
      ...mapOpenCodePartBaseToBirdhousePart(part),
      type: "patch",
      ...("text" in part && typeof part.text === "string" ? { text: part.text } : {}),
      ...(time !== undefined ? { time: time as { start: number; end?: number } } : {}),
    };
  }

  return structuredClone(part) as unknown as BirdhousePart;
}

export function mapOpenCodeMessageToBirdhouseMessage(message: OpenCodeMessage): BirdhouseMessage {
  return {
    info: mapOpenCodeMessageInfoToBirdhouseMessageInfo(message.info),
    parts: message.parts.map(mapOpenCodePartToBirdhousePart),
  };
}

export function mapOpenCodeSessionToBirdhouseSession(session: OpenCodeSession): BirdhouseSession {
  return {
    id: session.id,
    projectID: session.projectID,
    directory: session.directory,
    ...(session.parentID !== undefined ? { parentID: session.parentID } : {}),
    title: session.title,
    version: session.version,
    time: {
      created: session.time.created,
      updated: session.time.updated,
      ...(session.time.compacting !== undefined ? { compacting: session.time.compacting } : {}),
    },
    ...(session.summary !== undefined
      ? {
          summary: {
            additions: session.summary.additions,
            deletions: session.summary.deletions,
            files: session.summary.files,
          },
        }
      : {}),
    ...(session.revert !== undefined ? { revert: { messageID: session.revert.messageID } } : {}),
  };
}

export function mapOpenCodeSessionStatusMapToBirdhouseSessionStatusMap(
  statusMap: OpenCodeSessionStatusMap,
): BirdhouseSessionStatusMap {
  return Object.fromEntries(Object.entries(statusMap).map(([sessionId, status]) => [sessionId, { type: status.type }]));
}

export function mapOpenCodeProvidersResponseToBirdhouseProvidersResponse(
  response: OpenCodeProvidersResponse,
): BirdhouseProvidersResponse {
  return {
    providers: response.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      models: Object.fromEntries(
        Object.entries(provider.models).map(([key, model]) => [
          key,
          {
            id: model.id,
            name: model.name,
            ...(model.limit !== undefined
              ? { limit: { context: model.limit.context, output: model.limit.output } }
              : {}),
          },
        ]),
      ),
    })),
  };
}

export function mapBirdhouseProvidersResponseToOpenCodeProvidersResponse(
  response: BirdhouseProvidersResponse,
): OpenCodeProvidersResponse {
  return {
    providers: response.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      models: Object.fromEntries(
        Object.entries(provider.models).map(([key, model]) => [key, { id: model.id, name: model.name }]),
      ),
    })),
  };
}

export function mapOpenCodeSkillToBirdhouseSkill(skill: OpenCodeSkill): BirdhouseSkill {
  return {
    name: skill.name,
    description: skill.description,
    location: skill.location,
    content: skill.content,
  };
}

export function mapOpenCodeQuestionRequestToBirdhouseQuestionRequest(
  request: OpenCodeQuestionRequest,
): BirdhouseQuestionRequest {
  return {
    id: request.id,
    sessionID: request.sessionID,
    questions: request.questions.map((question) => ({
      question: question.question,
      header: question.header,
      options: question.options.map((option) => ({
        label: option.label,
        description: option.description,
      })),
      ...(question.multiple !== undefined ? { multiple: question.multiple } : {}),
      ...(question.custom !== undefined ? { custom: question.custom } : {}),
    })),
    ...(request.tool !== undefined
      ? {
          tool: {
            messageID: request.tool.messageID,
            callID: request.tool.callID,
          },
        }
      : {}),
  };
}

export function mapBirdhouseInputPartToOpenCodeInputPart(part: BirdhouseInputPart): TextPartInput | FilePartInput {
  if (part.type === "text" && typeof part.text === "string") {
    const metadata = part.metadata;

    return {
      type: "text",
      text: part.text,
      ...(typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
        ? { metadata: metadata as Record<string, unknown> }
        : {}),
    };
  }

  if (part.type === "file" && typeof part.mime === "string" && typeof part.url === "string") {
    return {
      type: "file",
      mime: part.mime,
      url: part.url,
      ...(typeof part.filename === "string" ? { filename: part.filename } : {}),
    };
  }

  throw new Error(`Unsupported OpenCode input part type: ${part.type}`);
}
