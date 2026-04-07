// ABOUTME: Modal dialog for searching agent messages by content
// ABOUTME: Shows matched messages with context bubbles, grouped by agent

import Dialog from "corvu/dialog";
import { Search, X } from "lucide-solid";
import { type Component, createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { useWorkspace } from "../contexts/WorkspaceContext";
import type { AgentMessageSearchResult, MessagePart } from "../services/agents-api";
import { searchAgentMessages } from "../services/agents-api";
import { cardSurfaceFlat } from "../styles/containerStyles";

// Compact message bubble for search results — copied from AgentTypeahead's private MessageBubble.
// Uses overflow fade rather than truncation to preserve readability.
interface SearchMessageBubbleProps {
  text: string;
  justify: "start" | "end";
  background: string;
  boxShadow: string;
  gradientBackground: string;
}

const SearchMessageBubble: Component<SearchMessageBubbleProps> = (props) => {
  const [isOverflowing, setIsOverflowing] = createSignal(false);
  let ref: HTMLDivElement | undefined;

  createEffect(() => {
    if (ref) {
      setIsOverflowing(ref.scrollHeight > ref.clientHeight);
    }
  });

  const justifyClass = () => (props.justify === "end" ? "justify-end" : "justify-start");

  return (
    <div class={`flex ${justifyClass()}`}>
      <div
        ref={(el) => {
          ref = el;
        }}
        class="text-xs text-text-primary rounded-xl px-2.5 py-1.5 max-w-[85%] relative"
        style={{
          background: props.background,
          "box-shadow": props.boxShadow,
          "line-height": "1.35",
          "max-height": "4em",
          overflow: "hidden",
        }}
        title={props.text}
      >
        {props.text}
        <Show when={isOverflowing()}>
          <div
            class="absolute bottom-0 left-0 right-0 h-5 pointer-events-none"
            style={{ background: props.gradientBackground }}
          />
        </Show>
      </div>
    </div>
  );
};

// Extract the best plain-text preview from a message's parts array
function extractPreviewText(parts: MessagePart[]): string {
  for (const part of parts) {
    if (part.type === "text" && part.text.trim()) {
      return part.text.trim();
    }
    if (part.type === "tool") {
      if (part.output?.trim()) return `[${part.toolName}] ${part.output.trim()}`;
      if (part.command?.trim()) return `[${part.toolName}] ${part.command.trim()}`;
      return `[${part.toolName}]`;
    }
  }
  return "";
}

function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export interface AgentSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SEARCH_LIMIT = 50;
const DEBOUNCE_MS = 300;

const AgentSearchDialog: Component<AgentSearchDialogProps> = (props) => {
  const { workspaceId } = useWorkspace();

  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<AgentMessageSearchResult[]>([]);
  const [isSearching, setIsSearching] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [hasSearched, setHasSearched] = createSignal(false);

  let inputRef: HTMLInputElement | undefined;

  // Clear state when dialog closes
  createEffect(() => {
    if (!props.open) {
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

  const handleOpenChange = (open: boolean) => {
    props.onOpenChange(open);
  };

  const handleAgentClick = (agentId: string | null) => {
    if (!agentId) return;
    // Close the dialog — navigation happens via the <a> href
    props.onOpenChange(false);
  };

  // Build agent href for navigation
  const agentHref = (agentId: string | null) => {
    if (!agentId) return undefined;
    return `/workspace/${workspaceId}/agent/${agentId}`;
  };

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange} closeOnOutsidePointer={true} preventScroll={false}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" />
        <Dialog.Content
          class={`fixed rounded-2xl ${cardSurfaceFlat} shadow-2xl
                   w-[95vw] max-w-2xl max-h-[85dvh]
                   left-1/2 top-[10%] -translate-x-1/2
                   flex flex-col overflow-hidden z-[100]`}
        >
          {/* Search input header */}
          <div class="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
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
              class="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
              aria-label="Search agent messages"
              data-ph-capture-attribute-element-type="agent-search-dialog-input"
            />
            <Show when={isSearching()}>
              <div class="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent flex-shrink-0" />
            </Show>
            <Show when={query().length > 0 && !isSearching()}>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  if (inputRef) {
                    inputRef.value = "";
                    inputRef.focus();
                  }
                }}
                class="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            </Show>
            <Dialog.Close class="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors ml-1">
              <X size={16} />
            </Dialog.Close>
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

            {/* Idle state — no query typed yet */}
            <Show when={!query().trim() && !hasSearched()}>
              <div class="px-4 py-10 text-center">
                <p class="text-sm text-text-muted">Type to search agent messages</p>
              </div>
            </Show>

            {/* Results list */}
            <Show when={results().length > 0}>
              <div class="divide-y divide-border">
                <For each={results()}>
                  {(result) => <SearchResult result={result} onAgentClick={handleAgentClick} agentHref={agentHref} />}
                </For>
              </div>
            </Show>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

// Single search result row
interface SearchResultProps {
  result: AgentMessageSearchResult;
  onAgentClick: (agentId: string | null) => void;
  agentHref: (agentId: string | null) => string | undefined;
}

const SearchResult: Component<SearchResultProps> = (props) => {
  const contextText = () =>
    props.result.contextMessage ? extractPreviewText(props.result.contextMessage.parts) : null;
  const matchedText = () => extractPreviewText(props.result.matchedMessage.parts);
  const isAssistantMatch = () => props.result.matchedMessage.role === "assistant";

  return (
    <div class="px-4 py-3 hover:bg-surface-overlay transition-colors">
      {/* Agent title + timestamp */}
      <div class="flex items-baseline justify-between gap-2 mb-2">
        <a
          href={props.agentHref(props.result.agentId)}
          onClick={() => props.onAgentClick(props.result.agentId)}
          class="text-xs font-medium text-accent hover:underline truncate flex-1"
          data-agent-id={props.result.agentId}
        >
          {props.result.title}
        </a>
        <span class="text-[10px] text-text-secondary shrink-0">{formatTimestamp(props.result.matchedAt)}</span>
      </div>

      {/* Message bubbles */}
      <div class="flex flex-col gap-1.5">
        {/* Context message (user message before the match) */}
        <Show when={contextText()}>
          {(text) => (
            <SearchMessageBubble
              text={text()}
              justify="end"
              background="color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-raised))"
              boxShadow="0 0 0 1px color-mix(in srgb, var(--theme-accent) 30%, transparent), 0 2px 8px -2px color-mix(in srgb, var(--theme-accent) 20%, transparent)"
              gradientBackground="linear-gradient(to bottom, transparent, color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-raised)))"
            />
          )}
        </Show>

        {/* Matched message */}
        <Show when={matchedText()}>
          {(text) => (
            <SearchMessageBubble
              text={text()}
              justify={isAssistantMatch() ? "start" : "end"}
              background={
                isAssistantMatch()
                  ? "var(--theme-surface-raised)"
                  : "color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-raised))"
              }
              boxShadow={
                isAssistantMatch()
                  ? "0 0 0 1px color-mix(in srgb, var(--theme-border) 50%, transparent)"
                  : "0 0 0 1px color-mix(in srgb, var(--theme-accent) 30%, transparent), 0 2px 8px -2px color-mix(in srgb, var(--theme-accent) 20%, transparent)"
              }
              gradientBackground={
                isAssistantMatch()
                  ? `linear-gradient(to bottom, transparent, var(--theme-surface-raised))`
                  : "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-raised)))"
              }
            />
          )}
        </Show>
      </div>
    </div>
  );
};

export default AgentSearchDialog;
