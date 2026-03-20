// ABOUTME: Workspace selection landing page
// ABOUTME: Lists all workspaces with navigation and creation options
// ABOUTME: Supports workspace config modal routing via URL

import { useNavigate } from "@solidjs/router";
import { RefreshCw } from "lucide-solid";
import { type Component, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { usePageTitle } from "../lib/page-title";
import { useModalRoute } from "../lib/routing";
import { fetchWorkspaces, fetchWorkspacesHealth } from "../services/workspaces-api";
import type { Workspace, WorkspaceHealthStatus as WorkspaceHealthStatusType } from "../types/workspace";
import { shortenPath } from "../utils/paths";
import WorkspaceConfigDialog from "../workspace-config/components/WorkspaceConfigDialog";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import WorkspaceHealthStatus from "./WorkspaceHealthStatus";

const LoadingSpinner = () => (
  <div class="flex items-center justify-center h-full">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
  </div>
);

const ErrorMessage = (props: { error: Error; onRetry: () => void }) => (
  <div class="flex flex-col items-center justify-center h-full gap-4 p-4">
    <p class="text-danger text-center">Failed to load workspaces: {props.error.message}</p>
    <Button onClick={props.onRetry} variant="primary">
      Retry
    </Button>
  </div>
);

const WorkspaceSelector: Component = () => {
  usePageTitle("Workspaces - Birdhouse");

  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = createSignal<Workspace[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<Error | null>(null);

  // Health status tracking
  const [healthStatuses, setHealthStatuses] = createSignal<Map<string, WorkspaceHealthStatusType>>(new Map());
  const [checkingHealth, setCheckingHealth] = createSignal<Set<string>>(new Set());

  // Modal routing for workspace config dialog
  const { currentModal, openModal, closeModal, isModalOpen } = useModalRoute();

  const loadWorkspaces = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchWorkspaces();
      setWorkspaces(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch workspaces"));
    } finally {
      setIsLoading(false);
    }
  };

  // Check health for all workspaces (batch request)
  const checkAllHealth = async () => {
    const ids = workspaces().map((w) => w.workspace_id);
    if (ids.length === 0) return;

    // Mark all workspaces as checking
    setCheckingHealth(new Set(ids));

    try {
      const healthData = await fetchWorkspacesHealth();
      const newStatuses = new Map<string, WorkspaceHealthStatusType>();

      for (const health of healthData) {
        newStatuses.set(health.workspaceId, {
          ...health,
          lastChecked: Date.now(),
        });
      }

      setHealthStatuses(newStatuses);
    } catch (_err) {
      // Health check failed - silently continue, will retry on next interval
    } finally {
      // Clear checking state
      setCheckingHealth(new Set<string>());
    }
  };

  // Manual refresh all health statuses (triggers fast polling)
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const MIN_SPINNER_MS = 400; // Minimum time to show spinner for visual feedback
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    const startTime = Date.now();
    try {
      await checkAllHealth();
      startFastPolling();
    } finally {
      // Ensure spinner shows for at least MIN_SPINNER_MS
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_SPINNER_MS) {
        setTimeout(() => setIsRefreshing(false), MIN_SPINNER_MS - elapsed);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  // Auto-refresh interval (3 seconds normal, 1 second fast after manual refresh)
  let refreshInterval: number | undefined;
  const NORMAL_POLL_MS = 3000;
  const FAST_POLL_MS = 1000;
  const FAST_POLL_DURATION_MS = 30000;

  const startNormalPolling = () => {
    if (refreshInterval !== undefined) {
      clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(() => {
      checkAllHealth();
    }, NORMAL_POLL_MS) as unknown as number;
  };

  const startFastPolling = () => {
    if (refreshInterval !== undefined) {
      clearInterval(refreshInterval);
    }
    // Fast polling (1s) for 30 seconds
    refreshInterval = setInterval(() => {
      checkAllHealth();
    }, FAST_POLL_MS) as unknown as number;

    // After 30s, resume normal 3s interval
    setTimeout(() => {
      startNormalPolling();
    }, FAST_POLL_DURATION_MS);
  };

  onMount(() => {
    loadWorkspaces();

    // Start health checking after workspaces load
    // Wait a bit for workspaces to load first
    setTimeout(() => {
      checkAllHealth();
      startNormalPolling();
    }, 500);
  });

  onCleanup(() => {
    if (refreshInterval !== undefined) {
      clearInterval(refreshInterval);
    }
  });

  const handleCreateWorkspace = () => {
    navigate("/setup");
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div class="min-h-screen overflow-auto p-8 bg-gradient-to-br from-bg-from via-bg-via to-bg-to">
      <div class="max-w-6xl mx-auto">
        {/* Header */}
        <div class="flex items-start justify-between mb-8">
          <div>
            <h1 class="text-4xl font-bold text-text-primary mb-2">Workspaces</h1>
            <p class="text-text-muted">Select a workspace to continue, or create a new one</p>
          </div>
          <IconButton
            icon={<RefreshCw size={20} class={isRefreshing() ? "animate-spin" : ""} />}
            variant="ghost"
            aria-label="Refresh all workspaces"
            onClick={handleRefreshAll}
            disabled={isRefreshing()}
            data-ph-capture-attribute-button-type="refresh-workspace-health"
            data-ph-capture-attribute-is-refreshing={isRefreshing() ? "true" : "false"}
          />
        </div>

        {/* Loading/Error States */}
        <Show when={isLoading()}>
          <LoadingSpinner />
        </Show>

        <Show when={error()} keyed>
          {(err) => <ErrorMessage error={err} onRetry={loadWorkspaces} />}
        </Show>

        {/* Workspace List */}
        <Show when={!isLoading() && !error()}>
          <Show
            when={workspaces().length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center gap-6 p-12 bg-surface-raised rounded-lg border border-border">
                <div class="text-center">
                  <h2 class="text-2xl font-semibold text-text-primary mb-2">No workspaces yet</h2>
                  <p class="text-text-muted">Create your first workspace to get started</p>
                </div>
                <Button
                  onClick={handleCreateWorkspace}
                  variant="primary"
                  data-ph-capture-attribute-button-type="create-workspace"
                  data-ph-capture-attribute-context="no-workspaces-fallback"
                >
                  Create Workspace
                </Button>
              </div>
            }
          >
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <For each={workspaces()}>
                {(workspace) => (
                  <div class="relative p-6 bg-surface-raised rounded-lg border border-border hover:border-accent hover:shadow-lg transition-all flex flex-col">
                    {/* Status and gear icon - top right */}
                    <div class="absolute top-4 right-4">
                      <WorkspaceHealthStatus
                        workspaceId={workspace.workspace_id}
                        health={healthStatuses().get(workspace.workspace_id) ?? null}
                        isChecking={checkingHealth().has(workspace.workspace_id)}
                        onEditConfig={() => openModal("workspace_config", workspace.workspace_id)}
                      />
                    </div>

                    {/* Workspace Title & Directory */}
                    <div class="mb-3 pr-12">
                      <h3
                        class="text-lg font-semibold text-text-primary truncate"
                        title={workspace.title || workspace.directory}
                      >
                        {workspace.title || workspace.directory.split("/").pop() || workspace.directory}
                      </h3>
                      <p class="text-sm text-text-muted truncate" title={workspace.directory}>
                        {shortenPath(workspace.directory)}
                      </p>
                    </div>

                    {/* Status Info - grows to push button to bottom */}
                    <div class="mb-4 text-xs text-text-muted flex-grow">
                      <span>Last used {formatDate(workspace.last_used)}</span>
                    </div>

                    {/* Open button - bottom right */}
                    <div class="flex justify-end mt-auto">
                      <Button
                        variant="primary"
                        href={`#/workspace/${workspace.workspace_id}/agents`}
                        data-ph-capture-attribute-button-type="open-workspace"
                        data-ph-capture-attribute-workspace-id={workspace.workspace_id}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                )}
              </For>
            </div>

            {/* Create New Workspace Button */}
            <div class="flex justify-center">
              <Button
                onClick={handleCreateWorkspace}
                variant="secondary"
                data-ph-capture-attribute-button-type="create-workspace"
                data-ph-capture-attribute-context="workspace-list"
              >
                + Create New Workspace
              </Button>
            </div>
          </Show>
        </Show>

        {/* Workspace Config Dialog - rendered at page level for URL persistence */}
        <Show when={currentModal()?.type === "workspace_config" ? currentModal() : null} keyed>
          {(modal) => (
            <WorkspaceConfigDialog
              open={true}
              onOpenChange={(open) => {
                if (!open && isModalOpen("workspace_config", modal.id)) {
                  closeModal();
                }
              }}
              workspaceId={modal.id}
              onWorkspaceUpdated={loadWorkspaces}
            />
          )}
        </Show>
      </div>
    </div>
  );
};

export default WorkspaceSelector;
