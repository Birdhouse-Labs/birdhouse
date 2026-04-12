// ABOUTME: Modal dialog for searching agent messages by content
// ABOUTME: Shows results grouped by agent with a match-count popover for each

import Dialog from "corvu/dialog";
import Popover from "corvu/popover";
import { Search, X } from "lucide-solid";
import { type Component, createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { useZIndex } from "../contexts/ZIndexContext";
import { useModalRoute } from "../lib/routing";
import type { AgentMessageSearchResult, MessagePart } from "../services/agents-api";
import { searchAgentMessages } from "../services/agents-api";
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

const SEARCH_LIMIT = 50;
const DEBOUNCE_MS = 300;

const AgentSearchDialog: Component = () => {
  const { workspaceId } = useWorkspace();
  const { modalStack, removeModalByType, openModal } = useModalRoute();

  const isOpen = createMemo(() => modalStack().some((m) => m.type === MODAL_TYPE_AGENT_SEARCH));

  const closeSearch = () => removeModalByType(MODAL_TYPE_AGENT_SEARCH);

  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<AgentMessageSearchResult[]>([]);
  const [isSearching, setIsSearching] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [hasSearched, setHasSearched] = createSignal(false);
  let requestId = 0;

  let inputRef: HTMLInputElement | undefined;

  // Clear state when dialog closes
  createEffect(() => {
    if (!isOpen()) {
      requestId += 1;
      setQuery("");
      if (inputRef) inputRef.value = "";
      setResults([]);
      setIsSearching(false);
      setSearchError(null);
      setHasSearched(false);
    }
  });

  // Debounced search
  createEffect(() => {
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
              <Show when={isSearching()}>
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
          <div class="flex-1 overflow-y-auto">
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

            {/* Idle state — nothing typed yet */}
            <Show when={!query().trim() && !hasSearched()}>
              <div class="px-4 py-10 text-center">
                <p class="text-sm text-text-muted">Type to search agent messages</p>
              </div>
            </Show>

            {/* Results */}
            <Show when={groupedResults().length > 0}>
              <div class="divide-y divide-border">
                <For each={groupedResults()}>
                  {(group) => (
                    <SearchResultCard
                      group={group}
                      onAgentClick={(e) => handleAgentClick(group.agentId, e)}
                      agentHref={agentHref(group.agentId)}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

interface SearchResultCardProps {
  group: GroupedResult;
  onAgentClick: (e: MouseEvent) => void;
  agentHref: string | undefined;
}

const SearchResultCard: Component<SearchResultCardProps> = (props) => {
  const baseZIndex = useZIndex();
  const [isPopoverOpen, setIsPopoverOpen] = createSignal(false);
  const matchCount = () => props.group.matches.length;

  return (
    <div class="px-4 py-4 space-y-2">
      {/* Agent title + session date range */}
      <div class="flex flex-col gap-0.5">
        <a
          href={props.agentHref}
          onClick={(e) => props.onAgentClick(e)}
          class="text-sm font-medium text-accent hover:underline leading-snug"
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
