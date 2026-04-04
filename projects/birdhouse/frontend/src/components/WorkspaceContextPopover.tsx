// ABOUTME: Popover showing current workspace context with workspace switcher
// ABOUTME: Displays current workspace name, lists all workspaces, includes Playground option

import { useLocation } from "@solidjs/router";
import Popover from "corvu/popover";
import { ChevronDown, Settings } from "lucide-solid";
import { type Component, createEffect, createResource, createSignal, For, Show } from "solid-js";
import { useConfig } from "../contexts/ConfigContext";
import { useZIndex } from "../contexts/ZIndexContext";
import { PlaygroundIcon, WorkspaceIcon } from "../design-system";
import { useModalRoute, useWorkspaceId } from "../lib/routing";
import { fetchWorkspace, fetchWorkspaces, fetchWorkspacesHealth } from "../services/workspaces-api";
import type { Workspace, WorkspaceHealthResponse } from "../types/workspace";
import { shortenPath } from "../utils/paths";

/**
 * Get display name for a workspace
 * Uses title if set, otherwise falls back to directory basename
 */
function getWorkspaceDisplayName(workspace: Workspace): string {
  if (workspace.title) {
    return workspace.title;
  }
  // Fall back to directory basename
  return workspace.directory.split("/").pop() || workspace.directory;
}

/**
 * Health status dot component
 */
const HealthDot: Component<{ health: WorkspaceHealthResponse | undefined; isLoading: boolean }> = (props) => {
  const colorClass = () => {
    if (props.isLoading || !props.health) {
      return "text-text-muted";
    }
    return props.health.harnessRunning ? "text-success" : "text-danger";
  };

  return <span class={`text-xs ${colorClass()}`}>●</span>;
};

