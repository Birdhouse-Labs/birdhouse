// ABOUTME: Tests focus targeting and reset-to-here restoration in LiveMessages.
// ABOUTME: Verifies modal/non-modal focus intent plus reverted composer state restoration.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMessagesMock, fetchAgentMock, revertAgentMock, unrevertAgentMock } = vi.hoisted(() => ({
  fetchMessagesMock: vi.fn(),
  fetchAgentMock: vi.fn(),
  revertAgentMock: vi.fn(),
  unrevertAgentMock: vi.fn(),
}));

vi.mock("../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "ws_test" }),
}));

vi.mock("../contexts/StreamingContext", () => ({
  useStreaming: () => ({
    subscribeToSessionStatus: () => () => {},
    subscribeToConnectionEstablished: () => () => {},
    subscribeToQuestionAsked: () => () => {},
    subscribeToMessageUpdates: () => () => {},
    subscribeToPartUpdates: () => () => {},
    subscribeToPartDeltas: () => () => {},
    subscribeToAgentError: () => () => {},
    subscribeToEventCreated: () => () => {},
    subscribeToAgentUpdated: () => () => {},
    subscribeToSessionUpdates: () => () => {},
    subscribeToMessageRemoved: () => () => {},
    subscribeToAgentArchived: () => () => {},
    subscribeToAgentUnarchived: () => () => {},
  }),
}));

vi.mock("../services/messages-api", () => {
  class SendMessageError extends Error {
    statusCode: number;
    responseBody: string;
    url: string;

    constructor(message: string, statusCode: number, responseBody: string, url: string) {
      super(message);
      this.statusCode = statusCode;
      this.responseBody = responseBody;
      this.url = url;
    }
  }

  return {
    fetchMessages: fetchMessagesMock,
    fetchAgent: fetchAgentMock,
    sendMessage: vi.fn(),
    stopAgent: vi.fn(),
    stopAgentTree: vi.fn(),
    cloneAgent: vi.fn(),
    revertAgent: revertAgentMock,
    unrevertAgent: unrevertAgentMock,
    SendMessageError,
  };
});

vi.mock("../services/questions-api", () => ({
  fetchPendingQuestions: vi.fn(async () => []),
}));

vi.mock("./AgentHeader", () => ({
  default: () => <div data-testid="agent-header" />,
}));

vi.mock("./ui/ContentDialog", () => ({
  default: () => null,
}));

vi.mock("./ui/ChatContainer", () => ({
  default: (props: {
    inputValue: string;
    attachments?: Array<{ id: string }>;
    onResetToMessage?: (messageId: string) => void;
    inputRef?: (el: HTMLTextAreaElement) => void;
    messagesViewportRef?: (el: HTMLDivElement) => void;
  }) => (
    <div>
      <textarea aria-label="Mock chat composer" ref={props.inputRef} />
      <div data-testid="mock-messages-viewport" tabIndex={-1} ref={props.messagesViewportRef} />
      <div data-testid="chat-input-value">{props.inputValue}</div>
      <div data-testid="chat-attachments-count">{props.attachments?.length ?? 0}</div>
      <button type="button" onClick={() => props.onResetToMessage?.("msg_reset")}>
        Trigger Reset
      </button>
    </div>
  ),
}));

import LiveMessages from "./LiveMessages";

describe("LiveMessages reset restoration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: { type: "idle" } }),
    } as Response);

    fetchMessagesMock.mockResolvedValue([
      {
        id: "msg_1",
        role: "user",
        content: "hello",
        blocks: [],
        timestamp: new Date(),
      },
    ]);

    fetchAgentMock.mockResolvedValue({
      id: "agent_test",
      title: "Agent Test",
      model: "anthropic/claude-sonnet-4",
      archived_at: null,
      revert: undefined,
    });

    revertAgentMock.mockResolvedValue({
      success: true,
      messageText: "Restored prompt",
      attachments: [
        {
          type: "file",
          filename: "restored.png",
          mime: "image/png",
          url: "data:image/png;base64,restored123",
        },
      ],
    });

    unrevertAgentMock.mockResolvedValue({ success: true });
    localStorage.clear();
  });

  it("restores reverted image attachments into the composer", async () => {
    render(() => <LiveMessages agentId="agent_test" />);

    await waitFor(() => {
      expect(screen.getByTestId("chat-input-value")).toHaveTextContent("");
    });

    fireEvent.click(screen.getByRole("button", { name: "Trigger Reset" }));

    await waitFor(() => {
      expect(revertAgentMock).toHaveBeenCalledWith("ws_test", "agent_test", "msg_reset");
      expect(screen.getByTestId("chat-input-value")).toHaveTextContent("Restored prompt");
      expect(screen.getByTestId("chat-attachments-count")).toHaveTextContent("1");
    });
  });

  it("focuses the composer after load in non-modal views", async () => {
    render(() => <LiveMessages agentId="agent_test" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Mock chat composer")).toHaveFocus();
    });
  });

  it("focuses the messages viewport after load when requested", async () => {
    render(() => <LiveMessages agentId="agent_test" initialFocusTarget="messages" />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-messages-viewport")).toHaveFocus();
    });
  });
});
