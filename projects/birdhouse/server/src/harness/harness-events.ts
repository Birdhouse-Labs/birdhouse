// ABOUTME: Standardized runtime event contracts emitted by harness adapters for Birdhouse consumption.
// ABOUTME: Keeps harness-originated events transport-agnostic so adapters can map from SSE or in-process streams.

import type {
  BirdhouseMessageError,
  BirdhouseMessageInfo,
  BirdhousePart,
  BirdhouseQuestionRequest,
  BirdhouseSessionStatus,
} from "./types";

export type HarnessEventType =
  | "message.updated"
  | "message.removed"
  | "message.part.updated"
  | "message.part.delta"
  | "question.asked"
  | "permission.asked"
  | "permission.replied"
  | "session.created"
  | "session.updated"
  | "session.deleted"
  | "session.idle"
  | "session.error"
  | "session.status"
  | "session.compacted"
  | "session.diff"
  | "todo.updated"
  | (string & {});

export interface FrontendConsumedHarnessEventProperties {
  "message.updated": { info: BirdhouseMessageInfo };
  "session.updated": { info: Record<string, unknown> };
  "message.removed": { messageID: string; sessionID?: string };
  "message.part.updated": { part: BirdhousePart };
  "message.part.delta": {
    sessionID: string;
    messageID: string;
    partID: string;
    field: string;
    delta: string;
  };
  "session.idle": { sessionID: string };
  "session.error": { sessionID?: string; error: BirdhouseMessageError };
  "session.created": { info: { id: string; title: string } };
  "session.status": { sessionID: string; status: BirdhouseSessionStatus };
  "question.asked": Pick<BirdhouseQuestionRequest, "id" | "sessionID" | "questions" | "tool">;
}

export type FrontendConsumedHarnessEventType = keyof FrontendConsumedHarnessEventProperties;

export interface BirdhouseEvent {
  type: string;
  properties: Record<string, unknown>;
}

export interface HarnessEventEnvelope {
  type: HarnessEventType;
  sessionID?: string;
  directory?: string;
  properties: Record<string, unknown>;
}

export type HarnessEvent = HarnessEventEnvelope;

export interface HarnessEventStream {
  subscribe(listener: (event: HarnessEvent) => void | Promise<void>): () => void;
  close?(): void | Promise<void>;
}

const FRONTEND_CONSUMED_HARNESS_EVENT_TYPES = new Set<FrontendConsumedHarnessEventType>([
  "message.updated",
  "session.updated",
  "message.removed",
  "message.part.updated",
  "message.part.delta",
  "session.idle",
  "session.error",
  "session.created",
  "session.status",
  "question.asked",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "string";
}

function hasKnownSessionStatus(value: unknown): value is BirdhouseSessionStatus {
  return isRecord(value) && (value.type === "idle" || value.type === "busy" || value.type === "retry");
}

function hasMessageInfo(value: unknown): value is BirdhouseMessageInfo {
  return (
    isRecord(value) &&
    hasString(value, "id") &&
    hasString(value, "sessionID") &&
    (value.role === "user" || value.role === "assistant")
  );
}

function hasPartIdentity(value: unknown): value is BirdhousePart {
  return (
    isRecord(value) &&
    hasString(value, "id") &&
    hasString(value, "sessionID") &&
    hasString(value, "messageID") &&
    hasString(value, "type")
  );
}

function hasMessageError(value: unknown): value is BirdhouseMessageError {
  return isRecord(value) && hasString(value, "name");
}

function hasQuestionRequestShape(value: unknown): value is FrontendConsumedHarnessEventProperties["question.asked"] {
  return (
    isRecord(value) &&
    hasString(value, "id") &&
    Array.isArray(value.questions) &&
    (value.sessionID === undefined || typeof value.sessionID === "string")
  );
}

export function isFrontendConsumedHarnessEventType(type: string): type is FrontendConsumedHarnessEventType {
  return FRONTEND_CONSUMED_HARNESS_EVENT_TYPES.has(type as FrontendConsumedHarnessEventType);
}

export function hasValidFrontendConsumedHarnessEventProperties(event: HarnessEvent): boolean {
  if (!isFrontendConsumedHarnessEventType(event.type)) {
    return true;
  }

  const { properties } = event;

  switch (event.type) {
    case "message.updated":
      return hasMessageInfo(properties.info);
    case "session.updated":
      return isRecord(properties.info);
    case "message.removed":
      return hasString(properties, "messageID");
    case "message.part.updated":
      return hasPartIdentity(properties.part);
    case "message.part.delta":
      return (
        hasString(properties, "sessionID") &&
        hasString(properties, "messageID") &&
        hasString(properties, "partID") &&
        hasString(properties, "field") &&
        hasString(properties, "delta")
      );
    case "session.idle":
      return hasString(properties, "sessionID");
    case "session.error":
      return hasMessageError(properties.error);
    case "session.created":
      return isRecord(properties.info) && hasString(properties.info, "id") && hasString(properties.info, "title");
    case "session.status":
      return hasString(properties, "sessionID") && hasKnownSessionStatus(properties.status);
    case "question.asked":
      return hasQuestionRequestShape(properties);
  }
}
