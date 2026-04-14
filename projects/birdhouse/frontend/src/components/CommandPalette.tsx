// ABOUTME: Command palette modal for quick keyboard-driven access to app actions
// ABOUTME: Groups actions into Navigation (global) and Agent (context-scoped) sections

import Dialog from "corvu/dialog";
import type { LucideProps } from "lucide-solid";
import { Archive, Download, Edit, Notebook, Plus, Search, Settings, Terminal } from "lucide-solid";
import { type Component, createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { buildWorkspaceUrl } from "../config/api";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { isCommandPaletteOpen, setIsCommandPaletteOpen } from "../lib/command-palette-state";
import { useModalRoute, useWorkspaceAgentId } from "../lib/routing";
import { fetchAgent } from "../services/messages-api";
import { cardSurfaceFlat } from "../styles/containerStyles";
import AgentNotesDialog from "./AgentNotesDialog";
import ArchiveAgentDialog from "./ArchiveAgentDialog";
import EditAgentDialog from "./EditAgentDialog";
import UnarchiveAgentDialog from "./UnarchiveAgentDialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaletteAction {
  id: string;
  label: string;
  group: "agent" | "navigation";
  icon?: Component<LucideProps>;
  run: () => void;
}

// ---------------------------------------------------------------------------
// Pure filtering utility (exported for tests)
// ---------------------------------------------------------------------------

/**
 * Filters actions by case-insensitive substring match against label.
 * Returns all actions when query is empty or whitespace.
 */
export function filterActions(actions: PaletteAction[], query: string): PaletteAction[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return actions;
  return actions.filter((a) => a.label.toLowerCase().includes(trimmed));
}

// ---------------------------------------------------------------------------
// Section header sub-component
// ---------------------------------------------------------------------------

const SectionHeader: Component<{ label: string }> = (props) => (
  <div class="px-3 py-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider select-none">
    {props.label}
  </div>
);

// ---------------------------------------------------------------------------
// Individual action row sub-component
// ---------------------------------------------------------------------------

interface ActionRowProps {
  action: PaletteAction;
  isActive: boolean;
  onPointerEnter: () => void;
  onClick: () => void;
  ref?: (el: HTMLButtonElement) => void;
}

