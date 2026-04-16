// ABOUTME: Shared finder for recent agents and full-text agent search results.
// ABOUTME: Handles keyboard actions, lazy snippets, peek, confirm, and dismissal for both wrappers.

import Popover from "corvu/popover";
import { type Component, createEffect, createMemo, createResource, createSignal, For, onCleanup, Show } from "solid-js";
import { useZIndex } from "../contexts/ZIndexContext";
import { useModalRoute } from "../lib/routing";
import type { AgentMessageSearchResult, MessagePart, RecentAgentForTypeahead } from "../services/agents-api";
import { fetchRecentAgentSnippet, fetchRecentAgentsList, searchAgentMessages } from "../services/agents-api";
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
  onConfirm: (selection: AgentFinderSelection) => void;
  onDismiss: () => void;
}

interface MatchMessageProps {
  parts: MessagePart[];
  role: string;
  query?: string;
}

interface MatchPairProps {
  match: AgentMessageSearchResult;
}

interface BubbleLayout {
  justify: "start" | "center" | "end";
  background: string;
  boxShadow: string;
  maxWidth: string;
  gradientBackground?: string;
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
const MATCH_CONTEXT_CHARS = 64;
const MATCHES_POPOVER_FLOATING_OPTIONS = {
  offset: 8,
  flip: true,
  shift: { padding: 16 },
  size: { fitViewPort: true, padding: 16 },
} as const;

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

function getAssistantBubbleProps(): BubbleLayout {
  return {
    justify: "start" as const,
    background: "var(--theme-surface-raised)",
    boxShadow: "0 0 0 1px color-mix(in srgb, var(--theme-border) 50%, transparent)",
    maxWidth: "max-w-[85%]",
  };
}

function getUserBubbleProps(): BubbleLayout {
  return {
    justify: "end" as const,
    background: "color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-raised))",
    boxShadow: `0 0 0 1px color-mix(in srgb, var(--theme-accent) 30%, transparent),
      0 2px 8px -2px color-mix(in srgb, var(--theme-accent) 20%, transparent)`,
    maxWidth: "max-w-[85%]",
    gradientBackground: `linear-gradient(to bottom,
      transparent,
      color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-raised))
    )`,
  };
}

function getAgentSentBubbleProps(): BubbleLayout {
  return {
    justify: "center" as const,
    background: `linear-gradient(to right,
      color-mix(in srgb, var(--theme-gradient-from) 20%, var(--theme-surface-raised)),
      color-mix(in srgb, var(--theme-gradient-via) 20%, var(--theme-surface-raised)),
      color-mix(in srgb, var(--theme-gradient-to) 20%, var(--theme-surface-raised))
    )`,
    boxShadow: `0 0 0 1px color-mix(in srgb, var(--theme-gradient-via) 40%, transparent),
      0 2px 8px -2px color-mix(in srgb, var(--theme-gradient-via) 25%, transparent)`,
    maxWidth: "max-w-[90%]",
    gradientBackground: `linear-gradient(to bottom,
      transparent,
      color-mix(in srgb, var(--theme-gradient-via) 20%, var(--theme-surface-raised))
    )`,
  };
}

function getMessageLayout(role: string): BubbleLayout {
  if (role === "user") return getUserBubbleProps();
  if (role === "assistant") return getAssistantBubbleProps();
  return getAssistantBubbleProps();
}

function getJustifyClass(justify: BubbleLayout["justify"]): string {
  switch (justify) {
    case "end":
      return "justify-end";
    case "center":
      return "justify-center";
    default:
      return "justify-start";
  }
}

const CurrentBadge: Component = () => (
  <span class="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-text-secondary">Current</span>
);

const SectionHeader: Component<{ label: string }> = (props) => (
  <div class="px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider select-none">
    {props.label}
  </div>
);

interface SnippetWindowData {
  key: string;
  snippet: string;
  highlightStart?: number;
  highlightEnd?: number;
}

function findMatchIndexes(text: string, query: string): number[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const normalizedText = text.toLowerCase();
  const indexes: number[] = [];
  let fromIndex = 0;

  while (fromIndex < normalizedText.length) {
    const matchIndex = normalizedText.indexOf(normalizedQuery, fromIndex);
    if (matchIndex === -1) break;
    indexes.push(matchIndex);
    fromIndex = matchIndex + normalizedQuery.length;
  }

  return indexes;
}

function trimSnippetStart(text: string, start: number, matchStart: number): number {
  if (start === 0) return 0;

  const whitespaceOffset = text.slice(start, matchStart).search(/\s/);
  return whitespaceOffset === -1 ? start : start + whitespaceOffset + 1;
}

function trimSnippetEnd(text: string, end: number, matchEnd: number): number {
  if (end === text.length) return end;

  const suffix = text.slice(matchEnd, end);
  for (let i = suffix.length - 1; i >= 0; i -= 1) {
    if (/\s/.test(suffix[i] ?? "")) {
      return matchEnd + i;
    }
  }

  return end;
}

function createSnippetWindow(text: string, matchStart: number, matchLength: number, key: string): SnippetWindowData {
  const rawStart = Math.max(0, matchStart - MATCH_CONTEXT_CHARS);
  const rawEnd = Math.min(text.length, matchStart + matchLength + MATCH_CONTEXT_CHARS);

  const start = trimSnippetStart(text, rawStart, matchStart);
  const end = trimSnippetEnd(text, rawEnd, matchStart + matchLength);
  const trimmedStart = start > 0;
  const trimmedEnd = end < text.length;
  const prefix = trimmedStart ? "..." : "";
  const suffix = trimmedEnd ? "..." : "";
  const snippetBody = text.slice(start, end);

  return {
    key,
    snippet: `${prefix}${snippetBody}${suffix}`,
    highlightStart: prefix.length + (matchStart - start),
    highlightEnd: prefix.length + (matchStart - start) + matchLength,
  };
}

function createTextMatchWindows(text: string, query: string, keyPrefix: string): SnippetWindowData[] {
  const matchIndexes = findMatchIndexes(text, query);
  const matchLength = query.trim().length;
  if (matchLength === 0) return [];

  return matchIndexes.map((matchIndex, index) =>
    createSnippetWindow(text, matchIndex, matchLength, `${keyPrefix}-${index}`),
  );
}

function createPreviewWindow(text: string, key: string): SnippetWindowData {
  const maxLength = MATCH_CONTEXT_CHARS * 2;
  const isTrimmed = text.length > maxLength;

  return {
    key,
    snippet: isTrimmed ? `${text.slice(0, maxLength)}...` : text,
  };
}

const HighlightedSnippet: Component<{ snippet: string; highlightStart: number; highlightEnd: number }> = (props) => (
  <span class="whitespace-pre-wrap break-all">
    <span>{props.snippet.slice(0, props.highlightStart)}</span>
    <mark class="rounded bg-accent/20 px-0.5 text-accent font-semibold break-all">
      {props.snippet.slice(props.highlightStart, props.highlightEnd)}
    </mark>
    <span>{props.snippet.slice(props.highlightEnd)}</span>
  </span>
);

const MatchWindow: Component<{
  window: SnippetWindowData;
  monospace?: boolean;
}> = (props) => {
  const hasHighlight = () =>
    props.window.highlightStart !== undefined &&
    props.window.highlightEnd !== undefined &&
    props.window.highlightEnd > props.window.highlightStart;

  return (
    <div
      class="rounded-md bg-surface-overlay/80 px-2.5 py-1.5 text-xs text-text-primary"
      classList={{ "font-mono whitespace-pre-wrap break-words": props.monospace }}
    >
      <Show when={hasHighlight()} fallback={<span class="whitespace-pre-wrap break-all">{props.window.snippet}</span>}>
        <HighlightedSnippet
          snippet={props.window.snippet}
          highlightStart={props.window.highlightStart ?? 0}
          highlightEnd={props.window.highlightEnd ?? 0}
        />
      </Show>
    </div>
  );
};

const MatchMessage: Component<MatchMessageProps> = (props) => {
  const layout = () => getMessageLayout(props.role);
  const query = () => props.query?.trim() ?? "";

  return (
    <div class="space-y-2">
      <For each={props.parts}>
        {(part, index) => {
          if (part.type === "text") {
            const text = part.text;
            if (!query()) {
              return (
                <MessageBubble
                  message={text}
                  justify={layout().justify}
                  background={layout().background}
                  boxShadow={layout().boxShadow}
                  maxWidth={layout().maxWidth}
                  gradientBackground={layout().gradientBackground}
                />
              );
            }

            const windows = createTextMatchWindows(text, query(), `text-${index()}`);
            return (
              <For each={windows}>
                {(window) => (
                  <div class={`flex ${getJustifyClass(layout().justify)}`}>
                    <div
                      class={`${layout().maxWidth} rounded-xl px-3 py-2 text-sm text-text-primary`}
                      style={{
                        background: layout().background,
                        "box-shadow": layout().boxShadow,
                      }}
                    >
                      <MatchWindow window={window} />
                    </div>
                  </div>
                )}
              </For>
            );
          }

          if (!query()) {
            return null;
          }

          const commandWindows = part.command
            ? createTextMatchWindows(part.command, query(), `tool-command-${index()}`)
            : [];
          const outputWindows = part.output
            ? createTextMatchWindows(part.output, query(), `tool-output-${index()}`)
            : [];
          const commandPreviewWindow =
            part.command && commandWindows.length === 0 && outputWindows.length > 0
              ? createPreviewWindow(part.command, `tool-command-preview-${index()}`)
              : null;
          if (commandWindows.length === 0 && outputWindows.length === 0) {
            return null;
          }

          return (
            <div class={`flex ${getJustifyClass(layout().justify)}`}>
              <div
                class={`${layout().maxWidth} rounded-xl px-3 py-2 text-sm text-text-primary`}
                style={{
                  background: layout().background,
                  "box-shadow": layout().boxShadow,
                }}
              >
                <div class="space-y-2">
                  <div class="text-xs font-mono text-text-secondary">[{part.toolName}]</div>
                  <Show when={commandWindows.length > 0 || commandPreviewWindow}>
                    <div class="space-y-1">
                      <div class="px-0.5 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                        Command
                      </div>
                      <Show
                        when={commandWindows.length > 0}
                        fallback={
                          commandPreviewWindow ? <MatchWindow window={commandPreviewWindow} monospace={true} /> : null
                        }
                      >
                        <For each={commandWindows}>{(window) => <MatchWindow window={window} monospace={true} />}</For>
                      </Show>
                    </div>
                  </Show>
                  <Show when={outputWindows.length > 0}>
                    <div class="space-y-1">
                      <div class="px-0.5 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                        Output
                      </div>
                      <For each={outputWindows}>{(window) => <MatchWindow window={window} monospace={true} />}</For>
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
};

const MatchPair: Component<MatchPairProps & { query: string }> = (props) => (
  <div class="space-y-1.5">
    <div class="px-0.5 text-[11px] text-text-secondary">{formatDateTime(props.match.matchedAt)}</div>
    <div class="flex flex-col-reverse gap-2">
      <Show when={props.match.contextMessage}>{(ctx) => <MatchMessage parts={ctx().parts} role={ctx().role} />}</Show>
      <MatchMessage
        parts={props.match.matchedMessage.parts}
        role={props.match.matchedMessage.role}
        query={props.query}
      />
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
  const [results, setResults] = createSignal<AgentMessageSearchResult[]>([]);
  const [recentAgents, setRecentAgents] = createSignal<RecentAgentForTypeahead[]>([]);
  const [isSearching, setIsSearching] = createSignal(false);
  const [isLoadingRecent, setIsLoadingRecent] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [hasSearched, setHasSearched] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(-1);
  const [pointerMoved, setPointerMoved] = createSignal(false);
  const [openPopoverIndex, setOpenPopoverIndex] = createSignal<number | null>(null);
  const [resultsScrollRoot, setResultsScrollRoot] = createSignal<HTMLDivElement>();
  let requestId = 0;
  let recentRequestId = 0;
  const resultItemRefs: Array<HTMLDivElement | undefined> = [];

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
    setOpenPopoverIndex(null);
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

    if (e.key === "Escape") {
      if (openPopoverIndex() !== null) {
        return;
      }
      e.preventDefault();
      props.onDismiss();
      return;
    }

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
