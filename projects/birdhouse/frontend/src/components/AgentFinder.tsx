// ABOUTME: Shared finder for recent agents and full-text agent search results.
// ABOUTME: Handles keyboard actions, lazy snippets, peek, confirm, and dismissal for both wrappers.

import Popover from "corvu/popover";
import { type Component, createEffect, createMemo, createResource, createSignal, For, onCleanup, Show } from "solid-js";
import { useZIndex } from "../contexts/ZIndexContext";
import { useModalRoute } from "../lib/routing";
import type {
  AgentMessageSearchResult,
  MessagePart,
  RecentAgentForTypeahead,
  RecentAgentSnippet,
} from "../services/agents-api";
import { fetchRecentAgentSnippet, fetchRecentAgentsList, searchAgentMessages } from "../services/agents-api";

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
  onConfirm: (selection: AgentFinderSelection) => void;
  onDismiss: () => void;
}

interface MessagePartsProps {
  parts: MessagePart[];
  role: string;
}

interface MatchPairProps {
  match: AgentMessageSearchResult;
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
  isActive: boolean;
  allowHover: boolean;
  isCurrent: boolean;
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

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
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

function getRecentAgentPreview(snippet: RecentAgentSnippet | null | undefined): string {
  return snippet?.lastAgentMessage ?? snippet?.lastUserMessage?.text ?? "";
}

const CurrentBadge: Component = () => (
  <span class="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-text-secondary">Current</span>
);

const SectionHeader: Component<{ label: string }> = (props) => (
  <div class="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider select-none">
    {props.label}
  </div>
);

const MessageParts: Component<MessagePartsProps> = (props) => {
  const isUser = () => props.role === "user";

  return (
    <div class={`flex ${isUser() ? "justify-end" : "justify-start"}`}>
      <div
        class="max-w-[90%] rounded-xl px-3 py-2 text-sm text-text-primary"
        style={{
          background: isUser()
            ? "color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-raised))"
            : "var(--theme-surface-raised)",
          "box-shadow": isUser()
            ? "0 0 0 1px color-mix(in srgb, var(--theme-accent) 30%, transparent)"
            : "0 0 0 1px color-mix(in srgb, var(--theme-border) 50%, transparent)",
        }}
      >
        <For each={props.parts}>
          {(part) => (
            <Show
              when={part.type === "tool"}
              fallback={
                <p class="whitespace-pre-wrap break-words leading-relaxed">{part.type === "text" ? part.text : ""}</p>
              }
            >
              <div class="space-y-1">
                <div class="text-xs font-mono text-text-secondary">
                  [{part.type === "tool" ? (part as Extract<MessagePart, { type: "tool" }>).toolName : ""}]
                </div>
                <Show when={part.type === "tool" && (part as Extract<MessagePart, { type: "tool" }>).command}>
                  <pre class="overflow-x-auto whitespace-pre-wrap break-words rounded bg-surface-overlay px-2 py-1 font-mono text-xs text-text-primary">
                    {part.type === "tool" ? (part as Extract<MessagePart, { type: "tool" }>).command : ""}
                  </pre>
                </Show>
                <Show when={part.type === "tool" && (part as Extract<MessagePart, { type: "tool" }>).output}>
                  <pre class="max-h-48 overflow-y-auto overflow-x-auto whitespace-pre-wrap break-words rounded bg-surface-overlay px-2 py-1 font-mono text-xs text-text-secondary">
                    {part.type === "tool" ? (part as Extract<MessagePart, { type: "tool" }>).output : ""}
                  </pre>
                </Show>
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
};

const MatchPair: Component<MatchPairProps> = (props) => (
  <div class="space-y-1.5">
    <div class="px-0.5 text-[11px] text-text-secondary">{formatDateTime(props.match.matchedAt)}</div>
    <div class="flex flex-col-reverse gap-2">
      <Show when={props.match.contextMessage}>{(ctx) => <MessageParts parts={ctx().parts} role={ctx().role} />}</Show>
      <MessageParts parts={props.match.matchedMessage.parts} role={props.match.matchedMessage.role} />
    </div>
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
    if (shouldLoadSnippet() || !props.interactive) return;

    const root = props.getObserverRoot();
    if (!root || !itemEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!props.interactive) return;

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
  const preview = () => getRecentAgentPreview(snippetData());
  const hasPreview = () => preview().trim().length > 0;

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
          <p class="line-clamp-2 text-sm leading-relaxed text-text-secondary">{preview()}</p>
        </Show>
      </div>
    </div>
  );
};

const SearchResultCard: Component<SearchResultCardProps> = (props) => {
  const baseZIndex = useZIndex();
  const [isPopoverOpen, setIsPopoverOpen] = createSignal(false);
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

      <Popover open={isPopoverOpen()} onOpenChange={setIsPopoverOpen}>
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
            class="max-h-[60vh] w-[min(calc(100vw-2rem),42rem)] overflow-y-auto rounded-xl border border-border bg-surface-raised shadow-2xl"
            style={{ "z-index": baseZIndex }}
          >
            <div class="sticky top-0 border-b border-border bg-surface-raised px-4 py-2.5">
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
                    <MatchPair match={match} />
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
  const [results, setResults] = createSignal<AgentMessageSearchResult[]>([]);
  const [recentAgents, setRecentAgents] = createSignal<RecentAgentForTypeahead[]>([]);
  const [isSearching, setIsSearching] = createSignal(false);
  const [isLoadingRecent, setIsLoadingRecent] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [hasSearched, setHasSearched] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(-1);
  const [pointerMoved, setPointerMoved] = createSignal(false);
  const [resultsScrollRoot, setResultsScrollRoot] = createSignal<HTMLDivElement>();
  let requestId = 0;
  let recentRequestId = 0;
  let resultItemRefs: Array<HTMLDivElement | undefined> = [];

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

  // Reset active index when results change. Do NOT clear resultItemRefs here —
  // the For loop re-assigns refs as it re-renders, and clearing eagerly causes
  // the scroll effect to fire against a wiped array before refs are restored.
  createEffect(() => {
    visibleResults();
    setActiveIndex(-1);
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
    openModal("agent", item.agentId);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.interactive) return;

    const items = visibleResults();

    if (e.key === "Escape") {
      e.preventDefault();
      props.onDismiss();
      return;
    }

    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPointerMoved(false);
      setActiveIndex((index) => (index + 1) % items.length);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setPointerMoved(false);
      setActiveIndex((index) => (index <= 0 ? items.length - 1 : index - 1));
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
    if (e.code !== "ShiftRight") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const item = visibleResults()[activeIndex()];
    if (!item) return;
    e.preventDefault();
    peekSelection(item);
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
    <div class="flex h-full flex-col" onPointerMove={() => setPointerMoved(true)}>
      <div ref={setResultsScrollRoot} class="flex-1 overflow-y-auto">
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
                  isActive={activeIndex() === index()}
                  allowHover={pointerMoved()}
                  isCurrent={props.currentAgentId === group.agentId}
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
        <span class="flex items-center gap-1.5">
          <span class="font-medium text-text-secondary">dismiss</span>
          <kbd class="font-mono text-text-muted">esc</kbd>
        </span>
      </div>
    </div>
  );
};

export default AgentFinder;
