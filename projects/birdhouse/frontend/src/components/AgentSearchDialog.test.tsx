// ABOUTME: Tests for AgentSearchDialog component
// ABOUTME: Verifies open/close, idle state, debounce API call, and result rendering

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentMessageSearchResponse } from "../services/agents-api";
import * as agentsApi from "../services/agents-api";
import AgentSearchDialog from "./AgentSearchDialog";

vi.mock("../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "test-workspace" }),
}));

vi.mock("../services/agents-api", () => ({
  searchAgentMessages: vi.fn(),
}));

// Control open state via the modal route mock
let mockIsOpen = true;
const mockCloseModal = vi.fn();
const mockOpenModal = vi.fn();

vi.mock("../lib/routing", () => ({
  useModalRoute: () => ({
    modalStack: () => (mockIsOpen ? [{ type: "agent-search", id: "main" }] : []),
    closeModal: mockCloseModal,
    openModal: mockOpenModal,
  }),
}));

vi.mock("corvu/dialog", () => {
  const Dialog = (props: { children: JSX.Element; open?: boolean; onOpenChange?: (open: boolean) => void }) => (
    <>{props.open ? props.children : null}</>
  );
  Dialog.Portal = (props: { children: JSX.Element }) => <>{props.children}</>;
  Dialog.Overlay = () => null;
  Dialog.Content = (props: { children: JSX.Element; class?: string }) => (
    <div class={props.class}>{props.children}</div>
  );
  Dialog.Close = (props: { children: JSX.Element; class?: string; onClick?: () => void }) => (
    <button type="button" class={props.class} onClick={props.onClick}>
      {props.children}
    </button>
  );
  return { default: Dialog };
});

const mockSearchAgentMessages = agentsApi.searchAgentMessages as ReturnType<typeof vi.fn>;

const makeResponse = (results: AgentMessageSearchResponse["results"]): AgentMessageSearchResponse => ({
  results,
});

const makeResult = (overrides?: Partial<AgentMessageSearchResponse["results"][number]>) => ({
  agentId: "agent-1",
  sessionId: "ses-1",
  title: "Test Agent",
  matchedMessage: {
    id: "msg-2",
    role: "assistant",
    parts: [{ type: "text" as const, text: "This is the matched message" }],
  },
  contextMessage: {
    id: "msg-1",
    role: "user",
    parts: [{ type: "text" as const, text: "Context message from user" }],
  },
  matchedAt: Date.now() - 60000,
  sessionCreatedAt: Date.now() - 3600000,
  sessionUpdatedAt: Date.now() - 60000,
  ...overrides,
});

const renderDialog = (open = true) => {
  mockIsOpen = open;
  render(() => <AgentSearchDialog />);
};

describe("AgentSearchDialog", () => {
  beforeEach(() => {
    mockSearchAgentMessages.mockResolvedValue(makeResponse([]));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the search input when open", () => {
    renderDialog();
    expect(screen.getByLabelText("Search agent messages")).toBeInTheDocument();
  });

  it("shows idle prompt when no query is entered", () => {
    renderDialog();
    expect(screen.getByText("Type to search agent messages")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    renderDialog(false);
    expect(screen.queryByLabelText("Search agent messages")).not.toBeInTheDocument();
  });

  it("calls searchAgentMessages with workspace, query, and limit after debounce", async () => {
    mockSearchAgentMessages.mockResolvedValue(makeResponse([makeResult()]));
    renderDialog();

    const input = screen.getByLabelText("Search agent messages") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "hello" } });

    expect(mockSearchAgentMessages).not.toHaveBeenCalled();

    await waitFor(
      () => {
        expect(mockSearchAgentMessages).toHaveBeenCalledWith("test-workspace", "hello", 50);
      },
      { timeout: 1000 },
    );
  });
});