const WorkspaceContextPopover: Component = () => {
  const location = useLocation();
  const workspaceId = useWorkspaceId();
  const baseZIndex = useZIndex();
  const config = useConfig();
  const { openModal } = useModalRoute();
  const [isOpen, setIsOpen] = createSignal(false);

  // Determine current context
  const isPlayground = () => location.pathname.includes("/playground");
  const isInWorkspace = () => !!workspaceId();

  // Fetch current workspace details (only when we have a workspaceId)
  const [currentWorkspace] = createResource(
    () => (isOpen() || isInWorkspace() ? workspaceId() : null),
    async (id) => {
      if (!id) return null;
      try {
        return await fetchWorkspace(id);
      } catch {
        return null;
      }
    },
  );

  // Fetch all workspaces when popover opens
  const [allWorkspaces, { refetch: refetchWorkspaces }] = createResource(
    () => isOpen(),
    async (open) => {
      if (!open) return [];
      try {
        return await fetchWorkspaces();
      } catch {
        return [];
      }
    },
  );

  // Fetch health status when popover opens
  const [healthStatuses, { refetch: refetchHealth }] = createResource(
    () => isOpen(),
    async (open) => {
      if (!open) return new Map<string, WorkspaceHealthResponse>();
      try {
        const health = await fetchWorkspacesHealth();
        const map = new Map<string, WorkspaceHealthResponse>();
        for (const h of health) {
          map.set(h.workspaceId, h);
        }
        return map;
      } catch {
        return new Map<string, WorkspaceHealthResponse>();
      }
    },
  );

  // Refetch data when popover opens
  createEffect(() => {
    if (isOpen()) {
      refetchWorkspaces();
      refetchHealth();
    }
  });

  // Current context display text
  const contextDisplayText = () => {
    if (isPlayground()) {
      return "Playground";
    }
    const workspace = currentWorkspace();
    if (workspace) {
      return getWorkspaceDisplayName(workspace);
    }
    if (isInWorkspace()) {
      // Still loading, show workspace ID as fallback
      return workspaceId() || "—";
    }
    // Not in playground or workspace
    return "—";
  };

  // Sort workspaces by last_used (most recent first)
  const sortedWorkspaces = () => {
    const workspaces = allWorkspaces() || [];
    return [...workspaces].sort((a, b) => b.last_used - a.last_used);
  };

  return (
    <Popover open={isOpen()} onOpenChange={setIsOpen}>
      <Popover.Trigger class="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all hover:bg-surface-overlay text-text-secondary text-sm">
        <WorkspaceIcon size={16} />
        <span class="max-w-32 truncate">{contextDisplayText()}</span>
        <ChevronDown size={14} class="text-text-muted" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          class="w-72 max-h-96 overflow-y-auto rounded-xl border shadow-2xl bg-surface-raised border-border"
          style={{ "z-index": baseZIndex }}
        >
          {/* Workspaces Section */}
          <div class="p-2">
            <Show
              when={!allWorkspaces.loading && sortedWorkspaces().length > 0}
              fallback={
                <div class="px-3 py-2 text-sm text-text-muted">
                  {allWorkspaces.loading ? "Loading..." : "No workspaces"}
                </div>
              }
            >
              <For each={sortedWorkspaces()}>
                {(workspace) => {
                  const isCurrent = () => workspace.workspace_id === workspaceId();
                  const health = () => healthStatuses()?.get(workspace.workspace_id);

                  const workspaceInfo = () => (
                    <>
                      <HealthDot health={health()} isLoading={healthStatuses.loading} />
                      <div class="flex-1 min-w-0">
                        <div
                          class="text-sm font-medium truncate"
                          classList={{
                            "text-accent": isCurrent(),
                            "text-text-primary": !isCurrent(),
                          }}
                        >
                          {getWorkspaceDisplayName(workspace)}
                        </div>
                        <div class="text-xs text-text-muted truncate">{shortenPath(workspace.directory)}</div>
                      </div>
                    </>
                  );

                  const openSettings = () => {
                    setIsOpen(false);
                    // Delay to let the popover's outside-click handling settle before mounting the modal
                    setTimeout(() => openModal("workspace_config", workspace.workspace_id), 50);
                  };

                  return (
                    <Show
                      when={isCurrent() && !isPlayground()}
                      fallback={
                        /* Other workspaces (and current in playground): link to agents + gear to open settings */
                        <div class="flex items-center rounded-lg transition-all hover:bg-surface-overlay group">
                          <a
                            href={`#/workspace/${workspace.workspace_id}/agents`}
                            class="flex items-center gap-2 px-3 py-2 flex-1 min-w-0"
                            onClick={() => setIsOpen(false)}
                          >
                            {workspaceInfo()}
                          </a>
                          <Show when={isCurrent()}>
                            {/* Gear always visible on current workspace row */}
                            <button
                              type="button"
                              class="p-2 mr-1 rounded-md text-text-muted hover:text-text-primary transition-all flex-shrink-0"
                              aria-label="Workspace settings"
                              title="Workspace settings"
                              onClick={openSettings}
                            >
                              <Settings size={14} />
                            </button>
                          </Show>
                          <Show when={!isCurrent()}>
                            {/* Gear only on hover for other workspaces */}
                            <button
                              type="button"
                              class="p-2 mr-1 rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:text-text-primary transition-all flex-shrink-0"
                              aria-label="Workspace settings"
                              title="Workspace settings"
                              onClick={openSettings}
                            >
                              <Settings size={14} />
                            </button>
                          </Show>
                        </div>
                      }
                    >
                      {/* Current workspace (not in playground): entire row opens settings */}
                      <button
                        type="button"
                        class="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-surface-overlay bg-surface-overlay text-left"
                        onClick={openSettings}
                      >
                        {workspaceInfo()}
                        <Settings size={14} class="text-text-muted flex-shrink-0 ml-auto" />
                      </button>
                    </Show>
                  );
                }}
              </For>
            </Show>
          </div>

          {/* Divider */}
          <div class="border-t border-border" />

          {/* Footer Options */}
          <div class="p-2">
            {/* biome-ignore lint/a11y/useValidAnchor: SPA hash navigation requires anchor for cmd+click */}
            <a
              href="#/"
              class="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-surface-overlay text-text-primary"
              onClick={() => setIsOpen(false)}
            >
              <WorkspaceIcon size={16} class="text-text-muted" />
              <span class="text-sm font-medium">All Workspaces</span>
            </a>
            <Show when={config.playgroundEnabled()}>
              <a
                href={`#/workspace/${workspaceId()}/playground/experiments`}
                class="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-surface-overlay"
                classList={{
                  "bg-surface-overlay": isPlayground(),
                }}
                onClick={() => setIsOpen(false)}
              >
                <PlaygroundIcon size={16} class={isPlayground() ? "text-accent" : "text-text-muted"} />
                <span
                  class="text-sm font-medium"
                  classList={{
                    "text-accent": isPlayground(),
                    "text-text-primary": !isPlayground(),
                  }}
                >
                  Playground
                </span>
              </a>
            </Show>
          </div>

          <Popover.Arrow class="fill-surface-raised" />
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
};

export default WorkspaceContextPopover;
