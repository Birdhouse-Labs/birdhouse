// ABOUTME: Tests for AgentSearchDialog component
// ABOUTME: Verifies open/close, idle state, debounce API call, result rendering, and keyboard nav

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentMessageSearchResponse, RecentAgentForTypeahead } from "../services/agents-api";
import * as agentsApi from "../services/agents-api";
import AgentSearchDialog from "./AgentSearchDialog";

vi.mock("../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "test-workspace" }),
}));

vi.mock("../services/agents-api", () => ({
  fetchRecentAgents: vi.fn(),
  searchAgentMessages: vi.fn(),
}));

// Control open state via the modal route mock
let mockIsOpen = true;
const mockCloseModal = vi.fn();
const mockOpenModal = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../lib/routing", () => ({
  useModalRoute: () => ({
    modalStack: () => (mockIsOpen ? [{ type: "agent-search", id: "main" }] : []),
    closeModal: mockCloseModal,
    removeModalByType: vi.fn(),
    openModal: mockOpenModal,
  }),
  useWorkspaceId: () => () => "test-workspace",
}));

vi.mock("@solidjs/router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("corvu/dialog", () => {
  const Dialog = (props: { children: JSX.Element; open?: boolean; onOpenChange?: (open: boolean) => void }) => (
    <>{props.open ? props.children : null}</>
  );
  Dialog.Portal = (props: { children: JSX.Element }) => <>{props.children}</>;
  Dialog.Overlay = () => null;
  Dialog.Content = (props: { children: JSX.Element; class?: string; onKeyDown?: (e: KeyboardEvent) => void }) => (
    // biome-ignore lint/a11y/noStaticElementInteractions: test mock — not a real interactive element
    <div role="presentation" class={props.class} onKeyDown={props.onKeyDown}>
      {props.children}
    </div>
  );
  Dialog.Close = (props: { children: JSX.Element; class?: string; onClick?: () => void }) => (
    <button type="button" class={props.class} onClick={props.onClick}>
      {props.children}
    </button>
  );
  return { default: Dialog };
});

const mockSearchAgentMessages = agentsApi.searchAgentMessages as ReturnType<typeof vi.fn>;
const mockFetchRecentAgents = agentsApi.fetchRecentAgents as ReturnType<typeof vi.fn>;

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

const makeRecentAgent = (overrides?: Partial<RecentAgentForTypeahead>): RecentAgentForTypeahead => ({
  id: "agent-recent-1",
  title: "Recent Agent",
  session_id: "ses-recent-1",
  parent_id: null,
  tree_id: "tree-recent-1",
  lastMessageAt: Date.now() - 30000,
  lastUserMessage: {
    text: "Latest user prompt",
    isAgentSent: false,
  },
  lastAgentMessage: "Latest agent response",
  ...overrides,
});

const renderDialog = (open = true) => {
  mockIsOpen = open;
  render(() => <AgentSearchDialog />);
};

