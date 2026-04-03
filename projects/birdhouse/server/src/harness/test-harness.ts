// ABOUTME: In-memory harness fake and event stream for testing Birdhouse against the harness boundary.
// ABOUTME: Provides stateful session/message behavior, seed helpers, and opt-in optional capabilities.

import type {
  AgentHarness,
  AgentHarnessCapabilities,
  HarnessGenerateCapability,
  HarnessQuestionsCapability,
  HarnessRevertCapability,
  HarnessSkillsCapability,
  SendMessageOptions,
} from "./agent-harness";
import type { HarnessEvent, HarnessEventStream } from "./harness-events";
import type {
  BirdhouseGenerateOptions,
  BirdhouseMessage,
  BirdhouseProvidersResponse,
  BirdhouseQuestionRequest,
  BirdhouseSession,
  BirdhouseSessionStatus,
  BirdhouseSessionStatusMap,
  BirdhouseSkill,
} from "./types";

interface TestAgentHarnessOptions {
  providers?: BirdhouseProvidersResponse;
  skills?: BirdhouseSkill[];
  questionRequests?: BirdhouseQuestionRequest[];
  generatedText?: string;
  enableRevert?: boolean;
  enableSkills?: boolean;
  enableGenerate?: boolean;
  enableQuestions?: boolean;
}

interface RecordedSendMessageCall {
  sessionId: string;
  text: string;
  options?: SendMessageOptions;
}

interface RecordedReplyToQuestionCall {
  requestId: string;
  answers: string[][];
}

interface RecordedRevertSessionCall {
  sessionId: string;
  messageId: string;
}

export interface TestAgentHarness extends AgentHarness {
  recorded: {
    sendMessageCalls: RecordedSendMessageCall[];
    abortSessionCalls: string[];
    revertSessionCalls: RecordedRevertSessionCall[];
    unrevertSessionCalls: string[];
    replyToQuestionCalls: RecordedReplyToQuestionCall[];
    reloadSkillsCalls: number;
    generateCalls: BirdhouseGenerateOptions[];
  };
  seedSession(session: BirdhouseSession): void;
  seedMessages(sessionId: string, messages: BirdhouseMessage[]): void;
  seedSessionStatus(sessionId: string, status: BirdhouseSessionStatus): void;
  seedCompletion(sessionId: string, message: BirdhouseMessage): void;
}

export interface TestHarnessEventStream extends HarnessEventStream {
  emit(event: HarnessEvent): void;
}

let sessionCounter = 0;
let messageCounter = 0;
let partCounter = 0;

function nextSessionId(): string {
  sessionCounter += 1;
  return `ses_test_${sessionCounter}`;
}

function nextMessageId(): string {
  messageCounter += 1;
  return `msg_test_${messageCounter}`;
}

function nextPartId(): string {
  partCounter += 1;
  return `part_test_${partCounter}`;
}

function cloneMessage(message: BirdhouseMessage): BirdhouseMessage {
  return {
    info: { ...message.info },
    parts: message.parts.map((part) => ({ ...part })),
  };
}

