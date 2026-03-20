// ABOUTME: Workspace settings page for managing workspace configuration
// ABOUTME: Display workspace info, workspace environment status, and delete workspace option
// ABOUTME: Uses modal route stack for workspace config dialog

import { useNavigate } from "@solidjs/router";
import { type Component, createSignal, Show } from "solid-js";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { usePageTitle } from "../lib/page-title";
import { useModalRoute } from "../lib/routing";
import { deleteWorkspace } from "../services/workspaces-api";
import WorkspaceConfigDialog from "../workspace-config/components/WorkspaceConfigDialog";
import Button from "./ui/Button";

const LoadingSpinner = () => (
  <div class="flex items-center justify-center">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
  </div>
);

const WorkspaceSettings: Component = () => {
  usePageTitle("Workspace Settings - Birdhouse");

  const navigate = useNavigate();
  const { workspaceId, workspace, isLoading, error, refetch } = useWorkspace();
  const { currentModal, openModal, closeModal, isModalOpen } = useModalRoute();

  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDeleteWorkspace = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteWorkspace(workspaceId);
      // Navigate back to workspace selector
      navigate("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete workspace");
      setIsDeleting(false);
    }
  };

  return (
    <div class="h-full overflow-auto p-8">
      <div class="max-w-4xl mx-auto">
        {/* Header */}
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-text-primary mb-2">Workspace Settings</h1>
          <p class="text-text-muted">Manage your workspace configuration</p>
        </div>

        {/* Loading State */}
        <Show when={isLoading()}>
          <div class="flex justify-center p-12">
            <LoadingSpinner />
          </div>
        </Show>

        {/* Error State */}
        <Show when={error()}>
          <div class="p-4 bg-danger/10 border border-danger rounded">
            <p class="text-danger">Failed to load workspace: {error()?.message}</p>
          </div>
        </Show>

        {/* Settings Content */}
        <Show when={!isLoading() && !error() && workspace()}>
          {(ws) => (
            <div class="space-y-6">
              {/* Workspace Information */}
              <div class="p-6 bg-surface-raised rounded-lg border border-border">
                <h2 class="text-xl font-semibold text-text-primary mb-4">Workspace Information</h2>

                <div class="space-y-3">
                  <div>
                    <div class="block text-sm font-medium text-text-muted mb-1">Workspace ID</div>
                    <p class="text-text-primary font-mono text-sm">{ws().workspace_id}</p>
                  </div>

                  <div>
                    <div class="block text-sm font-medium text-text-muted mb-1">Directory</div>
                    <p class="text-text-primary break-all">{ws().directory}</p>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <div class="block text-sm font-medium text-text-muted mb-1">Created</div>
                      <p class="text-text-primary text-sm">{formatDate(ws().created_at)}</p>
                    </div>

                    <div>
                      <div class="block text-sm font-medium text-text-muted mb-1">Last Accessed</div>
                      <p class="text-text-primary text-sm">{formatDate(ws().last_used)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Workspace Environment Status */}
              <div class="p-6 bg-surface-raised rounded-lg border border-border">
                <h2 class="text-xl font-semibold text-text-primary mb-4">Workspace Environment Status</h2>

                <div class="space-y-3">
                  <div class="flex items-center gap-3">
                    <div class={`w-3 h-3 rounded-full ${ws().opencode_running ? "bg-success" : "bg-text-muted"}`} />
                    <span class="text-text-primary">{ws().opencode_running ? "Running" : "Not Running"}</span>
                  </div>

                  <Show when={ws().opencode_base}>
                    <div>
                      <div class="block text-sm font-medium text-text-muted mb-1">Environment Base URL</div>
                      <p class="text-text-primary font-mono text-sm">{ws().opencode_base}</p>
                    </div>
                  </Show>
                </div>
              </div>

              {/* Configuration Section */}
              <div class="p-6 bg-surface-raised rounded-lg border border-border">
                <h2 class="text-xl font-semibold text-text-primary mb-4">Configuration</h2>
                <p class="text-text-muted text-sm mb-4">
                  Manage workspace title, API keys for AI providers, and MCP tool configuration.
                </p>
                <Button variant="primary" onClick={() => openModal("workspace_config", workspaceId)}>
                  Edit Configuration
                </Button>
              </div>

              {/* Danger Zone */}
              <div class="p-6 bg-danger/5 rounded-lg border border-danger">
                <h2 class="text-xl font-semibold text-danger mb-4">Danger Zone</h2>

                <Show when={!showDeleteConfirm()}>
                  <div>
                    <p class="text-text-muted text-sm mb-4">
                      Deleting this workspace will remove all configuration and data. This action cannot be undone.
                    </p>
                    <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                      Delete Workspace
                    </Button>
                  </div>
                </Show>

                <Show when={showDeleteConfirm()}>
                  <div class="space-y-4">
                    <div class="p-4 bg-danger/10 rounded">
                      <p class="text-danger font-semibold mb-2">Are you sure?</p>
                      <p class="text-text-primary text-sm">
                        This will permanently delete the workspace <strong>{ws().directory}</strong> and all its data.
                      </p>
                    </div>

                    <Show when={deleteError()}>
                      <div class="p-3 bg-danger/20 border border-danger rounded">
                        <p class="text-sm text-danger">{deleteError()}</p>
                      </div>
                    </Show>

                    <div class="flex gap-3">
                      <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting()}>
                        Cancel
                      </Button>
                      <Button variant="danger" onClick={handleDeleteWorkspace} disabled={isDeleting()}>
                        <Show when={isDeleting()} fallback="Yes, Delete Workspace">
                          <div class="flex items-center gap-2">
                            <LoadingSpinner />
                            <span>Deleting...</span>
                          </div>
                        </Show>
                      </Button>
                    </div>
                  </div>
                </Show>
              </div>

              {/* Back Button */}
              <div class="flex justify-start">
                <Button variant="secondary" onClick={() => navigate(`/workspace/${workspaceId}/agents`)}>
                  ← Back to Agents
                </Button>
              </div>
            </div>
          )}
        </Show>

        {/* Workspace Config Dialog - URL-driven */}
        <Show when={isModalOpen("workspace_config", workspaceId)}>
          <WorkspaceConfigDialog
            open={true}
            onOpenChange={(open) => {
              if (!open && currentModal()?.type === "workspace_config" && currentModal()?.id === workspaceId) {
                closeModal();
              }
            }}
            workspaceId={workspaceId}
            onWorkspaceUpdated={refetch}
          />
        </Show>
      </div>
    </div>
  );
};

export default WorkspaceSettings;
