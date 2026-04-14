// ABOUTME: Dialog for editing agent properties (currently just title)
// ABOUTME: Loads its own messages for title generation; implements change detection and validation

import Dialog from "corvu/dialog";
import { Sparkles } from "lucide-solid";
import type { Component } from "solid-js";
import { createEffect, createMemo, createResource, createSignal, Show } from "solid-js";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { useZIndex } from "../contexts/ZIndexContext";
import { fetchMessages, generateTitle, updateAgentTitle } from "../services/messages-api";
import { Button } from "./ui";

export interface EditAgentDialogProps {
  agentId: string;
  currentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newTitle: string) => void;
}

/**
 * Extract the last "turn" from messages
 * A turn is all messages from and including the last user message.
 * Messages are stored newest-first, so index 0 is the most recent.
 */
function extractLastTurn(messages: { role: string; content?: string }[]): string {
  // Find the most recent user message (first user message in newest-first array)
  let lastUserIndex = -1;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg && msg.role === "user") {
      lastUserIndex = i;
      break;
    }
  }

  // If no user message found, return empty
  if (lastUserIndex === -1) {
    return "";
  }

  // Collect all messages from the most recent user message back to index 0
  // (index 0 is newest, so slice [0..lastUserIndex] gives the last turn)
  const turnMessages = messages.slice(0, lastUserIndex + 1);

  // Extract text content from each message.
  // msg.content is the pre-concatenated plain text from all text parts.
  const textParts: string[] = [];
  for (const msg of turnMessages) {
    if (msg.content?.trim()) {
      textParts.push(`[${msg.role}]: ${msg.content.trim()}`);
    }
  }

  return textParts.join("\n\n");
}

const EditAgentDialog: Component<EditAgentDialogProps> = (props) => {
  const { workspaceId } = useWorkspace();
  const baseZIndex = useZIndex();
  const [title, setTitle] = createSignal(props.currentTitle);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Fetch messages only while the dialog is open, keyed by agentId so it
  // re-fetches automatically if the agentId changes (e.g. opened from the
  // command palette for a different agent).
  const [messages] = createResource(
    () => (props.open ? props.agentId : null),
    (agentId) => fetchMessages(workspaceId, agentId),
  );

  // Reset form state when dialog opens or currentTitle changes
  createEffect(() => {
    if (props.open) {
      setTitle(props.currentTitle);
      setError(null);
    }
  });

  // Reactive computations for form state
  const trimmedTitle = createMemo(() => title().trim());
  const trimmedCurrentTitle = createMemo(() => props.currentTitle.trim());
  const isFormDirty = createMemo(() => trimmedTitle() !== trimmedCurrentTitle());
  const isFormValid = createMemo(() => trimmedTitle().length > 0);
  const canSave = createMemo(() => isFormDirty() && isFormValid() && !isSaving() && !isGenerating());
  // Generate is available only after messages have loaded and there is at least one
  const canGenerate = createMemo(
    () => !isGenerating() && !isSaving() && !messages.loading && (messages() ?? []).length > 0,
  );

  const handleGenerate = async () => {
    if (!canGenerate()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const lastTurn = extractLastTurn(messages() ?? []);

      if (!lastTurn || lastTurn.trim() === "") {
        setError("No messages found to generate title from");
        return;
      }

      const generatedTitle = await generateTitle(workspaceId, lastTurn);
      setTitle(generatedTitle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate title");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!canSave()) return;

    setIsSaving(true);
    setError(null);

    try {
      await updateAgentTitle(workspaceId, props.agentId, trimmedTitle());
      props.onOpenChange(false);
      props.onSuccess?.(trimmedTitle());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update title");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isFormDirty()) {
      const confirmed = window.confirm("You have unsaved changes. Are you sure you want to cancel?");
      if (!confirmed) return;
    }
    props.onOpenChange(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && canSave()) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ "z-index": baseZIndex }} />
        <Dialog.Content
          class="fixed left-1/2 top-1/2 w-full max-w-md rounded-2xl p-6 border shadow-2xl -translate-x-1/2 -translate-y-1/2 bg-surface-raised border-border"
          style={{ "z-index": baseZIndex }}
        >
          <Dialog.Label class="text-2xl font-bold mb-2 text-heading">Edit Agent</Dialog.Label>
          <Dialog.Description class="mb-6 text-text-secondary">Update the agent's title</Dialog.Description>

          {/* Title Input */}
          <div class="mb-6 space-y-2">
            <label for="agent-title" class="text-sm font-medium text-text-primary block">
              Title
            </label>
            <input
              id="agent-title"
              type="text"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              disabled={isSaving() || isGenerating()}
              placeholder="Enter agent title"
              class="w-full px-3 py-2 bg-surface text-text-primary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              autofocus
            />
            <Show when={!isFormValid() && title().length > 0}>
              <p class="text-danger text-xs">Title cannot be empty</p>
            </Show>
          </div>

          {/* Error Message */}
          <Show when={error()}>
            <div class="mb-4 text-danger text-sm p-3 bg-surface-raised rounded-lg border border-danger break-words">
              {error()}
            </div>
          </Show>

          {/* Actions */}
          <div class="flex gap-3 justify-between">
            {/* Generate button on the left */}
            <Button
              variant="tertiary"
              onClick={handleGenerate}
              disabled={!canGenerate()}
              leftIcon={<Sparkles size={16} />}
              data-ph-capture-attribute-button-type="generate-agent-title"
              data-ph-capture-attribute-agent-id={props.agentId}
              data-ph-capture-attribute-is-generating={isGenerating() ? "true" : "false"}
            >
              {isGenerating() ? "Generating..." : "Generate"}
            </Button>

            {/* Cancel and Save on the right */}
            <div class="flex gap-3">
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={isSaving() || isGenerating()}
                data-ph-capture-attribute-button-type="cancel-edit-agent"
                data-ph-capture-attribute-agent-id={props.agentId}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={!canSave()}
                data-ph-capture-attribute-button-type="save-agent-title"
                data-ph-capture-attribute-agent-id={props.agentId}
                data-ph-capture-attribute-is-saving={isSaving() ? "true" : "false"}
              >
                {isSaving() ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default EditAgentDialog;
