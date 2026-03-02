// ABOUTME: Dialog for unarchiving agents and their descendants
// ABOUTME: Shows confirmation message and handles unarchive API call with error states

import Dialog from "corvu/dialog";
import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { useZIndex } from "../contexts/ZIndexContext";
import { unarchiveAgent } from "../services/agents-api";
import { Button } from "./ui";

export interface UnarchiveAgentDialogProps {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UnarchiveAgentDialog: Component<UnarchiveAgentDialogProps> = (props) => {
  const { workspaceId } = useWorkspace();
  const baseZIndex = useZIndex();
  const [isUnarchiving, setIsUnarchiving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleUnarchive = async () => {
    setIsUnarchiving(true);
    setError(null);

    try {
      await unarchiveAgent(workspaceId, props.agentId);
      props.onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unarchive agent");
    } finally {
      setIsUnarchiving(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    props.onOpenChange(false);
  };

  // Reset error when dialog is closed
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError(null);
    }
    props.onOpenChange(open);
  };

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ "z-index": baseZIndex }} />
        <Dialog.Content
          class="fixed left-1/2 top-1/2 w-full max-w-md rounded-2xl p-6 border shadow-2xl -translate-x-1/2 -translate-y-1/2 bg-surface-raised border-border"
          style={{ "z-index": baseZIndex }}
        >
          <Dialog.Label class="text-2xl font-bold mb-2 text-heading">Unarchive Agent?</Dialog.Label>
          <Dialog.Description class="mb-6 text-text-secondary">
            Unarchive this agent and all descendants?
          </Dialog.Description>

          {/* Error Message */}
          <Show when={error()}>
            <div class="mb-4 text-danger text-sm p-3 bg-surface-raised rounded-lg border border-danger">{error()}</div>
          </Show>

          {/* Actions */}
          <div class="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={handleCancel}
              disabled={isUnarchiving()}
              data-ph-capture-attribute-button-type="cancel-unarchive-agent"
              data-ph-capture-attribute-agent-id={props.agentId}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUnarchive}
              disabled={isUnarchiving()}
              data-ph-capture-attribute-button-type="unarchive-agent"
              data-ph-capture-attribute-agent-id={props.agentId}
              data-ph-capture-attribute-is-unarchiving={isUnarchiving() ? "true" : "false"}
            >
              {isUnarchiving() ? "Unarchiving..." : "Unarchive"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default UnarchiveAgentDialog;
