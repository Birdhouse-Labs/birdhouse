// ABOUTME: Modal dialog for searching agent messages by content
// ABOUTME: Shows full matched messages with tool calls, context, and session date range

import Dialog from "corvu/dialog";
import { Search, X } from "lucide-solid";
import { type Component, createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { useWorkspace } from "../contexts/WorkspaceContext";
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

// Format a date range: "Mar 10, 2026 – Apr 7, 2026" or just one date if same day
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

  // If same calendar day, just show one datetime
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  ) {
    return startStr;
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
                <p class="whitespace-pre-wrap break-words leading-relaxed">
                  {part.type === "text" ? part.text : ""}
                </p>
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

  let inputRef: HTMLInputElement | undefined;

  // Clear state when dialog closes
  createEffect(() => {
    if (!isOpen()) {
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
      setIsSearching(true);
      setSearchError(null);

      try {
        const response = await searchAgentMessages(workspaceId, q, SEARCH_LIMIT);
        setResults(response.results);
        setHasSearched(true);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    onCleanup(() => clearTimeout(timerId));
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
                class="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none focus:outline-none focus:ring-0"
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
            <Show when={!searchError() && hasSearched() && results().length === 0 && !isSearching()}>
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
            <Show when={results().length > 0}>
              <div class="divide-y divide-border">
                <For each={results()}>
                  {(result) => (
            <SearchResultCard
                  result={result}
                  onAgentClick={(e) => handleAgentClick(result.agentId, e)}
                  agentHref={agentHref(result.agentId)}
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
  result: AgentMessageSearchResult;
  onAgentClick: (e: MouseEvent) => void;
  agentHref: string | undefined;
}

const SearchResultCard: Component<SearchResultCardProps> = (props) => {
  return (
    <div class="px-4 py-4 space-y-3">
      {/* Agent title + session date range */}
      <div class="flex flex-col gap-0.5">
        <a
          href={props.agentHref}
          onClick={(e) => props.onAgentClick(e)}
          class="text-sm font-medium text-accent hover:underline leading-snug"
          data-agent-id={props.result.agentId}
        >
          {props.result.title ?? props.result.sessionId}
        </a>
        <span class="text-[11px] text-text-secondary">
          {formatSessionRange(props.result.sessionCreatedAt, props.result.sessionUpdatedAt)}
          {" · matched "}
          {formatDateTime(props.result.matchedAt)}
        </span>
      </div>

      {/* Messages — newest on top, oldest on bottom (matches Birdhouse chat direction) */}
      <div class="flex flex-col-reverse gap-2">
        {/* Context message — the older user turn that preceded the match, renders below */}
        <Show when={props.result.contextMessage}>
          {(ctx) => <MessageParts parts={ctx().parts} role={ctx().role} />}
        </Show>

        {/* Matched message — newer, renders on top */}
        <MessageParts
          parts={props.result.matchedMessage.parts}
          role={props.result.matchedMessage.role}
        />
      </div>
    </div>
  );
};

export default AgentSearchDialog;
