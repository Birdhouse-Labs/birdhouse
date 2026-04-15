// ABOUTME: Tests the shared agent finder used by dialog and composer typeahead.
// ABOUTME: Verifies recent loading, search behavior, keyboard actions, and shared result rendering.

import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentMessageSearchResponse, RecentAgentForTypeahead, RecentAgentSnippet } from "../services/agents-api";
import * as agentsApi from "../services/agents-api";
import AgentFinder from "./AgentFinder";

vi.mock("../services/agents-api", () => ({
  fetchRecentAgentsList: vi.fn(),
  fetchRecentAgentSnippet: vi.fn(),
  searchAgentMessages: vi.fn(),
}));

const mockOpenModal = vi.fn();

vi.mock("../lib/routing", () => ({
  useModalRoute: () => ({
    openModal: mockOpenModal,
  }),
}));

vi.mock("../contexts/ZIndexContext", () => ({
  useZIndex: () => 100,
}));

vi.mock("corvu/popover", () => {
  const Popover = (props: { children: JSX.Element }) => <>{props.children}</>;
  Popover.Trigger = (props: {
    children: JSX.Element;
    as?: string;
    type?: "button" | "submit" | "reset" | "menu";
    class?: string;
  }) => (
    <button type={props.type} class={props.class}>
      {props.children}
    </button>
  );
  Popover.Portal = (props: { children: JSX.Element }) => <>{props.children}</>;
  Popover.Content = (props: { children: JSX.Element; class?: string }) => (
    <div class={props.class}>{props.children}</div>
  );
  return { default: Popover };
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
  matchedAt: Date.now() - 60_000,
  sessionCreatedAt: Date.now() - 3_600_000,
  sessionUpdatedAt: Date.now() - 60_000,
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
  lastMessageAt: Date.now() - 30_000,
  lastUserMessage: {
    text: "Latest user prompt",
    isAgentSent: false,
  },
  lastAgentMessage: "Latest agent response",
  ...overrides,
});

function renderFinder(props?: Partial<Parameters<typeof AgentFinder>[0]>) {
  const onConfirm = vi.fn();
  const onDismiss = vi.fn();

  render(() => (
    <AgentFinder
      workspaceId="test-workspace"
      query=""
      interactive={true}
      confirmLabel="insert"
      onConfirm={onConfirm}
      onDismiss={onDismiss}
      {...props}
    />
  ));

  return { onConfirm, onDismiss };
}