describe("AgentSearchDialog", () => {
  beforeEach(() => {
    mockFetchRecentAgents.mockResolvedValue([]);
    mockSearchAgentMessages.mockResolvedValue(makeResponse([]));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the search input when open", () => {
    renderDialog();
    expect(screen.getByLabelText("Search agent messages")).toBeInTheDocument();
  });

  it("fetches and shows recent agents immediately on open", async () => {
    renderDialog();

    await waitFor(() => {
      expect(mockFetchRecentAgents).toHaveBeenCalledWith("test-workspace");
    });
  });

  it("renders a Recent section with fetched agents when no query is entered", async () => {
    mockFetchRecentAgents.mockResolvedValue([makeRecentAgent()]);
    renderDialog();

    expect(await screen.findByText("Recent")).toBeInTheDocument();
    expect(screen.getByText("Recent Agent")).toBeInTheDocument();
  });

  it("caps recent agents at 100 items", async () => {
    mockFetchRecentAgents.mockResolvedValue(
      Array.from({ length: 101 }, (_, index) =>
        makeRecentAgent({
          id: `agent-recent-${index + 1}`,
          session_id: `ses-recent-${index + 1}`,
          tree_id: `tree-recent-${index + 1}`,
          title: `Recent Agent ${index + 1}`,
        }),
      ),
    );
    renderDialog();

    expect(await screen.findByText("Recent Agent 100")).toBeInTheDocument();
    expect(screen.queryByText("Recent Agent 101")).not.toBeInTheDocument();
  });

  it("shows the keyboard hint footer", () => {
    renderDialog();

    expect(screen.getByText("navigate")).toBeInTheDocument();
    expect(screen.getByText("peek")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
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

  // ---------------------------------------------------------------------------
  // Keyboard navigation tests
  // ---------------------------------------------------------------------------

  describe("keyboard navigation", () => {
    const twoResults = [
      makeResult({ agentId: "agent-1", title: "Alpha Agent" }),
      makeResult({ agentId: "agent-2", sessionId: "ses-2", title: "Beta Agent" }),
    ];

    async function renderWithResults() {
      mockSearchAgentMessages.mockResolvedValue(makeResponse(twoResults));
      renderDialog();
      const input = screen.getByLabelText("Search agent messages") as HTMLInputElement;
      fireEvent.input(input, { target: { value: "agent" } });
      // Wait for debounce + results
      await waitFor(() => expect(screen.getByText("Alpha Agent")).toBeInTheDocument(), { timeout: 1000 });
    }

    async function renderWithRecentAgents() {
      mockFetchRecentAgents.mockResolvedValue([
        makeRecentAgent({ id: "agent-recent-1", title: "Alpha Recent" }),
        makeRecentAgent({
          id: "agent-recent-2",
          session_id: "ses-recent-2",
          tree_id: "tree-recent-2",
          title: "Beta Recent",
        }),
      ]);
      renderDialog();
      await waitFor(() => expect(screen.getByText("Alpha Recent")).toBeInTheDocument(), { timeout: 1000 });
    }

    it("ArrowDown moves active index from -1 to 0, highlighting the first result", async () => {
      await renderWithResults();
      const input = screen.getByLabelText("Search agent messages");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      // First result link should become active (aria-current or highlighted)
      await waitFor(() => {
        const firstLink = screen.getByText("Alpha Agent").closest("a");
        expect(firstLink).toHaveAttribute("aria-current", "true");
      });
    });

    it("Enter with an active result opens agent in modal", async () => {
      await renderWithResults();
      const input = screen.getByLabelText("Search agent messages");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });
      await waitFor(() => expect(mockOpenModal).toHaveBeenCalledWith("agent", "agent-1"));
    });

    it("Cmd+Enter with an active result navigates directly to the agent", async () => {
      await renderWithResults();
      const input = screen.getByLabelText("Search agent messages");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter", metaKey: true });
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/workspace/test-workspace/agent/agent-1"));
    });

    it("Ctrl+Enter with an active result navigates directly to the agent", async () => {
      await renderWithResults();
      const input = screen.getByLabelText("Search agent messages");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/workspace/test-workspace/agent/agent-1"));
    });

    it("ArrowDown wraps from last result to first", async () => {
      await renderWithResults();
      const input = screen.getByLabelText("Search agent messages");
      // Move to index 0, then 1, then wrap back to 0
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "ArrowDown" });
      await waitFor(() => {
        const firstLink = screen.getByText("Alpha Agent").closest("a");
        expect(firstLink).toHaveAttribute("aria-current", "true");
      });
    });

    it("ArrowUp from no selection moves to the last result", async () => {
      await renderWithResults();
      const input = screen.getByLabelText("Search agent messages");
      fireEvent.keyDown(input, { key: "ArrowUp" });
      await waitFor(() => {
        const lastLink = screen.getByText("Beta Agent").closest("a");
        expect(lastLink).toHaveAttribute("aria-current", "true");
      });
    });

    it("Enter with no active result (index -1) does nothing", async () => {
      await renderWithResults();
      const input = screen.getByLabelText("Search agent messages");
      // No ArrowDown pressed — index stays at -1
      fireEvent.keyDown(input, { key: "Enter" });
      expect(mockOpenModal).not.toHaveBeenCalled();
    });

    it("active index resets to -1 when a new search is triggered", async () => {
      await renderWithResults();
      const input = screen.getByLabelText("Search agent messages");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      // Confirm first result is highlighted
      await waitFor(() => {
        const firstLink = screen.getByText("Alpha Agent").closest("a");
        expect(firstLink).toHaveAttribute("aria-current", "true");
      });
      // Change the query
      mockSearchAgentMessages.mockResolvedValue(
        makeResponse([makeResult({ agentId: "agent-3", title: "Gamma Agent" })]),
      );
      fireEvent.input(input, { target: { value: "gamma" } });
      await waitFor(() => screen.getByText("Gamma Agent"));
      // No result should be highlighted (aria-current should be absent or false)
      const gammaLink = screen.getByText("Gamma Agent").closest("a");
      expect(gammaLink).not.toHaveAttribute("aria-current", "true");
    });

    it("ArrowDown highlights the first recent agent when query is empty", async () => {
      await renderWithRecentAgents();
      const input = screen.getByLabelText("Search agent messages");
      fireEvent.keyDown(input, { key: "ArrowDown" });

      await waitFor(() => {
        const firstLink = screen.getByText("Alpha Recent").closest("a");
        expect(firstLink).toHaveAttribute("aria-current", "true");
      });
    });

    it("Enter with an active recent agent opens it in a modal", async () => {
      await renderWithRecentAgents();
      const input = screen.getByLabelText("Search agent messages");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => expect(mockOpenModal).toHaveBeenCalledWith("agent", "agent-recent-1"));
    });

    it("Cmd+Enter with an active recent agent navigates directly", async () => {
      await renderWithRecentAgents();
      const input = screen.getByLabelText("Search agent messages");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter", metaKey: true });

      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/workspace/test-workspace/agent/agent-recent-1"));
    });
  });
});
