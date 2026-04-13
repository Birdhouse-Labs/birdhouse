// ABOUTME: Birdhouse-owned harness data contracts for sessions, messages, providers, skills, and questions.
// ABOUTME: Keeps external harness SDK types isolated behind adapter mapping layers.

export interface BirdhouseSessionSummary {
  additions: number;
  deletions: number;
  files: number;
}

export interface BirdhouseSessionRevertState {
  messageID: string;
}

export interface BirdhouseSession {
  id: string;
  projectID: string;
  directory: string;
  parentID?: string;
  title: string;
  version: string;
  time: {
    created: number;
    updated: number;
    compacting?: number;
  };
  summary?: BirdhouseSessionSummary;
  revert?: BirdhouseSessionRevertState;
}

export interface BirdhouseSessionStatus {
  type: "idle" | "busy" | "retry";
}

export type BirdhouseSessionStatusMap = Record<string, BirdhouseSessionStatus>;

export interface BirdhouseModelRef {
  providerID: string;
  modelID: string;
}

export interface BirdhouseProviderModel {
  id: string;
  name: string;
}

export interface BirdhouseProvider {
  id: string;
  name: string;
  models: Record<string, BirdhouseProviderModel>;
}

export interface BirdhouseProvidersResponse {
  providers: BirdhouseProvider[];
}

export interface BirdhouseSkill {
  name: string;
  description: string;
  location: string;
  content: string;
}

export interface BirdhouseQuestionOption {
  label: string;
  description: string;
}

export interface BirdhouseQuestionItem {
  question: string;
  header: string;
  options: BirdhouseQuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

export interface BirdhouseQuestionRequest {
  id: string;
  sessionID: string;
  questions: BirdhouseQuestionItem[];
  tool?: { messageID: string; callID: string };
}

export interface BirdhouseMessageTokens {
  input: number;
  output: number;
  reasoning: number;
  cache: {
    read: number;
    write: number;
  };
}

export interface BirdhouseMessagePath {
  cwd: string;
  root: string;
}

export interface BirdhouseMessageError {
  name: string;
  data?: Record<string, unknown>;
}

export interface BirdhouseMessageSummaryDiff {
  file?: string;
  status?: string;
  additions?: number;
  deletions?: number;
}

export interface BirdhouseMessageSummary {
  diffs?: BirdhouseMessageSummaryDiff[];
}

export type BirdhouseMessageSummaryState = boolean | BirdhouseMessageSummary;

export interface BirdhouseBaseMessageInfo {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  time: {
    created: number;
    completed?: number;
  };
}

export interface BirdhouseUserMessageInfo extends BirdhouseBaseMessageInfo {
  role: "user";
  agent?: string;
  model?: BirdhouseModelRef;
}

export interface BirdhouseAssistantMessageInfo extends BirdhouseBaseMessageInfo {
  role: "assistant";
  parentID: string;
  modelID: string;
  providerID: string;
  mode?: string;
  cost?: number;
  tokens?: BirdhouseMessageTokens;
  path?: BirdhouseMessagePath;
  finish?: string;
  error?: BirdhouseMessageError;
  summary?: BirdhouseMessageSummaryState;
}

export type BirdhouseMessageInfo = BirdhouseUserMessageInfo | BirdhouseAssistantMessageInfo;

export interface BirdhouseBasePart {
  id: string;
  sessionID: string;
  messageID: string;
  time?: Record<string, unknown>;
}

export interface BirdhouseTextPart extends BirdhouseBasePart {
  type: "text";
  text: string;
  metadata?: Record<string, unknown>;
  time?: {
    start: number;
    end?: number;
  };
}

export interface BirdhouseReasoningPart extends BirdhouseBasePart {
  type: "reasoning";
  text: string;
  time?: {
    start: number;
    end?: number;
  };
}

export interface BirdhouseToolPart extends BirdhouseBasePart {
  type: "tool";
  tool?: string;
  callID?: string;
  state?: Record<string, unknown>;
  summary?: string;
  time?: {
    start: number;
    end?: number;
  };
}

export interface BirdhouseFilePart extends BirdhouseBasePart {
  type: "file";
  mime: string;
  url: string;
  filename?: string;
}

export interface BirdhousePatchPart extends BirdhouseBasePart {
  type: "patch";
  text?: string;
  time?: {
    start: number;
    end?: number;
  };
}

export interface BirdhouseUnknownPart extends BirdhouseBasePart {
  type: string;
  [key: string]: unknown;
}

export type BirdhousePart =
  | BirdhouseTextPart
  | BirdhouseReasoningPart
  | BirdhouseToolPart
  | BirdhouseFilePart
  | BirdhousePatchPart
  | BirdhouseUnknownPart;

export interface BirdhouseMessage {
  info: BirdhouseMessageInfo;
  parts: BirdhousePart[];
}

export interface BirdhouseInputTextPart {
  type: "text";
  text: string;
  metadata?: Record<string, unknown>;
}

export interface BirdhouseInputFilePart {
  type: "file";
  mime: string;
  url: string;
  filename?: string;
}

export interface BirdhouseInputUnknownPart {
  type: string;
  [key: string]: unknown;
}

export type BirdhouseInputPart = BirdhouseInputTextPart | BirdhouseInputFilePart | BirdhouseInputUnknownPart;

export interface BirdhouseGenerateOptions {
  prompt?: string;
  system?: string[];
  message: string;
  small?: boolean;
  maxTokens?: number;
}
