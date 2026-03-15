// ABOUTME: Agent top bar component with context usage indicator and gradient pulse
// ABOUTME: Shows agent title, model, context donut, and working state with gradient pulse

import { useNavigate } from "@solidjs/router";
import Popover from "corvu/popover";
import { Archive, Bot, Download, Edit, Hammer, Lightbulb, MoreVertical, X } from "lucide-solid";
import { type Component, createEffect, createMemo, createResource, createSignal, onCleanup, Show } from "solid-js";
import { API_ENDPOINT_BASE, buildWorkspaceUrl } from "../config/api";
import { useStreaming } from "../contexts/StreamingContext";
import { useZIndex } from "../contexts/ZIndexContext";
import { aggregateTokenStats } from "../domain/token-aggregation";

import { borderColor } from "../styles/containerStyles";
import type { Message } from "../types/messages";
import { buildSkillMarkdownLink } from "../utils/skillLinks";
import ArchiveAgentDialog from "./ArchiveAgentDialog";
import ContextUsageIndicator from "./ContextUsageIndicator";
import EditAgentDialog from "./EditAgentDialog";
import UnarchiveAgentDialog from "./UnarchiveAgentDialog";
import { IconButton, MenuItemButton } from "./ui";

export interface AgentHeaderProps {
  agentId: string;
  workspaceId: string;
  title: string;
  modelName: string;
  messages: Message[];
  mode: string;
  onModeChange: (mode: string) => void;
  onHeaderClick?: () => void;
  archivedAt?: number | null; // Unix timestamp (ms) when archived, null if not archived
  showCloseButton?: boolean;
  onClose?: () => void;
}

