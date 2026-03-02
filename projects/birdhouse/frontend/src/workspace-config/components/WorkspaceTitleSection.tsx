// ABOUTME: Editable workspace title with inline save/cancel buttons
// ABOUTME: Displays title or directory fallback, with edit mode for updating via API

import { type Component, createEffect, createSignal, Show } from "solid-js";
import Button from "../../components/ui/Button";
import { updateWorkspaceTitle } from "../services/workspace-config-api";

export interface WorkspaceTitleSectionProps {
  workspaceId: string;
  currentTitle: string | null;
  directory: string;
  onTitleUpdated?: () => void;
}

const WorkspaceTitleSection: Component<WorkspaceTitleSectionProps> = (props) => {
  const [isEditing, setIsEditing] = createSignal(false);
  const [localTitle, setLocalTitle] = createSignal("");
  const [isSaving, setIsSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  let inputRef: HTMLInputElement | undefined;

  // Auto-focus input when entering edit mode
  createEffect(() => {
    if (isEditing()) {
      inputRef?.focus();
    }
  });

  const displayTitle = () => {
    if (props.currentTitle?.trim()) {
      return props.currentTitle;
    }
    // Fallback to directory basename
    return props.directory.split("/").pop() || props.directory;
  };

  const handleEdit = () => {
    setLocalTitle(props.currentTitle || "");
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setLocalTitle("");
    setError(null);
  };

  const handleSave = async () => {
    const trimmedTitle = localTitle().trim();
    if (!trimmedTitle) {
      return; // Save button should be disabled, but double-check
    }

    setIsSaving(true);
    setError(null);

    try {
      await updateWorkspaceTitle(props.workspaceId, trimmedTitle);
      setIsEditing(false);
      setLocalTitle("");
      props.onTitleUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update title");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && localTitle().trim()) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleInput = (e: InputEvent) => {
    const target = e.currentTarget as HTMLInputElement;
    setLocalTitle(target.value);
    // Clear error when user starts typing
    if (error()) {
      setError(null);
    }
  };

  return (
    <div class="space-y-2">
      <Show
        when={isEditing()}
        fallback={
          <div class="flex items-center gap-3">
            <h2 class="text-2xl font-bold text-heading">{displayTitle()}</h2>
            <Button variant="secondary" onClick={handleEdit}>
              Edit
            </Button>
          </div>
        }
      >
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={localTitle()}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              disabled={isSaving()}
              placeholder="Enter workspace title"
              class="flex-1 px-3 py-2 bg-surface text-text-primary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button variant="primary" onClick={handleSave} disabled={!localTitle().trim() || isSaving()}>
              {isSaving() ? "Saving..." : "Save"}
            </Button>
            <Button variant="secondary" onClick={handleCancel} disabled={isSaving()}>
              Cancel
            </Button>
          </div>
          <Show when={error()}>
            <div class="text-danger text-sm p-2 bg-surface-raised rounded border border-danger">{error()}</div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default WorkspaceTitleSection;
