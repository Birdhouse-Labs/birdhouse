// ABOUTME: Main workspace configuration dialog orchestrating all config sections
// ABOUTME: Integrates workspace title, AI providers, and MCP tools with save & restart functionality

import Dialog from "corvu/dialog";
import { type Component, createEffect, createMemo, createResource, createSignal, Show } from "solid-js";
import { Button } from "../../components/ui";
import { log } from "../../lib/logger";
import { fetchWorkspace, restartWorkspace } from "../../services/workspaces-api";
import type { Workspace } from "../../types/workspace";
import { fetchWorkspaceConfig, updateWorkspaceConfig } from "../services/workspace-config-api";
import type { AnthropicOptions, McpServers, WorkspaceConfig, WorkspaceConfigUpdate } from "../types/config-types";
import { PROVIDERS } from "../types/provider-registry";
import McpConfigSection from "./McpConfigSection";
import McpJsonDialog from "./McpJsonDialog";
import ProviderDeleteDialog from "./ProviderDeleteDialog";
import ProviderDialog from "./ProviderDialog";
import ProvidersList from "./ProvidersList";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import WorkspaceTitleSection from "./WorkspaceTitleSection";

export interface WorkspaceConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** Called when workspace data changes (e.g., title updated) so parent can refresh */
  onWorkspaceUpdated?: () => void;
}

