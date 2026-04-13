import { createOpencodeClient } from "@opencode-ai/sdk";
import type { AssistantMessage, FilePartInput, Part, TextPartInput, UserMessage } from "@opencode-ai/sdk/client";
export type { UserMessage, AssistantMessage };

// ABOUTME: OpenCode HTTP API client for session and message operations
// ABOUTME: Provides both live (real API calls) and test (mocked) implementations

// Type definitions based on OpenCode's actual API contracts
export interface Session {
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
  summary?: {
    additions: number;
    deletions: number;
    files: number;
  };
  revert?: {
    messageID: string;
  };
}

export interface Message {
  info: UserMessage | AssistantMessage;
  parts: Part[];
}
export interface SessionStatus {
  type: "idle" | "busy" | "retry";
}

export interface SessionStatusMap {
  [sessionId: string]: SessionStatus;
}

export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionItem {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

export interface QuestionRequest {
  id: string;
  sessionID: string;
  questions: QuestionItem[];
  tool?: { messageID: string; callID: string };
}

export interface Provider {
  id: string;
  name: string;
  models: Record<string, { id: string; name: string }>;
}

export interface ProvidersResponse {
  providers: Provider[];
}

export interface Skill {
  name: string;
  description: string;
  location: string;
  content: string;
}

/**
 * OpenCode client interface - defines all methods available on client
 */
export interface OpenCodeClient {
  client: ReturnType<typeof createOpencodeClient>;
  getSession(sessionId: string): Promise<Session>;
  createSession(title?: string): Promise<Session>;
  forkSession(sessionId: string, messageId?: string): Promise<Session>;
  sendMessage(
    sessionId: string,
    text: string,
    options?: {
      model?: { providerID: string; modelID: string };
      noReply?: boolean;
      system?: string;
      agent?: string;
      metadata?: Record<string, unknown>;
      parts?: Array<TextPartInput | FilePartInput>;
    },
  ): Promise<Message>;
  getMessages(sessionId: string, limit?: number): Promise<Message[]>;
  getSessionStatus(): Promise<SessionStatusMap>;
  waitForSessionCompletion(sessionId: string): Promise<Message>;
  getProviders(): Promise<ProvidersResponse>;
  listSkills(): Promise<Skill[]>;
  reloadSkillState(): Promise<void>;
  generate(options: {
    prompt?: string;
    system?: string[];
    message: string;
    small?: boolean;
    maxTokens?: number;
  }): Promise<string>;
  revertSession(sessionId: string, messageId: string): Promise<void>;
  unrevertSession(sessionId: string): Promise<void>;
  updateSessionTitle(sessionId: string, title: string): Promise<void>;
  listPendingQuestions(): Promise<QuestionRequest[]>;
  replyToQuestion(requestID: string, answers: string[][]): Promise<void>;
}

/**
 * Create live OpenCode client that calls real API
 */
export function createLiveOpenCodeClient(baseUrl: string, workspaceRoot: string): OpenCodeClient {
  const url = new URL(baseUrl);
  const client = createOpencodeClient({
    baseUrl: url.origin,
  });

  return {
    client: client,
    async getSession(sessionId: string): Promise<Session> {
      const response = await fetch(`${baseUrl}/session/${sessionId}?directory=${encodeURIComponent(workspaceRoot)}`);
      if (!response.ok) {
        throw new Error(`Failed to get session: ${response.statusText}`);
      }
      return response.json() as Promise<Session>;
    },

    async createSession(title?: string): Promise<Session> {
      const response = await fetch(`${baseUrl}/session?directory=${encodeURIComponent(workspaceRoot)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }
      return response.json() as Promise<Session>;
    },

    async forkSession(sessionId: string, messageId?: string): Promise<Session> {
      const response = await fetch(
        `${baseUrl}/session/${sessionId}/fork?directory=${encodeURIComponent(workspaceRoot)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(messageId ? { messageID: messageId } : {}),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to fork session: ${response.statusText}`);
      }
      return response.json() as Promise<Session>;
    },

    async sendMessage(
      sessionId: string,
      text: string,
      options?: {
        model?: { providerID: string; modelID: string };
        noReply?: boolean;
        system?: string;
        agent?: string;
        metadata?: Record<string, unknown>;
        parts?: Array<TextPartInput | FilePartInput>;
      },
    ): Promise<Message> {
      const parts = options?.parts || [
        { type: "text", text, ...(options?.metadata && { metadata: options.metadata }) },
      ];

      const response = await fetch(
        `${baseUrl}/session/${sessionId}/message?directory=${encodeURIComponent(workspaceRoot)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parts,
            model: options?.model,
            system: options?.system,
            agent: options?.agent,
            noReply: options?.noReply,
          }),
        },
      );

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText} - ${responseText}`);
      }

      if (!responseText) {
        // Empty response is expected when noReply: true (async message sending)
        if (options?.noReply) {
          return {} as Message;
        }
        throw new Error(`Received unexpected empty response from agent engine (status ${response.status})`);
      }

      return JSON.parse(responseText) as Message;
    },

    async getMessages(sessionId: string, limit?: number): Promise<Message[]> {
      const url = new URL(`${baseUrl}/session/${sessionId}/message`);
      url.searchParams.set("directory", workspaceRoot);
      if (limit) {
        url.searchParams.set("limit", limit.toString());
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Failed to get messages: ${response.statusText}`);
      }
      return response.json() as Promise<Message[]>;
    },

    async getSessionStatus(): Promise<SessionStatusMap> {
      const response = await fetch(`${baseUrl}/session/status?directory=${encodeURIComponent(workspaceRoot)}`);
      if (!response.ok) {
        throw new Error(`Failed to get session status: ${response.statusText}`);
      }
      return response.json() as Promise<SessionStatusMap>;
    },

    async waitForSessionCompletion(sessionId: string): Promise<Message> {
      const response = await fetch(
        `${baseUrl}/session/${sessionId}/wait?directory=${encodeURIComponent(workspaceRoot)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to wait for session: ${response.statusText}`);
      }
      return response.json() as Promise<Message>;
    },

    async getProviders(): Promise<ProvidersResponse> {
      const response = await fetch(`${baseUrl}/config/providers`);
      if (!response.ok) {
        throw new Error(`Failed to get providers: ${response.statusText}`);
      }
      return response.json() as Promise<ProvidersResponse>;
    },

    async listSkills(): Promise<Skill[]> {
      const response = await fetch(`${baseUrl}/skill?directory=${encodeURIComponent(workspaceRoot)}`);
      if (!response.ok) {
        throw new Error(`Failed to list skills: ${response.statusText}`);
      }
      return response.json() as Promise<Skill[]>;
    },

    async reloadSkillState(): Promise<void> {
      const response = await fetch(`${baseUrl}/skill/reload?directory=${encodeURIComponent(workspaceRoot)}`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to reload skill state: ${response.statusText} - ${errorText}`);
      }
    },

    async generate(options: {
      prompt?: string;
      system?: string[];
      message: string;
      small?: boolean;
      maxTokens?: number;
    }): Promise<string> {
      const response = await fetch(`${baseUrl}/llm/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: options.prompt,
          system: options.system,
          message: options.message,
          small: options.small ?? true,
          maxTokens: options.maxTokens ?? 300,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate: ${response.statusText} - ${errorText}`);
      }
      const json = (await response.json()) as { text: string };
      return json.text.trim();
    },

    async revertSession(sessionId: string, messageId: string): Promise<void> {
      const response = await fetch(
        `${baseUrl}/session/${sessionId}/revert?directory=${encodeURIComponent(workspaceRoot)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageID: messageId }),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to revert session: ${response.statusText}`);
      }
    },

    async unrevertSession(sessionId: string): Promise<void> {
      const response = await fetch(
        `${baseUrl}/session/${sessionId}/unrevert?directory=${encodeURIComponent(workspaceRoot)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to unrevert session: ${response.statusText}`);
      }
    },

    async updateSessionTitle(sessionId: string, title: string): Promise<void> {
      const response = await fetch(`${baseUrl}/session/${sessionId}?directory=${encodeURIComponent(workspaceRoot)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update session title: ${response.statusText}`);
      }
    },

    async listPendingQuestions(): Promise<QuestionRequest[]> {
      const response = await fetch(`${baseUrl}/question?directory=${encodeURIComponent(workspaceRoot)}`);
      if (!response.ok) {
        throw new Error(`Failed to list pending questions: ${response.statusText}`);
      }
      return response.json() as Promise<QuestionRequest[]>;
    },

    async replyToQuestion(requestID: string, answers: string[][]): Promise<void> {
      const response = await fetch(
        `${baseUrl}/question/${requestID}/reply?directory=${encodeURIComponent(workspaceRoot)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to reply to question: ${response.statusText}`);
      }
    },
  };
}

/**
 * Create test OpenCode client with mocked responses
 */

// Type for the options passed to session.prompt in the OpenCode SDK
export interface MockSessionPromptOptions {
  path?: { id: string };
  body?: {
    parts?: Array<{ type: string; text: string }>;
    model?: { providerID: string; modelID: string };
    noReply?: boolean;
    system?: string;
    agent?: string;
  };
}

// Global mock for session.prompt - can be overridden by tests
let mockSessionPrompt: ((options: MockSessionPromptOptions) => Promise<{ data: Message }>) | undefined;

export function setMockSessionPrompt(
  fn: ((options: MockSessionPromptOptions) => Promise<{ data: Message }>) | undefined,
): void {
  mockSessionPrompt = fn;
}

export function createTestOpenCodeClient(): OpenCodeClient {
  // Mock client with session.prompt() that returns a test message
  const mockClient = {
    session: {
      prompt: async (options: MockSessionPromptOptions): Promise<{ data: Message }> => {
        // Allow tests to override the mock
        if (mockSessionPrompt) {
          return mockSessionPrompt(options);
        }

        const messageId = `msg_test_${Date.now()}`;
        return {
          data: {
            info: {
              id: messageId,
              sessionID: options.path?.id || "ses_test",
              role: "assistant",
              time: { created: Date.now(), completed: Date.now() },
              parentID: "msg_user",
              modelID: options.body?.model?.modelID || "claude-sonnet-4",
              providerID: options.body?.model?.providerID || "anthropic",
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
            },
            parts: [
              {
                type: "text",
                text: "Mock response",
                id: `part_${Date.now()}`,
                sessionID: options.path?.id || "ses_test",
                messageID: messageId,
              },
            ],
          },
        };
      },
    },
  };

  return {
    // Mock client implements subset of OpenCode SDK client interface needed for tests
    client: mockClient as unknown as ReturnType<typeof createOpencodeClient>,
    async getSession(sessionId: string): Promise<Session> {
      return {
        id: sessionId, // Return the passed sessionId
        title: `Session ${sessionId}`, // Include sessionId in title for debugging
        projectID: "test-project",
        directory: "/test",
        version: "1.0.0",
        time: {
          created: Date.now(),
          updated: Date.now(),
        },
      };
    },

    async createSession(title?: string): Promise<Session> {
      return {
        id: `ses_test_${Date.now()}`,
        title: title || "Mock Session",
        projectID: "test-project",
        directory: "/test",
        version: "1.0.0",
        time: {
          created: Date.now(),
          updated: Date.now(),
        },
      };
    },

    async forkSession(sessionId: string, _messageId?: string): Promise<Session> {
      return {
        id: `ses_fork_${Date.now()}`,
        title: `Fork of ${sessionId}`,
        projectID: "test-project",
        directory: "/test",
        version: "1.0.0",
        time: {
          created: Date.now(),
          updated: Date.now(),
        },
      };
    },

    async sendMessage(
      sessionId: string,
      _text: string,
      options?: {
        model?: { providerID: string; modelID: string };
        noReply?: boolean;
        system?: string;
        agent?: string;
        metadata?: Record<string, unknown>;
        parts?: Array<TextPartInput | FilePartInput>;
      },
    ): Promise<Message> {
      const messageId = `msg_test_${Date.now()}`;
      return {
        info: {
          id: messageId,
          sessionID: sessionId,
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user",
          modelID: options?.model?.modelID || "claude-sonnet-4",
          providerID: options?.model?.providerID || "anthropic",
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
        },
        parts: [
          {
            type: "text",
            text: "Mock response",
            id: `part_${Date.now()}`,
            sessionID: sessionId,
            messageID: messageId,
          },
        ],
      };
    },

    async getMessages(_sessionId: string, _limit?: number): Promise<Message[]> {
      return [];
    },

    async getSessionStatus(): Promise<SessionStatusMap> {
      return {};
    },

    async waitForSessionCompletion(sessionId: string): Promise<Message> {
      const messageId = `msg_test_${Date.now()}`;
      return {
        info: {
          id: messageId,
          sessionID: sessionId,
          role: "assistant",
          time: { created: Date.now(), completed: Date.now() },
          parentID: "msg_user",
          modelID: "claude-sonnet-4",
          providerID: "anthropic",
          mode: "build",
          cost: 0,
          tokens: {
            input: 100,
            output: 50,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          finish: "stop",
          path: {
            cwd: "/",
            root: "/",
          },
        },
        parts: [
          {
            type: "text",
            text: "Mock completed response",
            id: `part_${Date.now()}`,
            sessionID: sessionId,
            messageID: messageId,
          },
        ],
      };
    },

    async getProviders(): Promise<ProvidersResponse> {
      return {
        providers: [
          {
            id: "anthropic",
            name: "Anthropic",
            models: {
              "claude-sonnet-4": {
                id: "claude-sonnet-4",
                name: "Claude Sonnet 4",
              },
              "claude-haiku-4": {
                id: "claude-haiku-4",
                name: "Claude Haiku 4",
              },
              "claude-opus-4": { id: "claude-opus-4", name: "Claude Opus 4" },
            },
          },
        ],
      };
    },

    async listSkills(): Promise<Skill[]> {
      return [];
    },

    async reloadSkillState(): Promise<void> {
      // Mock implementation - no-op
    },

    async generate(_options: {
      prompt?: string;
      system?: string[];
      message: string;
      small?: boolean;
      maxTokens?: number;
    }): Promise<string> {
      return "Mock Generated Title";
    },

    async revertSession(_sessionId: string, _messageId: string): Promise<void> {
      // Mock implementation - no-op
    },

    async unrevertSession(_sessionId: string): Promise<void> {
      // Mock implementation - no-op
    },

    async updateSessionTitle(_sessionId: string, _title: string): Promise<void> {
      // Mock implementation - no-op
    },

    async listPendingQuestions(): Promise<QuestionRequest[]> {
      return [];
    },

    async replyToQuestion(_requestID: string, _answers: string[][]): Promise<void> {
      // Mock implementation - no-op
    },
  };
}
