// ABOUTME: Tests for AgentSearchDialog component
// ABOUTME: Verifies open/close, idle state, debounce API call, result rendering, and keyboard nav

import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentMessageSearchResponse, RecentAgentForTypeahead, RecentAgentSnippet } from "../services/agents-api";
import * as agentsApi from "../services/agents-api";
import AgentSearchDialog from "./AgentSearchDialog";

vi.mock("../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "test-workspace" }),
}));

vi.mock("../services/agents-api", () => ({
  fetchRecentAgentsList: vi.fn(),
  fetchRecentAgentSnippet: vi.fn(),
  searchAgentMessages: vi.fn(),
}));

// Control modal stack via the route mock
let mockModalStack = [{ type: "agent-search", id: "main" }];
const mockCloseModal = vi.fn();
const mockOpenModal = vi.fn();
const mockNavigate = vi.fn();
const mockRemoveModalByType = vi.fn();

vi.mock("../lib/routing", () => ({
  useModalRoute: () => ({
    modalStack: () => mockModalStack,
    closeModal: mockCloseModal,
    removeModalByType: mockRemoveModalByType,
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
  Dialog.Content = (props: {
    children: JSX.Element;
    class?: string;
    onKeyDown?: (e: KeyboardEvent) => void;
    onKeyUp?: (e: KeyboardEvent) => void;
  }) => (
    // biome-ignore lint/a11y/noStaticElementInteractions: test mock — not a real interactive element
    <div role="presentation" class={props.class} onKeyDown={props.onKeyDown} onKeyUp={props.onKeyUp}>
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
const mockFetchRecentAgentsList = agentsApi.fetchRecentAgentsList as ReturnType<typeof vi.fn>;
const mockFetchRecentAgentSnippet = agentsApi.fetchRecentAgentSnippet as ReturnType<typeof vi.fn>;
const scrollIntoViewMock = vi.fn();

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly callback: IntersectionObserverCallback;
  readonly options: IntersectionObserverInit | undefined;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  trigger(target: Element, isIntersecting: boolean) {
    this.callback(
      [
        {
          target,
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: isIntersecting ? target.getBoundingClientRect() : new DOMRectReadOnly(),
          rootBounds: null,
          time: Date.now(),
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }

  static reset() {
    MockIntersectionObserver.instances = [];
  }
}

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
  ...overrides,
});

const makeRecentSnippet = (overrides?: Partial<RecentAgentSnippet>): RecentAgentSnippet => ({
  lastMessageAt: Date.now() - 30000,
  lastUserMessage: {
    text: "Latest user prompt",
    isAgentSent: false,
  },
  lastAgentMessage: "Latest agent response",
  ...overrides,
});

const formatEpochTimestamp = () =>
  new Date(0).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

// Resets mockModalStack as a side effect. If a test needs a different stack,
// set mockModalStack after calling renderDialog(), not before.
const renderDialog = (open = true) => {
  mockModalStack = open ? [{ type: "agent-search", id: "main" }] : [];
  render(() => <AgentSearchDialog />);
};

describe("AgentSearchDialog", () => {
  beforeEach(() => {
    MockIntersectionObserver.reset();
    globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
    scrollIntoViewMock.mockReset();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
    mockFetchRecentAgentsList.mockResolvedValue([]);
    mockFetchRecentAgentSnippet.mockResolvedValue(makeRecentSnippet());
    mockSearchAgentMessages.mockResolvedValue(makeResponse([]));
  });

  afterEach(() => {
    cleanup();
    delete (window.HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    vi.clearAllMocks();
  });

  it("renders the search input when open", () => {
    renderDialog();
    expect(screen.getByLabelText("Search agent messages")).toBeInTheDocument();
  });

  it("fetches recent agents with limit=50 immediately on open", async () => {
    renderDialog();

    await waitFor(() => {
      expect(mockFetchRecentAgentsList).toHaveBeenCalledWith("test-workspace", undefined, 50);
    });
  });

  it("renders a Recent section with fetched agents when no query is entered", async () => {
    mockFetchRecentAgentsList.mockResolvedValue([makeRecentAgent()]);
    renderDialog();

    expect(await screen.findByText("Recent")).toBeInTheDocument();
    expect(screen.getByText("Recent Agent")).toBeInTheDocument();
  });

  it("renders all agents returned by fetchRecentAgentsList (limit enforced server-side)", async () => {
    mockFetchRecentAgentsList.mockResolvedValue(
      Array.from({ length: 50 }, (_, index) =>
        makeRecentAgent({
          id: `agent-recent-${index + 1}`,
          session_id: `ses-recent-${index + 1}`,
          tree_id: `tree-recent-${index + 1}`,
          title: `Recent Agent ${index + 1}`,
        }),
      ),
    );
    renderDialog();

    expect(await screen.findByText("Recent Agent 50")).toBeInTheDocument();
  });

  it("shows a loading placeholder until a visible recent card snippet resolves", async () => {
    mockFetchRecentAgentsList.mockResolvedValue([makeRecentAgent()]);
    let resolveSnippet: ((value: RecentAgentSnippet) => void) | undefined;
    mockFetchRecentAgentSnippet.mockReturnValue(
      new Promise<RecentAgentSnippet>((resolve) => {
        resolveSnippet = resolve;
      }),
    );

    renderDialog();

    const recentLink = await screen.findByText("Recent Agent");
    const card = recentLink.closest("div[class*='rounded-xl']");
    expect(card).toBeInTheDocument();
    expect(screen.queryByText("Latest agent response")).not.toBeInTheDocument();

    MockIntersectionObserver.instances[0]?.trigger(card as Element, true);

    await waitFor(() => {
      expect(mockFetchRecentAgentSnippet).toHaveBeenCalledWith("test-workspace", "agent-recent-1");
    });

    expect(card?.querySelector("[data-snippet-loading='true']")).toBeInTheDocument();

    resolveSnippet?.(makeRecentSnippet());

    expect(await screen.findByText("Latest agent response")).toBeInTheDocument();
  });

  it("does not fetch a snippet before a recent card becomes visible", async () => {
    mockFetchRecentAgentsList.mockResolvedValue([makeRecentAgent()]);
    renderDialog();

    await screen.findByText("Recent Agent");

    expect(mockFetchRecentAgentSnippet).not.toHaveBeenCalled();
  });

  it("does not render an epoch timestamp before a recent snippet has loaded", async () => {
    mockFetchRecentAgentsList.mockResolvedValue([makeRecentAgent()]);
    renderDialog();

    await screen.findByText("Recent Agent");

    expect(screen.queryByText(formatEpochTimestamp())).not.toBeInTheDocument();
  });

  it("fetches only the recent card that becomes visible", async () => {
    mockFetchRecentAgentsList.mockResolvedValue([
      makeRecentAgent({ id: "agent-recent-1", title: "Visible Recent" }),
      makeRecentAgent({
        id: "agent-recent-2",
        session_id: "ses-recent-2",
        tree_id: "tree-recent-2",
        title: "Hidden Recent",
      }),
    ]);
    renderDialog();

    const visibleLink = await screen.findByText("Visible Recent");
    await screen.findByText("Hidden Recent");

    const visibleCard = visibleLink.closest("div[class*='rounded-xl']");
    expect(visibleCard).toBeInTheDocument();

    MockIntersectionObserver.instances[0]?.trigger(visibleCard as Element, true);

    await waitFor(() => {
      expect(mockFetchRecentAgentSnippet).toHaveBeenCalledTimes(1);
      expect(mockFetchRecentAgentSnippet).toHaveBeenCalledWith("test-workspace", "agent-recent-1");
    });
  });

  it("does not fetch snippets while the search dialog is obscured by a higher modal", async () => {
    mockModalStack = [
      { type: "agent-search", id: "main" },
      { type: "agent", id: "agent-123" },
    ];
    mockFetchRecentAgentsList.mockResolvedValue([makeRecentAgent()]);
    render(() => <AgentSearchDialog />);

    const recentLink = await screen.findByText("Recent Agent");
    const card = recentLink.closest("div[class*='rounded-xl']");
    expect(card).toBeInTheDocument();

    MockIntersectionObserver.instances[0]?.trigger(card as Element, true);

    await waitFor(() => {
      expect(mockFetchRecentAgentsList).toHaveBeenCalledWith("test-workspace", undefined, 50);
    });

    expect(mockFetchRecentAgentSnippet).not.toHaveBeenCalled();
  });

  it("keeps the preview area blank when snippet loading fails", async () => {
    mockFetchRecentAgentsList.mockResolvedValue([makeRecentAgent()]);
    mockFetchRecentAgentSnippet.mockRejectedValue(new Error("snippet failed"));
    renderDialog();

    const recentLink = await screen.findByText("Recent Agent");
    const card = recentLink.closest("div[class*='rounded-xl']");
    expect(card).toBeInTheDocument();

    MockIntersectionObserver.instances[0]?.trigger(card as Element, true);

    await waitFor(() => {
      expect(mockFetchRecentAgentSnippet).toHaveBeenCalledWith("test-workspace", "agent-recent-1");
    });

    await waitFor(() => {
      expect(card?.querySelector("[data-snippet-loading='true']")).not.toBeInTheDocument();
    });

    expect(screen.queryByText("Latest agent response")).not.toBeInTheDocument();
    expect(card?.querySelector("[data-snippet-empty='true']")).toBeInTheDocument();
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
      mockFetchRecentAgentsList.mockResolvedValue([
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

    it("Enter with an active result navigates directly to the agent", async () => {
      await renderWithResults();
      const input = screen.getByLabelText("Search agent messages");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/workspace/test-workspace/agent/agent-1"));
    });

    it("Right Shift with an active result peeks the agent in a modal", async () => {
      await renderWithResults();
      const content = screen.getByRole("presentation");
      fireEvent.keyDown(content, { key: "ArrowDown" });
      fireEvent.keyUp(content, { code: "ShiftRight", key: "Shift" });
      await waitFor(() => expect(mockOpenModal).toHaveBeenCalledWith("agent", "agent-1"));
    });

    it("scrolls the active search result into view during keyboard navigation", async () => {
      await renderWithResults();
      const input = screen.getByLabelText("Search agent messages");

      fireEvent.keyDown(input, { key: "ArrowDown" });

      await waitFor(() => {
        expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: "nearest" });
      });
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
      expect(mockNavigate).not.toHaveBeenCalled();
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

    it("Enter with an active recent agent navigates directly", async () => {
      await renderWithRecentAgents();
      const input = screen.getByLabelText("Search agent messages");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/workspace/test-workspace/agent/agent-recent-1"));
    });

    it("Right Shift with an active recent agent peeks it in a modal", async () => {
      await renderWithRecentAgents();
      const content = screen.getByRole("presentation");
      fireEvent.keyDown(content, { key: "ArrowDown" });
      fireEvent.keyUp(content, { code: "ShiftRight", key: "Shift" });

      await waitFor(() => expect(mockOpenModal).toHaveBeenCalledWith("agent", "agent-recent-1"));
    });

    it("scrolls the active recent agent into view during keyboard navigation", async () => {
      await renderWithRecentAgents();
      const input = screen.getByLabelText("Search agent messages");

      fireEvent.keyDown(input, { key: "ArrowDown" });

      await waitFor(() => {
        expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: "nearest" });
      });
    });
  });
});