describe("AgentFinder", () => {
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
    mockOpenModal.mockReset();
  });

  afterEach(() => {
    cleanup();
    delete (window.HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    vi.clearAllMocks();
  });

  it("fetches recent agents immediately when query is empty", async () => {
    renderFinder();

    await waitFor(() => {
      expect(mockFetchRecentAgentsList).toHaveBeenCalledWith("test-workspace", undefined, 50);
    });
  });

  it("shows the configurable confirm label in the keyboard hint row", async () => {
    mockFetchRecentAgentsList.mockResolvedValue([makeRecentAgent()]);
    renderFinder({ confirmLabel: "open" });

    expect(await screen.findByText("open")).toBeInTheDocument();
    expect(screen.getByText("peek")).toBeInTheDocument();
    expect(screen.getByText("dismiss")).toBeInTheDocument();
  });

  it("lazy-loads a recent snippet only after its card becomes visible", async () => {
    mockFetchRecentAgentsList.mockResolvedValue([makeRecentAgent()]);
    renderFinder();

    const recentLink = await screen.findByText("Recent Agent");
    const card = recentLink.closest("div[class*='rounded-xl']");
    expect(card).toBeInTheDocument();
    expect(mockFetchRecentAgentSnippet).not.toHaveBeenCalled();

    MockIntersectionObserver.instances[0]?.trigger(card as Element, true);

    await waitFor(() => {
      expect(mockFetchRecentAgentSnippet).toHaveBeenCalledWith("test-workspace", "agent-recent-1");
    });
  });

  it("renders recent snippets as separate message bubbles with agent-sent styling", async () => {
    mockFetchRecentAgentsList.mockResolvedValue([makeRecentAgent()]);
    mockFetchRecentAgentSnippet.mockResolvedValue(
      makeRecentSnippet({
        lastUserMessage: {
          text: "Forwarded from another agent",
          isAgentSent: true,
          sentByAgentTitle: "Other Agent",
        },
        lastAgentMessage: "Latest assistant summary",
      }),
    );
    renderFinder();

    const recentLink = await screen.findByText("Recent Agent");
    const card = recentLink.closest("div[class*='rounded-xl']");
    expect(card).toBeInTheDocument();

    MockIntersectionObserver.instances[0]?.trigger(card as Element, true);

    expect(await screen.findByTitle("Latest assistant summary")).toHaveStyle({
      background: "var(--theme-surface-raised)",
    });
    expect(screen.getByTitle("Forwarded from another agent").getAttribute("style")).toContain(
      "linear-gradient(to right",
    );
  });

  it("does not load recent snippets while interaction is disabled", async () => {
    mockFetchRecentAgentsList.mockResolvedValue([makeRecentAgent()]);
    renderFinder({ interactive: false });

    const recentLink = await screen.findByText("Recent Agent");
    const card = recentLink.closest("div[class*='rounded-xl']");
    expect(card).toBeInTheDocument();

    MockIntersectionObserver.instances[0]?.trigger(card as Element, true);

    await waitFor(() => {
      expect(mockFetchRecentAgentsList).toHaveBeenCalledWith("test-workspace", undefined, 50);
    });

    expect(mockFetchRecentAgentSnippet).not.toHaveBeenCalled();
  });

  it("searches when query is present and filters out null-agent results", async () => {
    mockSearchAgentMessages.mockResolvedValue(
      makeResponse([
        makeResult({ agentId: null, title: "Session Only" }),
        makeResult({ agentId: "agent-2", sessionId: "ses-2", title: "Visible Agent" }),
      ]),
    );

    renderFinder({ query: "visible" });

    await waitFor(() => {
      expect(mockSearchAgentMessages).toHaveBeenCalledWith("test-workspace", "visible", 50);
    });

    expect(await screen.findByText("Visible Agent")).toBeInTheDocument();
    expect(screen.queryByText("Session Only")).not.toBeInTheDocument();
  });

  it("marks the current agent in both recent and search results", async () => {
    mockFetchRecentAgentsList.mockResolvedValue([makeRecentAgent({ id: "agent-current", title: "Current Recent" })]);
    const recentView = renderFinder({ currentAgentId: "agent-current" });

    expect(await screen.findByText("Current Recent")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    recentView.onConfirm.mockReset();

    cleanup();

    mockSearchAgentMessages.mockResolvedValue(
      makeResponse([makeResult({ agentId: "agent-current", title: "Current Search" })]),
    );
    renderFinder({ currentAgentId: "agent-current", query: "current" });

    expect(await screen.findByText("Current Search")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("renders search result text messages with shared message bubble styling", async () => {
    mockSearchAgentMessages.mockResolvedValue(makeResponse([makeResult()]));
    renderFinder({ query: "match" });

    await waitFor(() => {
      expect(mockSearchAgentMessages).toHaveBeenCalledWith("test-workspace", "match", 50);
    });

    expect(await screen.findByTitle("This is the matched message")).toHaveStyle({
      background: "var(--theme-surface-raised)",
    });
    expect(screen.getByTitle("Context message from user").getAttribute("style")).toContain(
      "color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-raised))",
    );
  });

  it("ArrowDown highlights the first item and Enter confirms it", async () => {
    mockFetchRecentAgentsList.mockResolvedValue([
      makeRecentAgent({ id: "agent-1", title: "Alpha Recent" }),
      makeRecentAgent({ id: "agent-2", title: "Beta Recent", session_id: "ses-2", tree_id: "tree-2" }),
    ]);
    const { onConfirm } = renderFinder();

    expect(await screen.findByText("Alpha Recent")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowDown" });

    await waitFor(() => {
      const firstLink = screen.getByText("Alpha Recent").closest("button");
      expect(firstLink).toHaveAttribute("aria-current", "true");
    });

    fireEvent.keyDown(document, { key: "Enter" });

    expect(onConfirm).toHaveBeenCalledWith({ agentId: "agent-1", title: "Alpha Recent" });
  });

  it("Right Shift peeks the active item without confirming", async () => {
    mockFetchRecentAgentsList.mockResolvedValue([makeRecentAgent({ id: "agent-1", title: "Alpha Recent" })]);
    const { onConfirm } = renderFinder();

    expect(await screen.findByText("Alpha Recent")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.keyUp(document, { code: "ShiftRight", key: "Shift" });

    await waitFor(() => {
      expect(mockOpenModal).toHaveBeenCalledWith("agent", "agent-1");
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Escape dismisses the finder", async () => {
    mockFetchRecentAgentsList.mockResolvedValue([makeRecentAgent()]);
    const { onDismiss } = renderFinder();

    expect(await screen.findByText("Recent Agent")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onDismiss).toHaveBeenCalled();
  });

  it("clicking a result confirms it", async () => {
    mockFetchRecentAgentsList.mockResolvedValue([makeRecentAgent({ id: "agent-1", title: "Clickable Agent" })]);
    const { onConfirm } = renderFinder();

    const button = await screen.findByRole("button", { name: "Clickable Agent" });
    fireEvent.click(button);

    expect(onConfirm).toHaveBeenCalledWith({ agentId: "agent-1", title: "Clickable Agent" });
  });
});