export const AgentHeader: Component<AgentHeaderProps> = (props) => {
  const streaming = useStreaming();
  const navigate = useNavigate();
  const baseZIndex = useZIndex();
  const [isWorking, setIsWorking] = createSignal(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = createSignal(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = createSignal(false);
  const [isUnarchiveDialogOpen, setIsUnarchiveDialogOpen] = createSignal(false);
  const [isPopoverOpen, setIsPopoverOpen] = createSignal(false);
  const [currentTitle, setCurrentTitle] = createSignal(props.title);
  const [showClickFeedback, setShowClickFeedback] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);
  const [exportError, setExportError] = createSignal<string | null>(null);

  // Determine if agent is archived
  const isArchived = createMemo(() => props.archivedAt !== null && props.archivedAt !== undefined);

  // Aggregate token statistics from messages
  const tokenStats = createMemo(() => aggregateTokenStats(props.messages, props.modelName));

  const percentage = createMemo(() => (tokenStats().limit > 0 ? (tokenStats().used / tokenStats().limit) * 100 : 0));

  // Fetch initial session status on load
  const [sessionStatus, { refetch: refetchStatus }] = createResource(
    () => ({ agentId: props.agentId, workspaceId: props.workspaceId }),
    async ({ agentId, workspaceId }) => {
      try {
        const response = await fetch(`${API_ENDPOINT_BASE}/workspace/${workspaceId}/agents/${agentId}/status`);
        if (!response.ok) return { type: "idle" as const };
        const data = await response.json();
        return data.status;
      } catch {
        return { type: "idle" as const };
      }
    },
  );

  // Initialize working state from session status
  createEffect(() => {
    const status = sessionStatus();
    if (status?.type === "busy" || status?.type === "retry") {
      setIsWorking(true);
    } else if (status?.type === "idle") {
      setIsWorking(false);
    }
  });

  // Track working state via session.status SSE events
  createEffect(() => {
    const unsubscribeStatus = streaming.subscribeToSessionStatus(props.agentId, (status) => {
      if (status.type === "busy" || status.type === "retry") {
        setIsWorking(true);
      } else if (status.type === "idle") {
        setIsWorking(false);
      }
    });

    onCleanup(() => {
      unsubscribeStatus();
    });
  });

  // Refetch status when SSE reconnects to prevent stale working state
  createEffect(() => {
    const unsubscribe = streaming.subscribeToConnectionEstablished(() => {
      refetchStatus();
    });

    onCleanup(unsubscribe);
  });

  // Listen for title updates from stream events
  createEffect(() => {
    const unsubscribe = streaming.subscribeToAgentUpdated((updatedAgentId, agent) => {
      // TypeScript requires bracket notation for index signatures
      if (updatedAgentId === props.agentId && agent["title"]) {
        setCurrentTitle(agent["title"] as string);
      }
    });

    onCleanup(unsubscribe);
  });

  // Handle mouse down/up for click feedback
  const handleMouseDown = () => {
    setShowClickFeedback(true);
  };

  const handleMouseUp = () => {
    setShowClickFeedback(false);
  };

  const handleMouseLeave = () => {
    setShowClickFeedback(false);
  };

  const handleEditClick = () => {
    setIsPopoverOpen(false);

    // Wait for popover's presence/animations to complete before opening dialog
    // The popover content remains in DOM during its exit animation, and the
    // dialog's closeOnOutsidePointer would detect the click as "outside" since
    // it originated from the popover portal element
    setTimeout(() => {
      setIsEditDialogOpen(true);
    }, 150);
  };

  const handleArchiveClick = () => {
    setIsPopoverOpen(false);

    // Wait for popover's presence/animations to complete before opening dialog
    setTimeout(() => {
      setIsArchiveDialogOpen(true);
    }, 150);
  };

  const handleUnarchiveClick = () => {
    setIsPopoverOpen(false);

    // Wait for popover's presence/animations to complete before opening dialog
    setTimeout(() => {
      setIsUnarchiveDialogOpen(true);
    }, 150);
  };

  const handleExportClick = async () => {
    setIsPopoverOpen(false);
    setIsExporting(true);
    setExportError(null);

    try {
      const response = await fetch(buildWorkspaceUrl(props.workspaceId, `/agents/${props.agentId}/export`));

      if (!response.ok) {
        // Try to parse error from JSON response
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Export failed");
        }

        // Fallback for non-JSON errors
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // Get the markdown content
      const markdown = await response.text();

      // Create blob and trigger download
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || "export.md";

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();

      // Cleanup
      URL.revokeObjectURL(url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to export agent";
      setExportError(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportTreeClick = () => {
    setIsPopoverOpen(false);

    // Build the pre-filled message with Birdhouse links
    const message = `Please ${buildSkillMarkdownLink("export the tree", "export_agent_tree")} for [${props.title}](birdhouse:agent/${props.agentId})`;

    // Navigate to new agent view with message as URL parameter
    navigate(`/workspace/${props.workspaceId}/agents?message=${encodeURIComponent(message)}`);
  };

  const handleEditSuccess = (newTitle: string) => {
    setCurrentTitle(newTitle);
  };

  const handleHeaderClick = (e: MouseEvent) => {
    // Don't trigger header click if clicking on buttons (but allow clicking header itself)
    const target = e.target as HTMLElement;
    const clickedButton = target.closest("button");
    const headerContainer = target.closest(".top-bar-container");

    // If clicked a button that's not the header container itself, ignore
    if (clickedButton && clickedButton !== headerContainer) {
      return;
    }

    props.onHeaderClick?.();
  };

  const handleHeaderKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      props.onHeaderClick?.();
    }
  };

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: Header is a complex container with multiple interactive elements (popover button) - converting to button would require complex restructuring */}
      <div
        class={`px-4 py-1 flex items-center top-bar-container relative overflow-hidden group rounded-t-lg flex-shrink-0 border-b ${borderColor} cursor-pointer`}
        classList={{
          "working-gradient-pulse": isWorking(),
        }}
        style={{
          background: "var(--theme-surface-raised)",
          "box-shadow": showClickFeedback() ? "inset 0 0 0 2px var(--theme-accent)" : "none",
        }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleHeaderClick}
        onKeyDown={handleHeaderKeyDown}
        tabIndex={0}
        role="button"
        aria-label="Focus agent in tree sidebar"
      >
        {/* Gradient pulse overlay for working state (z:0) */}
        <div class="gradient-overlay" />

        {/* Content wrapper - creates separate stacking context above gradient (z:2) */}
        <div class="content-wrapper">
          {/* Context Usage Donut Indicator */}
          <ContextUsageIndicator
            percentage={percentage()}
            model={tokenStats().model}
            limit={tokenStats().limit}
            used={tokenStats().used}
          />

          {/* Title - primary color always, white when working */}
          <span
            class="text-sm font-medium transition-all"
            classList={{
              "text-text-primary": !isWorking(),
              "text-text-on-accent": isWorking(),
            }}
          >
            {currentTitle()}
          </span>

          {/* Model name - secondary normally, white when working */}
          <span
            class="text-xs ml-auto mr-2 transition-colors"
            classList={{
              "text-text-secondary": !isWorking(),
              "text-text-on-accent": isWorking(),
            }}
          >
            {props.modelName}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              props.onModeChange(props.mode === "build" ? "plan" : "build");
            }}
            class="relative z-10 flex items-center justify-center w-7 h-7 rounded-lg transition-all"
            classList={{
              "bg-accent/20 text-accent hover:bg-accent/30": props.mode === "plan" && !isWorking(),
              "text-text-secondary hover:bg-surface-overlay hover:text-text-primary":
                props.mode === "build" && !isWorking(),
              "!text-text-on-accent hover:bg-white/20": isWorking(),
            }}
            aria-label={`Switch to ${props.mode === "build" ? "plan" : "build"} mode`}
            title={`Current: ${props.mode} mode. Click to switch.`}
          >
            {props.mode === "plan" ? <Lightbulb size={14} /> : <Hammer size={14} />}
          </button>

          {/* Menu Button with Popover */}
          <Popover open={isPopoverOpen()} onOpenChange={setIsPopoverOpen}>
            <Popover.Trigger
              as={IconButton}
              icon={<MoreVertical size={16} />}
              variant={isWorking() ? "secondary" : "ghost"}
              aria-label="Actions menu"
              fixedSize
              class={isWorking() ? "!text-text-on-accent !bg-transparent hover:!bg-white/20" : ""}
              data-ph-capture-attribute-button-type="open-agent-actions-menu"
              data-ph-capture-attribute-agent-id={props.agentId}
            />
            <Popover.Portal>
              <Popover.Content
                class="w-48 rounded-xl py-1 px-2 border shadow-2xl bg-surface-raised border-border"
                style={{ "z-index": baseZIndex }}
              >
                <MenuItemButton
                  icon={<Edit size={16} />}
                  onClick={handleEditClick}
                  data-ph-capture-attribute-button-type="edit-agent"
                  data-ph-capture-attribute-agent-id={props.agentId}
                >
                  Edit
                </MenuItemButton>
                <MenuItemButton
                  icon={<Download size={16} />}
                  onClick={handleExportClick}
                  disabled={isExporting()}
                  data-ph-capture-attribute-button-type="export-agent"
                  data-ph-capture-attribute-agent-id={props.agentId}
                  data-ph-capture-attribute-is-exporting={isExporting() ? "true" : "false"}
                >
                  {isExporting() ? "Exporting..." : "Export"}
                </MenuItemButton>
                <MenuItemButton
                  icon={<Bot size={16} />}
                  onClick={handleExportTreeClick}
                  variant="gradient"
                  data-ph-capture-attribute-button-type="export-agent-tree"
                  data-ph-capture-attribute-agent-id={props.agentId}
                >
                  Export tree...
                </MenuItemButton>
                {isArchived() ? (
                  <MenuItemButton
                    icon={<Archive size={16} />}
                    onClick={handleUnarchiveClick}
                    data-ph-capture-attribute-button-type="unarchive-agent-menu"
                    data-ph-capture-attribute-agent-id={props.agentId}
                  >
                    Unarchive
                  </MenuItemButton>
                ) : (
                  <MenuItemButton
                    icon={<Archive size={16} />}
                    onClick={handleArchiveClick}
                    data-ph-capture-attribute-button-type="archive-agent-menu"
                    data-ph-capture-attribute-agent-id={props.agentId}
                  >
                    Archive
                  </MenuItemButton>
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover>

          {/* Close Button (for modals) */}
          <Show when={props.showCloseButton}>
            <button
              type="button"
              onClick={props.onClose}
              class="relative z-10 flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
              classList={{
                "text-text-on-accent hover:bg-white/10": isWorking(),
                "text-text-muted hover:bg-surface-overlay hover:text-text-primary": !isWorking(),
              }}
              aria-label="Close modal"
              title="Close modal"
            >
              <X size={16} />
            </button>
          </Show>
        </div>

        <div
          class="absolute bottom-0 left-0 h-[2px] pointer-events-none transition-all duration-300 ease-out"
          style={{
            width: `${percentage()}%`,
            background: "linear-gradient(to right, var(--theme-gradient-from), var(--theme-gradient-to))",
            "z-index": "4",
          }}
          classList={{
            "progress-pulse": isWorking(),
          }}
        />
      </div>

      {/* Edit Dialog */}
      <EditAgentDialog
        agentId={props.agentId}
        currentTitle={currentTitle()}
        messages={props.messages}
        open={isEditDialogOpen()}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleEditSuccess}
      />

      {/* Archive Dialog */}
      <ArchiveAgentDialog agentId={props.agentId} open={isArchiveDialogOpen()} onOpenChange={setIsArchiveDialogOpen} />

      {/* Unarchive Dialog */}
      <UnarchiveAgentDialog
        agentId={props.agentId}
        open={isUnarchiveDialogOpen()}
        onOpenChange={setIsUnarchiveDialogOpen}
      />

      {/* Export Error Toast */}
      <Show when={exportError()}>
        <div class="fixed bottom-4 right-4 z-50 max-w-md p-4 bg-surface-raised border border-danger rounded-lg shadow-2xl">
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

      {/* CSS Animations and Effects */}
      <style>{`
        /* ===== LAYER 0: Gradient Overlay ===== */
        .gradient-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to right, 
            var(--theme-gradient-from), 
            var(--theme-gradient-to)
          );
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
          border-radius: inherit;
          z-index: 0;
        }

        /* Working state: Gradient pulses between 100% and 70% opacity */
        @keyframes gradient-pulse {
          0%, 100% { 
            opacity: 1;
          }
          50% { 
            opacity: 0.7;
          }
        }

        .working-gradient-pulse .gradient-overlay {
          animation: gradient-pulse 2s ease-in-out infinite;
          opacity: 1;
        }

        /* ===== LAYER 2: Content Wrapper ===== */
        .content-wrapper {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 0.75rem; /* gap-3 = 3 * 0.25rem */
          width: 100%;
        }

        /* ===== Donut Indicator White State ===== */
        /* Turn donut white when working */
        .working-gradient-pulse .donut-bg-ring {
          stroke: var(--theme-text-on-accent);
        }

        .working-gradient-pulse .donut-filled-ring {
          stroke: var(--theme-text-on-accent) !important;
        }

        /* ===== Progress Bar Animation ===== */
        @keyframes progress-pulse {
          0%, 100% { 
            opacity: 1;
          }
          50% { 
            opacity: 0.6;
          }
        }

        .progress-pulse {
          animation: progress-pulse 2s ease-in-out infinite;
        }
      `}</style>
    </>
  );
};

export default AgentHeader;
