// ABOUTME: Shared finder for recent agents and full-text agent search results.
// ABOUTME: Handles keyboard actions, lazy snippets, peek, confirm, and dismissal for both wrappers.

import Popover from "corvu/popover";
import {
  type Accessor,
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  type Setter,
  Show,
} from "solid-js";
import { useZIndex } from "../contexts/ZIndexContext";
import { useModalRoute } from "../lib/routing";
import type { AgentMessageSearchResult, RecentAgentForTypeahead } from "../services/agents-api";
import { fetchRecentAgentSnippet, fetchRecentAgentsList, searchAgentMessages } from "../services/agents-api";
import { getAgentSentBubbleProps, MatchPair } from "./ui/AgentMatchWindow";
import MessageBubble from "./ui/MessageBubble";

export interface AgentFinderSelection {
  agentId: string;
  title: string;
}

export interface AgentFinderProps {
  workspaceId: string;
  query: string;
  interactive: boolean;
  currentAgentId?: string;
  confirmLabel?: string;
  openPopoverIndex?: Accessor<number | null>;
  setOpenPopoverIndex?: Setter<number | null>;
  onConfirm: (selection: AgentFinderSelection) => void;
  onDismiss: () => void;
  sessionState?: AgentFinderSessionState;
}

export interface AgentFinderSessionState {
  results: Accessor<AgentMessageSearchResult[]>;
  setResults: Setter<AgentMessageSearchResult[]>;
  recentAgents: Accessor<RecentAgentForTypeahead[]>;
  setRecentAgents: Setter<RecentAgentForTypeahead[]>;
  isSearching: Accessor<boolean>;
  setIsSearching: Setter<boolean>;
  isLoadingRecent: Accessor<boolean>;
  setIsLoadingRecent: Setter<boolean>;
  searchError: Accessor<string | null>;
  setSearchError: Setter<string | null>;
  hasSearched: Accessor<boolean>;
  setHasSearched: Setter<boolean>;
  activeIndex: Accessor<number>;
  setActiveIndex: Setter<number>;
  pointerMoved: Accessor<boolean>;
  setPointerMoved: Setter<boolean>;
  openPopoverIndex: Accessor<number | null>;
  setOpenPopoverIndex: Setter<number | null>;
  resultsScrollTop: Accessor<number>;
  setResultsScrollTop: Setter<number>;
}

interface GroupedResult {
  agentId: string;
  sessionId: string;
  title: string;
  sessionCreatedAt: number;
  sessionUpdatedAt: number;
  matches: AgentMessageSearchResult[];
}

interface VisibleAgentResult {
  agentId: string;
  title: string;
  kind: "recent" | "search";
  recentAgent?: RecentAgentForTypeahead;
  groupedResult?: GroupedResult;
}

interface SearchResultCardProps {
  group: GroupedResult;
  query: string;
  isActive: boolean;
  allowHover: boolean;
  isCurrent: boolean;
  isPopoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
  onPointerEnter: () => void;
  onConfirm: () => void;
  itemRef: (el: HTMLDivElement) => void;
}

interface RecentAgentCardProps {
  agent: RecentAgentForTypeahead;
  workspaceId: string;
  isActive: boolean;
  allowHover: boolean;
  isCurrent: boolean;
  interactive: boolean;
  onPointerEnter: () => void;
  onConfirm: () => void;
  itemRef: (el: HTMLDivElement) => void;
  getObserverRoot: () => HTMLDivElement | undefined;
}

