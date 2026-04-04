// ABOUTME: Public entrypoint for Birdhouse harness abstractions, adapters, and owned types.
// ABOUTME: Gives the rest of the server a single import boundary for harness contracts and test helpers.

export type {
  AgentHarness,
  AgentHarnessCapabilities,
  HarnessGenerateCapability,
  HarnessQuestionsCapability,
  HarnessRevertCapability,
  HarnessSkillsCapability,
  SendMessageOptions,
} from "./agent-harness";
export type { BirdhouseEvent, HarnessEvent, HarnessEventStream, HarnessEventType } from "./harness-events";
export type { HarnessHealth, HarnessLifecycle, HarnessRuntimeStatus, HarnessStartOptions } from "./harness-lifecycle";
export { OpenCodeAgentHarness } from "./opencode-adapter";
export { OpenCodeHarnessEventStream } from "./opencode-event-adapter";
export type { TestAgentHarness, TestHarnessEventStream } from "./test-harness";
export { createTestAgentHarness, createTestHarnessEventStream } from "./test-harness";
export type { BirdhouseToolDefinition, ToolRegistrar, ToolRegistrationOptions } from "./tool-registrar";
export type {
  BirdhouseAssistantMessageInfo,
  BirdhouseBaseMessageInfo,
  BirdhouseFilePart,
  BirdhouseGenerateOptions,
  BirdhouseInputFilePart,
  BirdhouseInputPart,
  BirdhouseInputTextPart,
  BirdhouseInputUnknownPart,
  BirdhouseMessage,
  BirdhouseMessageError,
  BirdhouseMessageInfo,
  BirdhouseMessagePath,
  BirdhouseMessageSummary,
  BirdhouseMessageSummaryDiff,
  BirdhouseMessageSummaryState,
  BirdhouseMessageTokens,
  BirdhouseModelRef,
  BirdhousePart,
  BirdhousePatchPart,
  BirdhouseProvider,
  BirdhouseProviderModel,
  BirdhouseProvidersResponse,
  BirdhouseQuestionItem,
  BirdhouseQuestionOption,
  BirdhouseQuestionRequest,
  BirdhouseReasoningPart,
  BirdhouseSession,
  BirdhouseSessionRevertState,
  BirdhouseSessionStatus,
  BirdhouseSessionStatusMap,
  BirdhouseSessionSummary,
  BirdhouseSkill,
  BirdhouseTextPart,
  BirdhouseToolPart,
  BirdhouseUnknownPart,
  BirdhouseUserMessageInfo,
} from "./types";
