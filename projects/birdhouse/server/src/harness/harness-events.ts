// ABOUTME: Standardized runtime event contracts emitted by harness adapters for Birdhouse consumption.
// ABOUTME: Keeps harness-originated events transport-agnostic so adapters can map from SSE or in-process streams.

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