function createAssistantMessage(sessionId: string, text: string, options?: SendMessageOptions): BirdhouseMessage {
  const now = Date.now();
  const messageId = nextMessageId();

  return {
    info: {
      id: messageId,
      sessionID: sessionId,
      role: "assistant",
      time: { created: now, completed: now },
      parentID: "msg_user",
      modelID: options?.model?.modelID ?? "claude-sonnet-4",
      providerID: options?.model?.providerID ?? "anthropic",
      mode: "build",
      cost: 0,
      tokens: {
        input: 100,
        output: 50,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      path: {
        cwd: "/",
        root: "/",
      },
      finish: "stop",
    },
    parts: options?.parts?.map((part) => ({ ...part })) ?? [
      {
        type: "text",
        text,
        id: nextPartId(),
        sessionID: sessionId,
        messageID: messageId,
      },
    ],
  };
}

export function createTestHarnessEventStream(): TestHarnessEventStream {
  const listeners = new Set<(event: HarnessEvent) => void | Promise<void>>();

  return {
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    emit(event) {
      for (const listener of listeners) {
        void listener(event);
      }
    },
    close() {
      listeners.clear();
    },
  };
}

export function createTestAgentHarness(options: TestAgentHarnessOptions = {}): TestAgentHarness {
  const sessions = new Map<string, BirdhouseSession>();
  const messages = new Map<string, BirdhouseMessage[]>();
  const statuses = new Map<string, BirdhouseSessionStatus>();
  const completions = new Map<string, BirdhouseMessage>();

  const recorded = {
    sendMessageCalls: [] as RecordedSendMessageCall[],
    abortSessionCalls: [] as string[],
    revertSessionCalls: [] as RecordedRevertSessionCall[],
    unrevertSessionCalls: [] as string[],
    replyToQuestionCalls: [] as RecordedReplyToQuestionCall[],
    reloadSkillsCalls: 0,
    generateCalls: [] as BirdhouseGenerateOptions[],
  };

  const revertCapability: HarnessRevertCapability | undefined = options.enableRevert
    ? {
        async revertSession(sessionId, messageId) {
          recorded.revertSessionCalls.push({ sessionId, messageId });
        },
        async unrevertSession(sessionId) {
          recorded.unrevertSessionCalls.push(sessionId);
        },
      }
    : undefined;

  const skillsCapability: HarnessSkillsCapability | undefined = options.enableSkills
    ? {
        async listSkills() {
          return options.skills ? [...options.skills] : [];
        },
        async reloadSkills() {
          recorded.reloadSkillsCalls += 1;
        },
      }
    : undefined;

  const generateCapability: HarnessGenerateCapability | undefined = options.enableGenerate
    ? {
        async generate(generateOptions) {
          recorded.generateCalls.push(generateOptions);
          return options.generatedText ?? "Generated text";
        },
      }
    : undefined;

  const questionsCapability: HarnessQuestionsCapability | undefined = options.enableQuestions
    ? {
        async listPendingQuestions() {
          return options.questionRequests ? [...options.questionRequests] : [];
        },
        async replyToQuestion(requestId, answers) {
          recorded.replyToQuestionCalls.push({ requestId, answers });
        },
      }
    : undefined;

  const capabilities: AgentHarnessCapabilities = {
    revert: revertCapability,
    skills: skillsCapability,
    generate: generateCapability,
    questions: questionsCapability,
  };

  const harness: TestAgentHarness = {
    kind: "test",
    capabilities,
    recorded,
    async createSession(title) {
      const now = Date.now();
      const session: BirdhouseSession = {
        id: nextSessionId(),
        title: title ?? "Mock Session",
        projectID: "test-project",
        directory: "/test",
        version: "1.0.0",
        time: { created: now, updated: now },
      };

      sessions.set(session.id, session);
      messages.set(session.id, []);
      statuses.set(session.id, { type: "idle" });

      return { ...session, time: { ...session.time } };
    },
    async forkSession(sessionId, _messageId) {
      const source = sessions.get(sessionId);
      const now = Date.now();
      const session: BirdhouseSession = {
        id: nextSessionId(),
        title: source ? `Fork of ${source.title}` : `Fork of ${sessionId}`,
        projectID: source?.projectID ?? "test-project",
        directory: source?.directory ?? "/test",
        parentID: sessionId,
        version: source?.version ?? "1.0.0",
        time: { created: now, updated: now },
      };

      sessions.set(session.id, session);
      messages.set(session.id, []);
      statuses.set(session.id, { type: "idle" });

      return { ...session, time: { ...session.time } };
    },
    async sendMessage(sessionId, text, sendOptions) {
      recorded.sendMessageCalls.push({ sessionId, text, options: sendOptions });
      statuses.set(sessionId, { type: "busy" });

      const message = createAssistantMessage(sessionId, text, sendOptions);
      const sessionMessages = messages.get(sessionId) ?? [];
      sessionMessages.push(cloneMessage(message));
      messages.set(sessionId, sessionMessages);
      completions.set(sessionId, cloneMessage(message));
      statuses.set(sessionId, { type: "idle" });

      return cloneMessage(message);
    },
    async getMessages(sessionId, limit) {
      const sessionMessages = messages.get(sessionId) ?? [];
      const selectedMessages = typeof limit === "number" ? sessionMessages.slice(-limit) : sessionMessages;
      return selectedMessages.map(cloneMessage);
    },
    async getSession(sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        return {
          id: sessionId,
          title: `Session ${sessionId}`,
          projectID: "test-project",
          directory: "/test",
          version: "1.0.0",
          time: {
            created: Date.now(),
            updated: Date.now(),
          },
        };
      }

      return { ...session, time: { ...session.time } };
    },
    async getSessionStatus() {
      const statusMap: BirdhouseSessionStatusMap = {};
      for (const [sessionId, status] of statuses.entries()) {
        statusMap[sessionId] = { ...status };
      }
      return statusMap;
    },
    async waitForCompletion(sessionId) {
      const completion = completions.get(sessionId);
      if (!completion) {
        throw new Error(`No completion message for session ${sessionId}`);
      }

      statuses.set(sessionId, { type: "idle" });
      return cloneMessage(completion);
    },
    async abortSession(sessionId) {
      recorded.abortSessionCalls.push(sessionId);
      statuses.set(sessionId, { type: "idle" });
    },
    async getProviders() {
      return options.providers ? { providers: [...options.providers.providers] } : { providers: [] };
    },
    async updateSessionTitle(sessionId, title) {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      sessions.set(sessionId, {
        ...session,
        title,
        time: {
          ...session.time,
          updated: Date.now(),
        },
      });
    },
    seedSession(session) {
      sessions.set(session.id, { ...session, time: { ...session.time } });
      if (!messages.has(session.id)) {
        messages.set(session.id, []);
      }
      if (!statuses.has(session.id)) {
        statuses.set(session.id, { type: "idle" });
      }
    },
    seedMessages(sessionId, seededMessages) {
      messages.set(sessionId, seededMessages.map(cloneMessage));
    },
    seedSessionStatus(sessionId, status) {
      statuses.set(sessionId, { ...status });
    },
    seedCompletion(sessionId, message) {
      completions.set(sessionId, cloneMessage(message));
    },
  };

  return harness;
}