const ActionRow: Component<ActionRowProps> = (props) => (
  <button
    ref={props.ref}
    type="button"
    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors"
    classList={{
      "bg-accent/15 text-accent": props.isActive,
      "text-text-primary hover:bg-surface-overlay": !props.isActive,
    }}
    onPointerEnter={props.onPointerEnter}
    onClick={props.onClick}
    tabIndex={-1}
  >
    <Show when={props.action.icon}>
      {(icon) => (
        <span class="flex-shrink-0 opacity-60">
          <Dynamic component={icon()} size={15} />
        </span>
      )}
    </Show>
    <span class="flex-1 truncate">{props.action.label}</span>
  </button>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const CommandPalette: Component = () => {
  const { workspaceId } = useWorkspace();
  const { modalStack, openModal } = useModalRoute();
  const routeAgentId = useWorkspaceAgentId();

  // Derive the topmost agent in context: agent modal stack takes precedence over route
  const topAgentId = createMemo(() => {
    const agentModals = modalStack().filter((m) => m.type === "agent");
    return agentModals.at(-1)?.id ?? routeAgentId();
  });

  // Lazily fetch agent metadata when the palette opens and an agent is in context
  const [agentData] = createResource(
    () => (isCommandPaletteOpen() && topAgentId() ? topAgentId() : null),
    (agentId) => fetchAgent(workspaceId, agentId),
  );

  // Sub-dialog open signals
  const [isEditDialogOpen, setIsEditDialogOpen] = createSignal(false);
  const [isNotesDialogOpen, setIsNotesDialogOpen] = createSignal(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = createSignal(false);
  const [isUnarchiveDialogOpen, setIsUnarchiveDialogOpen] = createSignal(false);
  const [exportError, setExportError] = createSignal<string | null>(null);

  // Query and active index state — reset when palette closes
  const [query, setQuery] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;

  const close = () => setIsCommandPaletteOpen(false);

  const runAction = (action: PaletteAction) => {
    close();
    action.run();
  };

  // ---------------------------------------------------------------------------
  // Export handler (mirrors AgentHeader.handleExportClick)
  // ---------------------------------------------------------------------------

  const handleExport = async () => {
    const agentId = topAgentId();
    if (!agentId) return;
    setExportError(null);

    try {
      const response = await fetch(buildWorkspaceUrl(workspaceId, `/agents/${agentId}/export`));
      if (!response.ok) {
        const ct = response.headers.get("content-type");
        if (ct?.includes("application/json")) {
          const err = await response.json();
          throw new Error(err.error || "Export failed");
        }
        throw new Error(`Export failed: ${response.statusText}`);
      }
      const markdown = await response.text();
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const contentDisposition = response.headers.get("Content-Disposition");
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || "export.md";
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Failed to export agent");
    }
  };

  // ---------------------------------------------------------------------------
  // Action list construction
  // ---------------------------------------------------------------------------

  const allActions = createMemo((): PaletteAction[] => {
    const agentId = topAgentId();
    const agent = agentData();
    const isArchived = agent?.archived_at !== null && agent?.archived_at !== undefined;

    const navigationActions: PaletteAction[] = [
      {
        id: "agent-search",
        label: "Agent Search",
        group: "navigation",
        icon: Search,
        run: () => openModal("agent-search", "main"),
      },
      {
        id: "skills",
        label: "Skills",
        group: "navigation",
        icon: Terminal,
        run: () => openModal("skill-library-v2", "main"),
      },
      {
        id: "new-agent",
        label: "New Agent",
        group: "navigation",
        icon: Plus,
        run: () => {
          window.location.hash = `#/workspace/${workspaceId}/agents`;
        },
      },
      {
        id: "workspace-settings",
        label: "Workspace Settings",
        group: "navigation",
        icon: Settings,
        run: () => openModal("workspace_config", workspaceId),
      },
    ];

    if (!agentId) return navigationActions;

    const agentActions: PaletteAction[] = [
      {
        id: "edit-title",
        label: "Edit Title",
        group: "agent",
        icon: Edit,
        run: () => setTimeout(() => setIsEditDialogOpen(true), 50),
      },
      {
        id: "edit-notes",
        label: "Edit Notes",
        group: "agent",
        icon: Notebook,
        run: () => setTimeout(() => setIsNotesDialogOpen(true), 50),
      },
      ...(isArchived
        ? [
            {
              id: "unarchive-agent",
              label: "Unarchive Agent",
              group: "agent" as const,
              icon: Archive,
              run: () => setTimeout(() => setIsUnarchiveDialogOpen(true), 50),
            },
          ]
        : [
            {
              id: "archive-agent",
              label: "Archive Agent",
              group: "agent" as const,
              icon: Archive,
              run: () => setTimeout(() => setIsArchiveDialogOpen(true), 50),
            },
          ]),
      {
        id: "export-agent",
        label: "Export Agent",
        group: "agent",
        icon: Download,
        run: handleExport,
      },
    ];

    return [...agentActions, ...navigationActions];
  });

  const filteredActions = createMemo(() => filterActions(allActions(), query()));

  // Clamp active index whenever the filtered list changes
  createEffect(() => {
    const max = filteredActions().length - 1;
    if (activeIndex() > max) setActiveIndex(Math.max(0, max));
  });

  // Reset state when palette closes
  createEffect(() => {
    if (!isCommandPaletteOpen()) {
      setQuery("");
      setActiveIndex(0);
    }
  });

  // Focus input when palette opens
  createEffect(() => {
    if (isCommandPaletteOpen()) {
      // Tick after DOM update
      setTimeout(() => inputRef?.focus(), 0);
    }
  });

  // ---------------------------------------------------------------------------
  // Keyboard navigation inside the palette
  // ---------------------------------------------------------------------------

  const handleKeyDown = (e: KeyboardEvent) => {
    const items = filteredActions();
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const action = items[activeIndex()];
      if (action) runAction(action);
    }
  };

  // ---------------------------------------------------------------------------
  // Grouped display
  // ---------------------------------------------------------------------------

  const agentActions = createMemo(() => filteredActions().filter((a) => a.group === "agent"));
  const navigationActions = createMemo(() => filteredActions().filter((a) => a.group === "navigation"));

  // Compute global index offset so active index maps correctly across groups
  const agentOffset = 0;
  const navigationOffset = createMemo(() => agentActions().length);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Dialog
        open={isCommandPaletteOpen()}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        closeOnOutsidePointer={true}
        closeOnOutsideFocus={false}
        preventScroll={false}
      >
        <Dialog.Portal>
          <Dialog.Overlay class="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ "z-index": 9998 }} />
          <Dialog.Content
            class={`fixed ${cardSurfaceFlat} shadow-2xl rounded-2xl
                     w-[95vw] max-w-xl
                     left-1/2 top-[15%] -translate-x-1/2
                     flex flex-col overflow-hidden`}
            style={{ "z-index": 9999 }}
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div class="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
              <Search size={16} class="text-text-muted flex-shrink-0" />
              <input
                ref={(el) => {
                  inputRef = el;
                }}
                type="text"
                value={query()}
                onInput={(e) => {
                  setQuery(e.currentTarget.value);
                  setActiveIndex(0);
                }}
                placeholder="Type a command..."
                class="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted"
                style={{ outline: "none" }}
                aria-label="Command palette search"
              />
            </div>

            {/* Action list */}
            <div class="overflow-y-auto max-h-[60vh] py-2">
              {/* Agent section */}
              <Show when={agentActions().length > 0}>
                <SectionHeader label="Agent" />
                <div class="px-2 pb-1">
                  <For each={agentActions()}>
                    {(action, i) => (
                      <ActionRow
                        action={action}
                        isActive={activeIndex() === agentOffset + i()}
                        onPointerEnter={() => setActiveIndex(agentOffset + i())}
                        onClick={() => runAction(action)}
                      />
                    )}
                  </For>
                </div>
              </Show>

              {/* Navigation section */}
              <Show when={navigationActions().length > 0}>
                <Show when={agentActions().length > 0}>
                  <div class="border-t border-border mx-3 my-1" />
                </Show>
                <SectionHeader label="Navigation" />
                <div class="px-2 pb-1">
                  <For each={navigationActions()}>
                    {(action, i) => (
                      <ActionRow
                        action={action}
                        isActive={activeIndex() === navigationOffset() + i()}
                        onPointerEnter={() => setActiveIndex(navigationOffset() + i())}
                        onClick={() => runAction(action)}
                      />
                    )}
                  </For>
                </div>
              </Show>

              {/* Empty state */}
              <Show when={filteredActions().length === 0}>
                <div class="px-4 py-8 text-center">
                  <p class="text-sm text-text-muted">No commands match "{query()}"</p>
                </div>
              </Show>
            </div>

            {/* Keyboard hint footer */}
            <div class="px-4 py-2 border-t border-border flex-shrink-0 flex items-center gap-4 text-xs text-text-muted">
              <span>
                <kbd class="font-mono">↑↓</kbd> navigate
              </span>
              <span>
                <kbd class="font-mono">↵</kbd> select
              </span>
              <span>
                <kbd class="font-mono">Esc</kbd> close
              </span>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      {/* Agent sub-dialogs — rendered outside the palette Dialog to avoid nesting */}
      <Show when={topAgentId()} keyed>
        {(agentId) => (
          <>
            <EditAgentDialog
              agentId={agentId}
              currentTitle={agentData()?.title ?? ""}
              open={isEditDialogOpen()}
              onOpenChange={setIsEditDialogOpen}
            />
            <AgentNotesDialog
              agentId={agentId}
              workspaceId={workspaceId}
              open={isNotesDialogOpen()}
              onOpenChange={setIsNotesDialogOpen}
            />
            <ArchiveAgentDialog agentId={agentId} open={isArchiveDialogOpen()} onOpenChange={setIsArchiveDialogOpen} />
            <UnarchiveAgentDialog
              agentId={agentId}
              open={isUnarchiveDialogOpen()}
              onOpenChange={setIsUnarchiveDialogOpen}
            />
          </>
        )}
      </Show>

      {/* Export error toast */}
      <Show when={exportError()}>
        <div
          class="fixed bottom-4 right-4 max-w-md p-4 bg-surface-raised border border-danger rounded-lg shadow-2xl"
          style={{ "z-index": 9999 }}
        >
          <div class="flex items-start gap-3">
            <div class="flex-1">
              <p class="text-sm font-medium text-danger mb-1">Export Failed</p>
              <p class="text-sm text-text-secondary">{exportError()}</p>
            </div>
            <button
              type="button"
              onClick={() => setExportError(null)}
              class="text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </div>
      </Show>
    </>
  );
};

export default CommandPalette;
