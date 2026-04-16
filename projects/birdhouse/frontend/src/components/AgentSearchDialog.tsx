// ABOUTME: Modal shell for the shared agent finder search experience.
// ABOUTME: Owns dialog routing, the search input, and confirm-to-navigate behavior.

import { useNavigate } from "@solidjs/router";
import Dialog from "corvu/dialog";
import { Search, X } from "lucide-solid";
import { type Component, createEffect, createMemo, createSignal } from "solid-js";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { useModalRoute, useWorkspaceId } from "../lib/routing";
import type { AgentMessageSearchResult, RecentAgentForTypeahead } from "../services/agents-api";
import { cardSurfaceFlat } from "../styles/containerStyles";
import AgentFinder, { type AgentFinderSelection, type AgentFinderSessionState } from "./AgentFinder";

export const MODAL_TYPE_AGENT_SEARCH = "agent-search";

const AgentSearchDialog: Component = () => {
  const { workspaceId } = useWorkspace();
  const routeWorkspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const { modalStack, removeModalByType } = useModalRoute();

  const isOpen = createMemo(() => modalStack().some((modal) => modal.type === MODAL_TYPE_AGENT_SEARCH));
  const isTopMostSearchDialog = createMemo(() => modalStack().at(-1)?.type === MODAL_TYPE_AGENT_SEARCH);

  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<AgentMessageSearchResult[]>([]);
  const [recentAgents, setRecentAgents] = createSignal<RecentAgentForTypeahead[]>([]);
  const [isSearching, setIsSearching] = createSignal(false);
  const [isLoadingRecent, setIsLoadingRecent] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [hasSearched, setHasSearched] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(-1);
  const [pointerMoved, setPointerMoved] = createSignal(false);
  const [openPopoverIndex, setOpenPopoverIndex] = createSignal<number | null>(null);
  const [resultsScrollTop, setResultsScrollTop] = createSignal(0);
  const [inputRef, setInputRef] = createSignal<HTMLInputElement>();
  let wasTopMostOpen = false;

  const closeSearch = () => removeModalByType(MODAL_TYPE_AGENT_SEARCH);

  createEffect(() => {
    const topMostOpen = isOpen() && isTopMostSearchDialog();
    const input = inputRef();

    if (!topMostOpen || !input) {
      wasTopMostOpen = topMostOpen;
      return;
    }

    if (wasTopMostOpen) return;

    queueMicrotask(() => {
      input.focus();
      if (query()) {
        input.select();
      }
    });

    wasTopMostOpen = topMostOpen;
  });

  const finderSessionState: AgentFinderSessionState = {
    results,
    setResults,
    recentAgents,
    setRecentAgents,
    isSearching,
    setIsSearching,
    isLoadingRecent,
    setIsLoadingRecent,
    searchError,
    setSearchError,
    hasSearched,
    setHasSearched,
    activeIndex,
    setActiveIndex,
    pointerMoved,
    setPointerMoved,
    openPopoverIndex,
    setOpenPopoverIndex,
    resultsScrollTop,
    setResultsScrollTop,
  };

  const handleConfirm = (selection: AgentFinderSelection) => {
    closeSearch();
    navigate(`/workspace/${routeWorkspaceId()}/agent/${selection.agentId}`);
  };

  return (
    <Dialog
      open={isOpen()}
      onOpenChange={(open) => {
        if (!open && modalStack().at(-1)?.type === MODAL_TYPE_AGENT_SEARCH) {
          closeSearch();
        }
      }}
      closeOnEscapeKeyDown={isTopMostSearchDialog()}
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
          <div class="flex items-center gap-2 border-b border-border px-4 py-3 flex-shrink-0">
            <div class="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent">
              <Search size={16} class="text-text-muted flex-shrink-0" />
              <input
                ref={setInputRef}
                type="text"
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
                placeholder="Search messages..."
                class="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted"
                style={{ outline: "none" }}
                aria-label="Search agent messages"
                data-ph-capture-attribute-element-type="agent-search-dialog-input"
              />
            </div>
            <button
              type="button"
              onClick={closeSearch}
              class="flex-shrink-0 text-text-muted transition-colors hover:text-text-primary"
              aria-label="Close search"
            >
              <X size={16} />
            </button>
          </div>

          <AgentFinder
            workspaceId={workspaceId}
            query={query()}
            interactive={isTopMostSearchDialog()}
            confirmLabel="open"
            onConfirm={handleConfirm}
            onDismiss={closeSearch}
            sessionState={finderSessionState}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default AgentSearchDialog;
