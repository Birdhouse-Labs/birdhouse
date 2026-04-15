// ABOUTME: Modal dialog for searching agent messages by content
// ABOUTME: Shows results grouped by agent with a match-count popover for each

import { useNavigate } from "@solidjs/router";
import Dialog from "corvu/dialog";
import Popover from "corvu/popover";
import { Search, X } from "lucide-solid";
import { type Component, createEffect, createMemo, createResource, createSignal, For, onCleanup, Show } from "solid-js";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { useZIndex } from "../contexts/ZIndexContext";
import { useModalRoute, useWorkspaceId } from "../lib/routing";
import type {
  AgentMessageSearchResult,
  MessagePart,
  RecentAgentForTypeahead,
  RecentAgentSnippet,
} from "../services/agents-api";
import { fetchRecentAgentSnippet, fetchRecentAgentsList, searchAgentMessages } from "../services/agents-api";
import { cardSurfaceFlat } from "../styles/containerStyles";

export const MODAL_TYPE_AGENT_SEARCH = "agent-search";

// Format an absolute timestamp as a human-readable date+time
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

// Format a date range, always showing both endpoints:
// Same day:  "Mar 9, 2026, 8:53 AM – 9:46 AM"
// Different: "Mar 8, 2026, 11:31 PM – Mar 9, 2026, 12:11 AM"
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
    // Show date once, append only the end time
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

// Render all meaningful parts of a message — full text, tool names, commands, outputs
// No truncation or overflow fade; this is a search result, not a preview
interface MessagePartsProps {
  parts: MessagePart[];
  role: string;
}

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
                // Text part — render as-is, preserve newlines
                <p class="whitespace-pre-wrap break-words leading-relaxed">{part.type === "text" ? part.text : ""}</p>
              }
            >
              {/* Tool part */}
              <div class="space-y-1">
                <div class="text-xs font-mono text-text-secondary">
                  [{part.type === "tool" ? (part as Extract<MessagePart, { type: "tool" }>).toolName : ""}]
                </div>
                <Show when={part.type === "tool" && (part as Extract<MessagePart, { type: "tool" }>).command}>
                  <pre class="text-xs font-mono bg-surface-overlay rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-words text-text-primary">
                    {part.type === "tool" ? (part as Extract<MessagePart, { type: "tool" }>).command : ""}
                  </pre>
                </Show>
                <Show when={part.type === "tool" && (part as Extract<MessagePart, { type: "tool" }>).output}>
                  <pre class="text-xs font-mono bg-surface-overlay rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-words text-text-secondary max-h-48 overflow-y-auto">
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

// A single matched message paired with its preceding context message
interface MatchPairProps {
  match: AgentMessageSearchResult;
}

const MatchPair: Component<MatchPairProps> = (props) => {
  return (
    <div class="space-y-1.5">
      {/* Timestamp for this specific match */}
      <div class="text-[11px] text-text-secondary px-0.5">{formatDateTime(props.match.matchedAt)}</div>

      {/* Bubbles — newest on top (Birdhouse convention) */}
      <div class="flex flex-col-reverse gap-2">
        {/* Context message — older user turn, renders below */}
        <Show when={props.match.contextMessage}>{(ctx) => <MessageParts parts={ctx().parts} role={ctx().role} />}</Show>

        {/* Matched message — newer, renders on top */}
        <MessageParts parts={props.match.matchedMessage.parts} role={props.match.matchedMessage.role} />
      </div>
    </div>
  );
};

// One result per agent: all matches from the same agent session
interface GroupedResult {
  agentId: string | null;
  sessionId: string;
  title: string;
  sessionCreatedAt: number;
  sessionUpdatedAt: number;
  matches: AgentMessageSearchResult[];
}

interface VisibleAgentResult {
  agentId: string | null;
}

const SEARCH_LIMIT = 50;
const RECENT_LIMIT = 50;
const DEBOUNCE_MS = 300;

const SectionHeader: Component<{ label: string }> = (props) => (
  <div class="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider select-none">
    {props.label}
  </div>
);

function getRecentAgentPreview(snippet: RecentAgentSnippet | null | undefined): string {
  return snippet?.lastAgentMessage ?? snippet?.lastUserMessage?.text ?? "";
}

