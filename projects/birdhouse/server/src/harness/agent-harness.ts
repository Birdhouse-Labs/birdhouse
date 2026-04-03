// ABOUTME: Core Birdhouse harness contract with required methods and optional capability groups.
// ABOUTME: Hides harness-native SDK clients so the rest of the server only depends on Birdhouse-owned types.

import type {
  BirdhouseGenerateOptions,
  BirdhouseInputPart,
  BirdhouseMessage,
  BirdhouseModelRef,
  BirdhouseProvidersResponse,
  BirdhouseQuestionRequest,
  BirdhouseSession,
  BirdhouseSessionStatusMap,
  BirdhouseSkill,
} from "./types";

export interface SendMessageOptions {
  model?: BirdhouseModelRef;
  noReply?: boolean;
  system?: string;
  agent?: string;
  metadata?: Record<string, unknown>;
  parts?: BirdhouseInputPart[];
}

export interface HarnessRevertCapability {
  revertSession(sessionId: string, messageId: string): Promise<void>;
  unrevertSession(sessionId: string): Promise<void>;
}

export interface HarnessSkillsCapability {
  listSkills(): Promise<BirdhouseSkill[]>;
  reloadSkills(): Promise<void>;
}

export interface HarnessGenerateCapability {
  generate(options: BirdhouseGenerateOptions): Promise<string>;
}

export interface HarnessQuestionsCapability {
  listPendingQuestions(): Promise<BirdhouseQuestionRequest[]>;
  replyToQuestion(requestId: string, answers: string[][]): Promise<void>;
}

export interface AgentHarnessCapabilities {
  revert?: HarnessRevertCapability;
  skills?: HarnessSkillsCapability;
  generate?: HarnessGenerateCapability;
  questions?: HarnessQuestionsCapability;
}

export interface AgentHarness {
  kind: string;
  capabilities: AgentHarnessCapabilities;
  createSession(title?: string): Promise<BirdhouseSession>;
  forkSession(sessionId: string, messageId?: string): Promise<BirdhouseSession>;
  sendMessage(sessionId: string, text: string, options?: SendMessageOptions): Promise<BirdhouseMessage>;
  getMessages(sessionId: string, limit?: number): Promise<BirdhouseMessage[]>;
  getSession(sessionId: string): Promise<BirdhouseSession>;
  getSessionStatus(): Promise<BirdhouseSessionStatusMap>;
  waitForCompletion(sessionId: string): Promise<BirdhouseMessage>;
  abortSession(sessionId: string): Promise<void>;
  getProviders(): Promise<BirdhouseProvidersResponse>;
  updateSessionTitle(sessionId: string, title: string): Promise<void>;
}