const WorkspaceConfigDialog: Component<WorkspaceConfigDialogProps> = (props) => {
  // ===== Data Fetching =====
  const [workspace, { refetch: refetchWorkspace }] = createResource(
    () => {
      const source = props.open ? props.workspaceId : null;
      return source;
    },
    async (id) => {
      log.ui.debug("WorkspaceConfigDialog fetchWorkspace starting", { id });
      const result = await fetchWorkspace(id);
      log.ui.debug("WorkspaceConfigDialog fetchWorkspace success", { id });
      return result;
    },
  );

  const [config, { refetch: refetchConfig }] = createResource(
    () => {
      const source = props.open ? props.workspaceId : null;
      return source;
    },
    async (id) => {
      log.ui.debug("WorkspaceConfigDialog fetchWorkspaceConfig starting", { id });
      const result = await fetchWorkspaceConfig(id);
      log.ui.debug("WorkspaceConfigDialog fetchWorkspaceConfig success", { id });
      return result;
    },
  );

  // ===== Local State for Changes =====
  const [mcpServers, setMcpServers] = createSignal<McpServers | null>(null);
  const [pendingProviderUpdates, setPendingProviderUpdates] = createSignal<Map<string, string>>(new Map());
  const [anthropicOptions, setAnthropicOptions] = createSignal<AnthropicOptions>({ extended_context: false });

  // ===== Dialog States =====
  const [editingProvider, setEditingProvider] = createSignal<string | null>(null);
  const [deletingProvider, setDeletingProvider] = createSignal<string | null>(null);
  const [showProviderDialog, setShowProviderDialog] = createSignal(false);
  const [showDeleteDialog, setShowDeleteDialog] = createSignal(false);
  const [showMcpDialog, setShowMcpDialog] = createSignal(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);

  // ===== Sync MCP and Anthropic Options State with Config =====
  createEffect(() => {
    // Guard against errors - accessing config() when in error state throws
    if (config.error) return;
    const currentConfig = config();
    if (currentConfig) {
      setMcpServers(currentConfig.mcpServers);
      setAnthropicOptions(currentConfig.anthropicOptions);
    }
  });

  // ===== Reset State When Dialog Closes =====
  createEffect(() => {
    if (!props.open) {
      setPendingProviderUpdates(new Map());
      setMcpServers(null);
      setAnthropicOptions({ extended_context: false });
      setSaveError(null);
    }
  });

  // ===== Provider Handlers =====
  const handleAddProvider = (providerId: string) => {
    setEditingProvider(providerId);
    setShowProviderDialog(true);
  };

  const handleEditProvider = (providerId: string) => {
    setEditingProvider(providerId);
    setShowProviderDialog(true);
  };

  const handleDeleteProvider = (providerId: string) => {
    setDeletingProvider(providerId);
    setShowDeleteDialog(true);
  };

  const handleProviderSave = (providerId: string, apiKey: string, extendedContext?: boolean) => {
    // Add to pending updates
    setPendingProviderUpdates((prev) => new Map(prev).set(providerId, apiKey));
    if (providerId === "anthropic" && extendedContext !== undefined) {
      setAnthropicOptions({ extended_context: extendedContext });
    }
    setShowProviderDialog(false);
  };

  const handleProviderDeleteConfirm = () => {
    const providerId = deletingProvider();
    if (!providerId) return;

    // Add to pending updates with empty string (signals deletion)
    setPendingProviderUpdates((prev) => new Map(prev).set(providerId, ""));
    setShowDeleteDialog(false);
  };

  // ===== MCP Handlers =====
  const handleMcpToggle = (serverName: string, enabled: boolean) => {
    setMcpServers((prev) => {
      if (!prev || !prev[serverName]) return prev;
      const serverConfig = prev[serverName];
      const updated: McpServers = {
        ...prev,
        [serverName]: {
          ...serverConfig,
          enabled,
        },
      };
      return updated;
    });
  };

  const handleMcpJsonSave = (parsed: McpServers) => {
    setMcpServers(parsed);
    setShowMcpDialog(false);
  };

  // ===== Save & Restart =====
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      // Build update payload
      const update: WorkspaceConfigUpdate = {};

      // Add provider updates if any
      if (pendingProviderUpdates().size > 0) {
        update.providers = pendingProviderUpdates();
      }

      // Add anthropic options if changed
      const currentAnthropicOptions = anthropicOptions();
      const originalAnthropicOptions = config()?.anthropicOptions;
      if (currentAnthropicOptions.extended_context !== (originalAnthropicOptions?.extended_context ?? false)) {
        update.anthropicOptions = currentAnthropicOptions;
      }

      // Add MCP updates if changed
      const currentMcp = mcpServers();
      if (currentMcp !== config()?.mcpServers) {
        if (currentMcp !== null) {
          update.mcpServers = currentMcp;
        }
      }

      // Send update if there are changes
      if (Object.keys(update).length > 0) {
        await updateWorkspaceConfig(props.workspaceId, update);
      }

      // Close dialog immediately after save completes (don't wait for restart)
      props.onOpenChange(false);
      props.onWorkspaceUpdated?.();

      // Trigger restart in background (don't await - let it happen asynchronously)
      // User can see status updates on the main workspace list screen
      restartWorkspace(props.workspaceId).catch((err) => {
        log.ui.error("Background restart failed", { workspaceId: props.workspaceId }, err as Error);
        // TODO: Could show a toast notification here for restart failures
      });
    } catch (err) {
      // Show error message and keep dialog open
      const errorMsg = err instanceof Error ? err.message : "Failed to save configuration";
      log.ui.error("WorkspaceConfigDialog handleSave failed", { errorMsg }, err as Error);
      setSaveError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // If there are unsaved changes, show confirmation dialog
    if (hasUnsavedChanges()) {
      setShowUnsavedChangesDialog(true);
      return;
    }

    props.onOpenChange(false);
    // Notify parent to refresh workspace data (e.g., title changes)
    props.onWorkspaceUpdated?.();
  };

  const handleDiscardChanges = () => {
    setShowUnsavedChangesDialog(false);
    props.onOpenChange(false);
    props.onWorkspaceUpdated?.();
  };

  // ===== Error Handling =====
  const handleRetry = () => {
    refetchWorkspace();
    refetchConfig();
  };

  // ===== Computed Values =====
  const workspaceData = workspace as () => Workspace | undefined;
  const configData = config as () => WorkspaceConfig | undefined;
  const hasLoadError = () => {
    return workspace.error || config.error;
  };

  // Get existing providers for provider list (with actual keys)
  const existingProviders = createMemo(() => {
    // Guard against errors - accessing config() when in error state throws
    if (config.error) return new Map<string, string>();
    const base = configData()?.providers || new Map<string, string>();
    const pending = pendingProviderUpdates();

    // Apply pending changes to get current view
    const updated = new Map(base);
    pending.forEach((apiKey, providerId) => {
      if (apiKey === "") {
        updated.delete(providerId); // Empty string = delete
      } else {
        updated.set(providerId, apiKey); // Update with new key
      }
    });

    return updated;
  });

  // Get provider name for delete dialog
  const deletingProviderName = createMemo(() => {
    const id = deletingProvider();
    if (!id) return "";
    const provider = PROVIDERS.find((p) => p.id === id);
    return provider?.label || id;
  });

  // Get formatted JSON for MCP dialog
  const mcpJsonString = createMemo(() => {
    return JSON.stringify(mcpServers() || {}, null, 2);
  });

  // Check if there are unsaved changes
  const hasUnsavedChanges = createMemo(() => {
    // Has pending provider updates
    if (pendingProviderUpdates().size > 0) return true;

    // Has anthropic options changes
    if (anthropicOptions().extended_context !== (config()?.anthropicOptions?.extended_context ?? false)) return true;

    // Has MCP changes (use JSON comparison since objects have different references)
    const currentMcp = mcpServers();
    const originalMcp = config()?.mcpServers;
    if (JSON.stringify(currentMcp) !== JSON.stringify(originalMcp)) return true;

    return false;
  });

  return (
    <Dialog
      open={props.open}
      onOpenChange={(newOpen) => {
        log.ui.debug("WorkspaceConfigDialog onOpenChange", { newOpen, hasUnsavedChanges: hasUnsavedChanges() });

        // If trying to close with unsaved changes, show confirmation dialog instead
        if (!newOpen && hasUnsavedChanges()) {
          setShowUnsavedChangesDialog(true);
          return;
        }

        props.onOpenChange(newOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content class="fixed left-1/2 top-1/2 z-50 w-[95vw] h-[95dvh] rounded-2xl border shadow-2xl -translate-x-1/2 -translate-y-1/2 bg-surface-raised border-border flex flex-col">
          {/* Header */}
          <div class="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
            <Dialog.Label class="text-2xl font-bold text-heading">Edit Workspace Configuration</Dialog.Label>
            <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors focus:outline-none rounded p-1 w-8 h-8 flex items-center justify-center flex-shrink-0">
              <span class="text-xl leading-none select-none">×</span>
            </Dialog.Close>
          </div>

          {/* Scrollable Content */}
          <div class="flex-1 overflow-y-auto p-6">
            <div class="max-w-4xl mx-auto space-y-8">
              {/* Error Banner */}
              <Show when={hasLoadError()}>
                <div class="p-4 bg-danger/10 border border-danger rounded-lg">
                  <p class="text-sm text-danger mb-3">
                    {workspace.error
                      ? `Failed to load workspace: ${workspace.error.message}`
                      : `Failed to load configuration: ${config.error?.message}`}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={handleRetry}
                    data-ph-capture-attribute-button-type="retry-load-workspace-config"
                    data-ph-capture-attribute-workspace-id={props.workspaceId}
                  >
                    Retry
                  </Button>
                </div>
              </Show>
              {/* Title Section */}
              <section>
                <h2 class="text-xl font-semibold text-text-primary mb-4 pb-2 border-b border-border">Title</h2>
                <Show
                  when={!workspace.error && workspaceData()}
                  fallback={<div class="text-text-muted">Loading workspace...</div>}
                >
                  {(ws) => (
                    <WorkspaceTitleSection
                      workspaceId={props.workspaceId}
                      currentTitle={ws().title ?? null}
                      directory={ws().directory}
                      onTitleUpdated={() => {
                        refetchWorkspace();
                        // Don't call props.onWorkspaceUpdated here - it causes parent list
                        // to re-render which unmounts this dialog. The parent will refresh
                        // when the dialog closes.
                      }}
                    />
                  )}
                </Show>
              </section>

              {/* AI Providers Section */}
              <section>
                <h2 class="text-xl font-semibold text-text-primary mb-4 pb-2 border-b border-border">AI Providers</h2>
                <Show
                  when={!config.error && configData()}
                  fallback={<div class="text-text-muted">Loading configuration...</div>}
                >
                  <ProvidersList
                    providers={existingProviders()}
                    onAdd={handleAddProvider}
                    onEdit={handleEditProvider}
                    onDelete={handleDeleteProvider}
                  />
                </Show>
              </section>

              {/* MCP Tools Section */}
              <section>
                <h2 class="text-xl font-semibold text-text-primary mb-4 pb-2 border-b border-border">MCP Tools</h2>
                <Show
                  when={!config.error && configData()}
                  fallback={<div class="text-text-muted">Loading configuration...</div>}
                >
                  <McpConfigSection
                    mcpServers={mcpServers()}
                    onToggle={handleMcpToggle}
                    onConfigureJson={() => setShowMcpDialog(true)}
                  />
                </Show>
              </section>
            </div>
          </div>

          {/* Error Display */}
          <Show when={saveError()}>
            <div class="px-6 py-3 bg-danger/10 border-t border-danger flex-shrink-0">
              <p class="text-sm text-danger">{saveError()}</p>
            </div>
          </Show>

          {/* Footer Actions */}
          <div class="flex gap-3 justify-end p-6 border-t border-border flex-shrink-0">
            <Button
              variant="secondary"
              onClick={handleCancel}
              disabled={isSaving()}
              data-ph-capture-attribute-button-type="cancel-workspace-config"
              data-ph-capture-attribute-workspace-id={props.workspaceId}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={isSaving() || hasLoadError()}
              data-ph-capture-attribute-button-type="save-workspace-config"
              data-ph-capture-attribute-workspace-id={props.workspaceId}
              data-ph-capture-attribute-is-saving={isSaving() ? "true" : "false"}
            >
              {isSaving() ? "Saving..." : "Save & Restart"}
            </Button>
          </div>

          {/* Nested Dialogs - must be inside Dialog.Content for proper layer management */}
          <ProviderDialog
            open={showProviderDialog()}
            onOpenChange={setShowProviderDialog}
            providerId={editingProvider() ?? ""}
            hasExistingKey={existingProviders().has(editingProvider() ?? "")}
            currentKey={existingProviders().get(editingProvider() ?? "")}
            extendedContext={anthropicOptions().extended_context}
            onSave={handleProviderSave}
          />

          <ProviderDeleteDialog
            open={showDeleteDialog()}
            onOpenChange={setShowDeleteDialog}
            providerName={deletingProviderName()}
            onConfirm={handleProviderDeleteConfirm}
          />

          <McpJsonDialog
            open={showMcpDialog()}
            onOpenChange={setShowMcpDialog}
            initialJson={mcpJsonString()}
            onSave={handleMcpJsonSave}
          />

          <UnsavedChangesDialog
            open={showUnsavedChangesDialog()}
            onOpenChange={setShowUnsavedChangesDialog}
            onDiscard={handleDiscardChanges}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default WorkspaceConfigDialog;