const SEARCH_LIMIT = 50;
const RECENT_LIMIT = 50;
const DEBOUNCE_MS = 300;
const MATCHES_POPOVER_FLOATING_OPTIONS = {
  offset: 8,
  flip: true,
  shift: { padding: 16 },
  size: { fitViewPort: true, padding: 16 },
} as const;

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSessionRange(createdAt: number, updatedAt: number): string {
  const start = new Date(createdAt);
  const end = new Date(updatedAt);

  const startStr = start.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const isSameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (isSameDay) {
    const endTimeStr = end.toLocaleString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${startStr} – ${endTimeStr}`;
  }

  const endStr = end.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `${startStr} – ${endStr}`;
}

const CurrentBadge: Component = () => (
  <span class="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-text-secondary">Current</span>
);

const SectionHeader: Component<{ label: string }> = (props) => (
  <div class="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider select-none">
    {props.label}
  </div>
);

const RecentAgentCard: Component<RecentAgentCardProps> = (props) => {
  let itemEl: HTMLDivElement | undefined;
  const [shouldLoadSnippet, setShouldLoadSnippet] = createSignal(false);
  const [snippet] = createResource(
    () => (shouldLoadSnippet() ? props.agent.id : undefined),
    async (agentId) => fetchRecentAgentSnippet(props.workspaceId, agentId),
  );

  createEffect(() => {
    if (shouldLoadSnippet()) return;

    const root = props.getObserverRoot();
    if (!root || !itemEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadSnippet(true);
          observer.disconnect();
        }
      },
      {
        root,
        rootMargin: "120px 0px",
      },
    );

    observer.observe(itemEl);
    onCleanup(() => observer.disconnect());
  });

  const snippetData = () => {
    if (snippet.error) return null;
    return snippet();
  };

  const isSnippetLoading = () => shouldLoadSnippet() && snippet.loading && !snippetData();
  const lastAgentMessage = () => snippetData()?.lastAgentMessage ?? null;
  const lastUserMessage = () => snippetData()?.lastUserMessage ?? null;
  const hasPreview = () => Boolean(lastAgentMessage()?.trim() || lastUserMessage()?.text.trim());

  return (
    <div
      ref={(el) => {
        itemEl = el;
        props.itemRef(el);
      }}
      class="rounded-xl border border-transparent px-3 py-3 transition-colors"
      classList={{
        "border-accent/30 bg-accent/15 text-accent": props.isActive,
        "text-text-primary": !props.isActive,
        "hover:bg-surface-overlay": !props.isActive && props.allowHover,
      }}
      onPointerEnter={props.onPointerEnter}
    >
      <div class="flex flex-col gap-1">
        <div class="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={props.onConfirm}
            class="text-left text-sm font-medium leading-snug"
            classList={{
              "text-accent": props.isActive,
              "text-text-primary hover:text-accent": !props.isActive,
            }}
            aria-current={props.isActive ? "true" : undefined}
            aria-label={props.agent.title || props.agent.id}
          >
            {props.agent.title || props.agent.id}
          </button>
          <Show when={props.isCurrent}>
            <CurrentBadge />
          </Show>
        </div>

        <Show when={snippetData()?.lastMessageAt != null}>
          <span class="text-[11px] text-text-secondary">{formatDateTime(snippetData()?.lastMessageAt ?? 0)}</span>
        </Show>

        <Show
          when={hasPreview()}
          fallback={
            <Show when={isSnippetLoading()} fallback={<div class="h-[2.875rem]" data-snippet-empty="true" />}>
              <div class="space-y-2 pt-0.5" data-snippet-loading="true" aria-hidden="true">
                <div class="h-3 w-24 rounded-full bg-surface-overlay/80" />
                <div class="h-3 w-full rounded-full bg-surface-overlay/80" />
                <div class="h-3 w-2/3 rounded-full bg-surface-overlay/80" />
              </div>
            </Show>
          }
        >
          <div class="mt-1 flex flex-col gap-1.5">
            <Show when={lastAgentMessage()}>
              {(message) => (
                <MessageBubble
                  message={message()}
                  justify="start"
                  background="var(--theme-surface-raised)"
                  boxShadow="0 0 0 1px color-mix(in srgb, var(--theme-border) 50%, transparent)"
                  maxWidth="max-w-[85%]"
                />
              )}
            </Show>
            <Show when={lastUserMessage()}>
              {(message) => (
                <Show
                  when={message().isAgentSent}
                  fallback={
                    <MessageBubble
                      message={message().text}
                      justify="end"
                      background="color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-raised))"
                      boxShadow={`0 0 0 1px color-mix(in srgb, var(--theme-accent) 30%, transparent),
                        0 2px 8px -2px color-mix(in srgb, var(--theme-accent) 20%, transparent)`}
                      maxWidth="max-w-[85%]"
                      gradientBackground={`linear-gradient(to bottom,
                        transparent,
                        color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-raised))
                      )`}
                    />
                  }
                >
                  <MessageBubble message={message().text} {...getAgentSentBubbleProps()} />
                </Show>
              )}
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
};

const SearchResultCard: Component<SearchResultCardProps> = (props) => {
  const baseZIndex = useZIndex();
  const matchCount = () => props.group.matches.length;

  return (
    <div
      ref={props.itemRef}
      class="space-y-2 px-4 py-4 transition-colors"
      classList={{
        "bg-accent/15": props.isActive,
        "hover:bg-surface-overlay": !props.isActive && props.allowHover,
      }}
      onPointerEnter={props.onPointerEnter}
    >
      <div class="flex flex-col gap-0.5">
        <div class="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={props.onConfirm}
            class="text-left text-sm font-medium leading-snug"
            classList={{
              "text-accent": props.isActive,
              "text-text-primary hover:text-accent": !props.isActive,
            }}
            aria-current={props.isActive ? "true" : undefined}
            aria-label={props.group.title ?? props.group.sessionId}
          >
            {props.group.title ?? props.group.sessionId}
          </button>
          <Show when={props.isCurrent}>
            <CurrentBadge />
          </Show>
        </div>
        <span class="text-[11px] text-text-secondary">
          {formatSessionRange(props.group.sessionCreatedAt, props.group.sessionUpdatedAt)}
        </span>
      </div>

      <Popover
        open={props.isPopoverOpen}
        onOpenChange={props.onPopoverOpenChange}
        strategy="fixed"
        floatingOptions={MATCHES_POPOVER_FLOATING_OPTIONS}
      >
        <Popover.Trigger
          as="button"
          type="button"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent transition-colors hover:border-accent/40 hover:bg-accent/20"
          aria-label={`Show ${matchCount()} ${matchCount() === 1 ? "match" : "matches"}`}
        >
          {matchCount()} {matchCount() === 1 ? "match" : "matches"}
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            class="w-[min(calc(100vw-2rem),42rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface-raised shadow-2xl"
            style={{ "z-index": baseZIndex }}
          >
            <div class="border-b border-border bg-surface-raised px-4 py-2.5">
              <span class="text-xs font-medium text-text-secondary">
                {matchCount()} {matchCount() === 1 ? "match" : "matches"}
              </span>
            </div>

            <div class="space-y-4 px-4 py-3">
              <For each={props.group.matches}>
                {(match, index) => (
                  <>
                    <Show when={index() > 0}>
                      <div class="border-t border-border" />
                    </Show>
                    <MatchPair match={match} query={props.query} />
                  </>
                )}
              </For>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover>
    </div>
  );
};

const AgentFinder: Component<AgentFinderProps> = (props) => {
  const { openModal } = useModalRoute();
  const [internalResults, setInternalResults] = createSignal<AgentMessageSearchResult[]>([]);
  const [internalRecentAgents, setInternalRecentAgents] = createSignal<RecentAgentForTypeahead[]>([]);
  const [internalIsSearching, setInternalIsSearching] = createSignal(false);
  const [internalIsLoadingRecent, setInternalIsLoadingRecent] = createSignal(false);
  const [internalSearchError, setInternalSearchError] = createSignal<string | null>(null);
  const [internalHasSearched, setInternalHasSearched] = createSignal(false);
  const [internalActiveIndex, setInternalActiveIndex] = createSignal(-1);
  const [internalPointerMoved, setInternalPointerMoved] = createSignal(false);
  const [internalOpenPopoverIndex, setInternalOpenPopoverIndex] = createSignal<number | null>(null);
  const [internalResultsScrollTop, setInternalResultsScrollTop] = createSignal(0);
  const [resultsScrollRoot, setResultsScrollRoot] = createSignal<HTMLDivElement>();
  const results = () => props.sessionState?.results() ?? internalResults();
  const setResults = props.sessionState?.setResults ?? setInternalResults;
  const recentAgents = () => props.sessionState?.recentAgents() ?? internalRecentAgents();
  const setRecentAgents = props.sessionState?.setRecentAgents ?? setInternalRecentAgents;
  const isSearching = () => props.sessionState?.isSearching() ?? internalIsSearching();
  const setIsSearching = props.sessionState?.setIsSearching ?? setInternalIsSearching;
  const isLoadingRecent = () => props.sessionState?.isLoadingRecent() ?? internalIsLoadingRecent();
  const setIsLoadingRecent = props.sessionState?.setIsLoadingRecent ?? setInternalIsLoadingRecent;
  const searchError = () => props.sessionState?.searchError() ?? internalSearchError();
  const setSearchError = props.sessionState?.setSearchError ?? setInternalSearchError;
  const hasSearched = () => props.sessionState?.hasSearched() ?? internalHasSearched();
  const setHasSearched = props.sessionState?.setHasSearched ?? setInternalHasSearched;
  const activeIndex = () => props.sessionState?.activeIndex() ?? internalActiveIndex();
  const setActiveIndex = props.sessionState?.setActiveIndex ?? setInternalActiveIndex;
  const pointerMoved = () => props.sessionState?.pointerMoved() ?? internalPointerMoved();
  const setPointerMoved = props.sessionState?.setPointerMoved ?? setInternalPointerMoved;
  const openPopoverIndex = () =>
    props.openPopoverIndex?.() ?? props.sessionState?.openPopoverIndex() ?? internalOpenPopoverIndex();
  const setOpenPopoverIndex =
    props.setOpenPopoverIndex ?? props.sessionState?.setOpenPopoverIndex ?? setInternalOpenPopoverIndex;
  const resultsScrollTop = () => props.sessionState?.resultsScrollTop() ?? internalResultsScrollTop();
  const setResultsScrollTop = props.sessionState?.setResultsScrollTop ?? setInternalResultsScrollTop;
  let requestId = 0;
  let recentRequestId = 0;
  const resultItemRefs: Array<HTMLDivElement | undefined> = [];
  let previousVisibleResultKeys: string[] | undefined;

  createEffect(() => {
    const query = props.query.trim();
    if (query) {
      setRecentAgents([]);
      setIsLoadingRecent(false);
      return;
    }

    const thisRequest = ++recentRequestId;
    setIsLoadingRecent(true);

    void fetchRecentAgentsList(props.workspaceId, undefined, RECENT_LIMIT)
      .then((agents) => {
        if (thisRequest !== recentRequestId) return;
        setRecentAgents(agents);
      })
      .catch(() => {
        if (thisRequest !== recentRequestId) return;
        setRecentAgents([]);
      })
      .finally(() => {
        if (thisRequest === recentRequestId) {
          setIsLoadingRecent(false);
        }
      });
  });

  createEffect(() => {
    const query = props.query.trim();

    if (!query) {
      setResults([]);
      setSearchError(null);
      setHasSearched(false);
      return;
    }

    const timerId = setTimeout(async () => {
      const thisRequest = ++requestId;
      setIsSearching(true);
      setSearchError(null);

      try {
        const response = await searchAgentMessages(props.workspaceId, query, SEARCH_LIMIT);
        if (thisRequest !== requestId) return;
        setResults(response.results);
        setHasSearched(true);
      } catch (err) {
        if (thisRequest !== requestId) return;
        setSearchError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      } finally {
        if (thisRequest === requestId) {
          setIsSearching(false);
        }
      }
    }, DEBOUNCE_MS);

    onCleanup(() => clearTimeout(timerId));
  });

  const groupedResults = createMemo((): GroupedResult[] => {
    const map = new Map<string, GroupedResult>();
    const order: string[] = [];

    for (const result of results()) {
      if (!result.agentId) continue;

      const key = result.agentId;
      if (!map.has(key)) {
        order.push(key);
        map.set(key, {
          agentId: result.agentId,
          sessionId: result.sessionId,
          title: result.title,
          sessionCreatedAt: result.sessionCreatedAt,
          sessionUpdatedAt: result.sessionUpdatedAt,
          matches: [],
        });
      }

      map.get(key)?.matches.push(result);
    }

    return order.flatMap((key) => {
      const group = map.get(key);
      return group ? [group] : [];
    });
  });

  const visibleResults = createMemo<VisibleAgentResult[]>(() => {
    if (!props.query.trim()) {
      return recentAgents().map((agent) => ({
        agentId: agent.id,
        title: agent.title,
        kind: "recent",
        recentAgent: agent,
      }));
    }

    return groupedResults().map((group) => ({
      agentId: group.agentId,
      title: group.title,
      kind: "search",
      groupedResult: group,
    }));
  });

  createEffect(() => {
    const keys = visibleResults().map((item) => `${item.kind}:${item.agentId}`);
    if (!previousVisibleResultKeys) {
      previousVisibleResultKeys = keys;
      return;
    }

    if (
      keys.length === previousVisibleResultKeys.length &&
      keys.every((key, index) => key === previousVisibleResultKeys?.[index])
    ) {
      return;
    }

    previousVisibleResultKeys = keys;
    setActiveIndex(-1);
    setOpenPopoverIndex(null);
  });

  createEffect(() => {
    const root = resultsScrollRoot();
    if (!root) return;

    root.scrollTop = resultsScrollTop();

    const handleScroll = () => setResultsScrollTop(root.scrollTop);
    root.addEventListener("scroll", handleScroll, { passive: true });

    onCleanup(() => {
      setResultsScrollTop(root.scrollTop);
      root.removeEventListener("scroll", handleScroll);
    });
  });

  createEffect(() => {
    const idx = activeIndex();
    if (idx < 0) return;

    resultItemRefs[idx]?.scrollIntoView({ block: "nearest" });
  });

  const confirmSelection = (item: VisibleAgentResult | undefined) => {
    if (!item) return;
    props.onConfirm({ agentId: item.agentId, title: item.title });
  };

  const peekSelection = (item: VisibleAgentResult | undefined) => {
    if (!item) return;
    setOpenPopoverIndex(null);
    openModal("agent", item.agentId);
  };

  const syncPopoverToActiveResult = (items: VisibleAgentResult[], nextIndex: number) => {
    if (openPopoverIndex() === null) return;

    // Close current popover immediately, then reopen on the new row after a
    // short delay so Corvu can dismiss cleanly before mounting the next one.
    setOpenPopoverIndex(null);
    if (items[nextIndex]?.kind === "search") {
      setTimeout(() => setOpenPopoverIndex(nextIndex), 50);
    }
  };

  const moveActiveResult = (items: VisibleAgentResult[], nextIndex: number) => {
    setPointerMoved(false);
    setActiveIndex(nextIndex);
    syncPopoverToActiveResult(items, nextIndex);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.interactive) return;

    const items = visibleResults();

    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (activeIndex() + 1) % items.length;
      moveActiveResult(items, next);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = activeIndex() <= 0 ? items.length - 1 : activeIndex() - 1;
      moveActiveResult(items, next);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      const item = items[activeIndex()];
      if (!item) return;
      e.preventDefault();
      confirmSelection(item);
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (!props.interactive) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.code === "ShiftRight") {
      const item = visibleResults()[activeIndex()];
      if (!item) return;
      e.preventDefault();
      setOpenPopoverIndex(null);
      peekSelection(item);
      return;
    }

    // Right Command (Mac) / Right Control (Win/Linux) toggles the matches popover
    // for the active search result, if it has matches.
    if (e.code === "MetaRight" || e.code === "ControlRight") {
      const idx = activeIndex();
      if (idx < 0) return;
      const item = visibleResults()[idx];
      if (!item || item.kind !== "search") return;
      e.preventDefault();
      setOpenPopoverIndex((current) => (current === idx ? null : idx));
    }
  };

  createEffect(() => {
    if (!props.interactive) return;

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    onCleanup(() => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    });
  });

  const confirmHintLabel = () => props.confirmLabel ?? "confirm";

  return (
    <div class="flex flex-1 min-h-0 flex-col" onPointerMove={() => setPointerMoved(true)}>
      <div ref={setResultsScrollRoot} class="flex-1 overflow-y-auto">
        <Show when={isSearching() || isLoadingRecent()}>
          <div class="flex justify-center px-4 py-3">
            <div class="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        </Show>

        <Show when={searchError()}>
          <div class="px-4 py-6 text-center">
            <p class="text-sm text-danger">{searchError()}</p>
          </div>
        </Show>

        <Show when={!searchError() && hasSearched() && groupedResults().length === 0 && !isSearching()}>
          <div class="px-4 py-10 text-center">
            <p class="text-sm text-text-muted">No results found</p>
            <p class="mt-1 text-xs text-text-muted">Try a different search term</p>
          </div>
        </Show>

        <Show when={!props.query.trim() && recentAgents().length > 0}>
          <div class="py-2">
            <SectionHeader label="Recent" />
            <div class="space-y-1 px-2 pb-1">
              <For each={recentAgents()}>
                {(agent, index) => (
                  <RecentAgentCard
                    agent={agent}
                    workspaceId={props.workspaceId}
                    isActive={activeIndex() === index()}
                    allowHover={pointerMoved()}
                    isCurrent={props.currentAgentId === agent.id}
                    interactive={props.interactive}
                    onPointerEnter={() => {
                      if (pointerMoved()) setActiveIndex(index());
                    }}
                    onConfirm={() => confirmSelection(visibleResults()[index()])}
                    itemRef={(el) => {
                      resultItemRefs[index()] = el;
                    }}
                    getObserverRoot={resultsScrollRoot}
                  />
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={!props.query.trim() && !isLoadingRecent() && recentAgents().length === 0}>
          <div class="px-4 py-10 text-center">
            <p class="text-sm text-text-muted">No recent agents</p>
          </div>
        </Show>

        <Show when={groupedResults().length > 0}>
          <div class="divide-y divide-border">
            <For each={groupedResults()}>
              {(group, index) => (
                <SearchResultCard
                  group={group}
                  query={props.query}
                  isActive={activeIndex() === index()}
                  allowHover={pointerMoved()}
                  isCurrent={props.currentAgentId === group.agentId}
                  isPopoverOpen={openPopoverIndex() === index()}
                  onPopoverOpenChange={(open) => {
                    setOpenPopoverIndex(open ? index() : openPopoverIndex() === index() ? null : openPopoverIndex());
                  }}
                  onPointerEnter={() => {
                    if (pointerMoved()) setActiveIndex(index());
                  }}
                  onConfirm={() => confirmSelection(visibleResults()[index()])}
                  itemRef={(el) => {
                    resultItemRefs[index()] = el;
                  }}
                />
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class="flex flex-shrink-0 items-center gap-3 border-t border-border px-4 py-2 text-xs">
        <span class="flex items-center gap-1.5">
          <span class="font-medium text-text-secondary">navigate</span>
          <kbd class="font-mono text-text-muted">↑↓</kbd>
        </span>
        <span class="flex items-center gap-1.5">
          <span class="font-medium text-text-secondary">{confirmHintLabel()}</span>
          <kbd class="font-mono text-text-muted">↵</kbd>
        </span>
        <span class="flex items-center gap-1.5">
          <span class="font-medium text-text-secondary">peek</span>
          <kbd class="font-mono text-text-muted">right ⇧</kbd>
        </span>
        <Show when={groupedResults().length > 0}>
          <span class="flex items-center gap-1.5">
            <span class="font-medium text-text-secondary">matches</span>
            <kbd class="font-mono text-text-muted">right ⌘</kbd>
          </span>
        </Show>
        <span class="flex items-center gap-1.5">
          <span class="font-medium text-text-secondary">dismiss</span>
          <kbd class="font-mono text-text-muted">esc</kbd>
        </span>
      </div>
    </div>
  );
};

export default AgentFinder;