const AgentSearchDialog: Component = () => {
  const { workspaceId } = useWorkspace();
  const routeWorkspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const { modalStack, removeModalByType, openModal } = useModalRoute();

  const isOpen = createMemo(() => modalStack().some((m) => m.type === MODAL_TYPE_AGENT_SEARCH));
  const isTopMostSearchDialog = createMemo(() => modalStack().at(-1)?.type === MODAL_TYPE_AGENT_SEARCH);

  const closeSearch = () => removeModalByType(MODAL_TYPE_AGENT_SEARCH);

  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<AgentMessageSearchResult[]>([]);
  const [recentAgents, setRecentAgents] = createSignal<RecentAgentForTypeahead[]>([]);
  const [isSearching, setIsSearching] = createSignal(false);
  const [isLoadingRecent, setIsLoadingRecent] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [hasSearched, setHasSearched] = createSignal(false);
  // -1 means no result is keyboard-selected
  const [activeIndex, setActiveIndex] = createSignal(-1);
  // Tracks whether the pointer has physically moved since the last keyboard navigation.
  // Prevents pointer-enter from overwriting keyboard selection during arrow key navigation.
  const [pointerMoved, setPointerMoved] = createSignal(false);
  let requestId = 0;
  let recentRequestId = 0;

  let inputRef: HTMLInputElement | undefined;
  let resultItemRefs: Array<HTMLDivElement | undefined> = [];
  const [resultsScrollRoot, setResultsScrollRoot] = createSignal<HTMLDivElement>();

  // Clear state when dialog closes
  createEffect(() => {
    if (!isOpen()) {
      requestId += 1;
      setQuery("");
      if (inputRef) inputRef.value = "";
      setResults([]);
      setRecentAgents([]);
      setIsSearching(false);
      setIsLoadingRecent(false);
      setSearchError(null);
      setHasSearched(false);
    }
  });

  createEffect(() => {
    if (!isOpen()) return;

    const thisRequest = ++recentRequestId;
    setIsLoadingRecent(true);

    void fetchRecentAgentsList(workspaceId, undefined, RECENT_LIMIT)
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

  // Debounced search
  createEffect(() => {
    if (!isOpen()) return;

    const q = query().trim();

    if (!q) {
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
        const response = await searchAgentMessages(workspaceId, q, SEARCH_LIMIT);
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

  // Group flat results by agent — preserves order of first appearance
  const groupedResults = createMemo((): GroupedResult[] => {
    const raw = results();
    const map = new Map<string, GroupedResult>();
    const order: string[] = [];

    for (const result of raw) {
      const key = result.agentId ?? result.sessionId;
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
      // biome-ignore lint/style/noNonNullAssertion: key was just inserted above
      map.get(key)!.matches.push(result);
    }

    return order.map((key) => map.get(key) as GroupedResult);
  });

  const visibleResults = createMemo<VisibleAgentResult[]>(() => {
    if (!query().trim()) {
      return recentAgents().map((agent) => ({ agentId: agent.id }));
    }

    return groupedResults().map((group) => ({ agentId: group.agentId }));
  });

  // Reset keyboard selection whenever results change
  createEffect(() => {
    visibleResults();
    setActiveIndex(-1);
  });

  // Also reset when dialog closes
  createEffect(() => {
    if (!isOpen()) {
      setActiveIndex(-1);
      resultItemRefs = [];
    }
  });

  createEffect(() => {
    const idx = activeIndex();
    if (idx < 0) return;

    resultItemRefs[idx]?.scrollIntoView({ block: "nearest" });
  });

  const handleAgentClick = (agentId: string | null, e: MouseEvent) => {
    if (!agentId) return;
    // Let Cmd/Ctrl+click fall through to the browser for new-tab behavior
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    openModal("agent", agentId);
  };

  const agentHref = (agentId: string | null) => {
    if (!agentId) return undefined;
    return `/workspace/${workspaceId}/agent/${agentId}`;
  };

  // Keyboard navigation: arrow up/down moves through grouped results;
  // Enter opens the active result directly; Right Shift peeks (opens in modal).
  const handleKeyDown = (e: KeyboardEvent) => {
    const items = visibleResults();
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPointerMoved(false);
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPointerMoved(false);
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      const idx = activeIndex();
      if (idx < 0) return;
      const item = items[idx];
      if (!item?.agentId) return;
      e.preventDefault();
      // Enter always opens directly
      closeSearch();
      navigate(`/workspace/${routeWorkspaceId()}/agent/${item.agentId}`);
    }
  };

  // Right Shift peeks the active result in a modal (keyup so held shift doesn't repeat)
  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.code !== "ShiftRight") return;
    // Ignore if any other modifier is held
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const items = visibleResults();
    const idx = activeIndex();
    if (idx < 0 || items.length === 0) return;
    const item = items[idx];
    if (!item?.agentId) return;
    e.preventDefault();
    openModal("agent", item.agentId);
  };

  return (
    <Dialog
      open={isOpen()}
      onOpenChange={(open) => {
        // Only close search when it is the top-most modal layer.
        // When an agent modal above us closes via Escape, Corvu fires
        // onOpenChange(false) on every dialog below it. We ignore those
        // by checking that nothing sits above the search entry in the stack.
        if (!open && modalStack().at(-1)?.type === MODAL_TYPE_AGENT_SEARCH) {
          closeSearch();
        }
      }}
      closeOnOutsidePointer={false}
      closeOnOutsideFocus={false}
      preventScroll={false}
    >
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[40]" />
        <Dialog.Content
          class={`fixed rounded-2xl ${cardSurfaceFlat} shadow-2xl
                   w-[95vw] max-w-2xl max-h-[85dvh]
                   left-1/2 top-[8%] -translate-x-1/2
                   flex flex-col overflow-hidden z-[40]`}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onPointerMove={() => setPointerMoved(true)}
        >
          {/* Search input header */}
          <div class="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
            {/* Input box styled like the chat composer */}
            <div class="flex-1 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:ring-2 focus-within:ring-accent focus-within:border-accent">
              <Search size={16} class="text-text-muted flex-shrink-0" />
              <input
                ref={(el) => {
                  inputRef = el;
                }}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autofocus
                type="text"
                onInput={(e) => setQuery(e.currentTarget.value)}
                placeholder="Search messages..."
                class="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted"
                style={{ outline: "none" }}
                aria-label="Search agent messages"
                data-ph-capture-attribute-element-type="agent-search-dialog-input"
              />
              <Show when={isSearching() || isLoadingRecent()}>
                <div class="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent flex-shrink-0" />
              </Show>
            </div>
            {/* Close button — outside the input box */}
            <button
              type="button"
              onClick={closeSearch}
              class="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
              aria-label="Close search"
            >
              <X size={16} />
            </button>
          </div>

          {/* Results area */}
          <div ref={setResultsScrollRoot} class="flex-1 overflow-y-auto">
            {/* Error state */}
            <Show when={searchError()}>
              <div class="px-4 py-6 text-center">
                <p class="text-sm text-danger">{searchError()}</p>
              </div>
            </Show>

            {/* Empty state after search */}
            <Show when={!searchError() && hasSearched() && groupedResults().length === 0 && !isSearching()}>
              <div class="px-4 py-10 text-center">
                <p class="text-sm text-text-muted">No results found</p>
                <p class="text-xs text-text-muted mt-1">Try a different search term</p>
              </div>
            </Show>

            {/* Recent agents */}
            <Show when={!query().trim() && recentAgents().length > 0}>
              <div class="py-2">
                <SectionHeader label="Recent" />
                <div class="px-2 pb-1 space-y-1">
                  <For each={recentAgents()}>
                    {(agent, index) => (
                      <RecentAgentCard
                        agent={agent}
                        onAgentClick={(e) => handleAgentClick(agent.id, e)}
                        onPointerEnter={() => {
                          if (pointerMoved()) setActiveIndex(index());
                        }}
                        itemRef={(el) => {
                          resultItemRefs[index()] = el;
                        }}
                        agentHref={agentHref(agent.id)}
                        isActive={activeIndex() === index()}
                        allowHover={pointerMoved()}
                        workspaceId={workspaceId}
                        getObserverRoot={resultsScrollRoot}
                        isSnippetLoadingEnabled={isTopMostSearchDialog}
                      />
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Empty recent state */}
            <Show when={!query().trim() && !isLoadingRecent() && recentAgents().length === 0}>
              <div class="px-4 py-10 text-center">
                <p class="text-sm text-text-muted">No recent agents</p>
              </div>
            </Show>

            {/* Results */}
            <Show when={groupedResults().length > 0}>
              <div class="divide-y divide-border">
                <For each={groupedResults()}>
                  {(group, index) => (
                    <SearchResultCard
                      group={group}
                      onAgentClick={(e) => handleAgentClick(group.agentId, e)}
                      onPointerEnter={() => {
                        if (pointerMoved()) setActiveIndex(index());
                      }}
                      itemRef={(el) => {
                        resultItemRefs[index()] = el;
                      }}
                      agentHref={agentHref(group.agentId)}
                      isActive={activeIndex() === index()}
                      allowHover={pointerMoved()}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div class="px-4 py-2 border-t border-border flex-shrink-0 flex items-center gap-3 text-xs">
            <span class="flex items-center gap-1.5">
              <span class="font-medium text-text-secondary">navigate</span>
              <kbd class="font-mono text-text-muted">↑↓</kbd>
            </span>
            <span class="flex items-center gap-1.5">
              <span class="font-medium text-text-secondary">open</span>
              <kbd class="font-mono text-text-muted">↵</kbd>
            </span>
            <span class="flex items-center gap-1.5">
              <span class="font-medium text-text-secondary">peek</span>
              <kbd class="font-mono text-text-muted">right ⇧</kbd>
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

interface SearchResultCardProps {
  group: GroupedResult;
  onAgentClick: (e: MouseEvent) => void;
  onPointerEnter: () => void;
  itemRef: (el: HTMLDivElement) => void;
  agentHref: string | undefined;
  isActive: boolean;
  allowHover: boolean;
}

interface RecentAgentCardProps {
  agent: RecentAgentForTypeahead;
  onAgentClick: (e: MouseEvent) => void;
  onPointerEnter: () => void;
  itemRef: (el: HTMLDivElement) => void;
  agentHref: string | undefined;
  isActive: boolean;
  allowHover: boolean;
  workspaceId: string;
  getObserverRoot: () => HTMLDivElement | undefined;
  isSnippetLoadingEnabled: () => boolean;
}

const RecentAgentCard: Component<RecentAgentCardProps> = (props) => {
  let itemEl: HTMLDivElement | undefined;
  const [shouldLoadSnippet, setShouldLoadSnippet] = createSignal(false);
  const [snippet] = createResource(
    () => (shouldLoadSnippet() ? props.agent.id : undefined),
    async (agentId) => fetchRecentAgentSnippet(props.workspaceId, agentId),
  );

  createEffect(() => {
    if (shouldLoadSnippet() || !props.isSnippetLoadingEnabled()) return;

    const root = props.getObserverRoot();
    if (!root || !itemEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!props.isSnippetLoadingEnabled()) return;

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
        "bg-accent/15 text-accent border-accent/30": props.isActive,
        "text-text-primary": !props.isActive,
        "hover:bg-surface-overlay": !props.isActive && props.allowHover,
      }}
      onPointerEnter={props.onPointerEnter}
    >
      <div class="flex flex-col gap-1">
        <a
          href={props.agentHref}
          onClick={(e) => props.onAgentClick(e)}
          class="text-sm font-medium leading-snug"
          classList={{
            "text-accent": props.isActive,
            "text-text-primary hover:text-accent": !props.isActive,
          }}
          aria-current={props.isActive ? "true" : undefined}
          data-agent-id={props.agent.id}
        >
          {props.agent.title || props.agent.id}
        </a>
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
          <p class="text-sm text-text-secondary leading-relaxed line-clamp-2">{preview()}</p>
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
      class="px-4 py-4 space-y-2 transition-colors"
      classList={{
        "bg-accent/15": props.isActive,
        "hover:bg-surface-overlay": !props.isActive && props.allowHover,
      }}
      onPointerEnter={props.onPointerEnter}
    >
      {/* Agent title + session date range */}
      <div class="flex flex-col gap-0.5">
        <a
          href={props.agentHref}
          onClick={(e) => props.onAgentClick(e)}
          class="text-sm font-medium leading-snug"
          classList={{
            "text-accent": props.isActive,
            "text-text-primary hover:text-accent": !props.isActive,
          }}
          aria-current={props.isActive ? "true" : undefined}
          data-agent-id={props.group.agentId}
        >
          {props.group.title ?? props.group.sessionId}
        </a>
        <span class="text-[11px] text-text-secondary">
          {formatSessionRange(props.group.sessionCreatedAt, props.group.sessionUpdatedAt)}
        </span>
      </div>

      {/* Match count badge — opens popover with all matches */}
      <Popover open={isPopoverOpen()} onOpenChange={setIsPopoverOpen}>
        <Popover.Trigger
          as="button"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium
                 bg-accent/10 text-accent border border-accent/20
                 hover:bg-accent/20 hover:border-accent/40 transition-colors cursor-pointer"
          aria-label={`Show ${matchCount()} ${matchCount() === 1 ? "match" : "matches"}`}
        >
          {matchCount()} {matchCount() === 1 ? "match" : "matches"}
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            class="rounded-xl border border-border bg-surface-raised shadow-2xl
                   w-[min(calc(100vw-2rem),42rem)]
                   max-h-[60vh] overflow-y-auto"
            style={{ "z-index": baseZIndex }}
          >
            {/* Sticky header showing match count */}
            <div class="sticky top-0 bg-surface-raised border-b border-border px-4 py-2.5">
              <span class="text-xs font-medium text-text-secondary">
                {matchCount()} {matchCount() === 1 ? "match" : "matches"}
              </span>
            </div>

            {/* Match pairs — each with timestamp and bubble pair */}
            <div class="px-4 py-3 space-y-4">
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

export default AgentSearchDialog;
