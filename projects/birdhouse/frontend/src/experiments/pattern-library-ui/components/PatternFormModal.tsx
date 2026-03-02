// ABOUTME: Modal for creating and editing patterns
// ABOUTME: Supports both create mode (empty fields) and edit mode (pre-filled, respects readonly)

import Dialog from "corvu/dialog";
import { Eye, X } from "lucide-solid";
import { type Component, createEffect, createSignal, For, Show } from "solid-js";
import MarkdownRenderer from "../../../components/MarkdownRenderer";
import { Button } from "../../../components/ui";
import type { Pattern } from "../types/pattern-library-types";

export interface PatternFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  groupId: string;
  existingPattern?: Pattern;
  onSave: (data: { title: string; description?: string; prompt: string; triggerPhrases: string[] }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

const PatternFormModal: Component<PatternFormModalProps> = (props) => {
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [prompt, setPrompt] = createSignal("");
  const [triggerPhrases, setTriggerPhrases] = createSignal<string[]>([]);
  const [newPhrase, setNewPhrase] = createSignal("");
  const [isSaving, setIsSaving] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);
  const [confirmingDelete, setConfirmingDelete] = createSignal(false);
  const [confirmingCancel, setConfirmingCancel] = createSignal(false);
  const [showPreview, setShowPreview] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [phraseError, setPhraseError] = createSignal<string | null>(null);

  // Track initial values to detect changes
  const [initialTitle, setInitialTitle] = createSignal("");
  const [initialDescription, setInitialDescription] = createSignal("");
  const [initialPrompt, setInitialPrompt] = createSignal("");
  const [initialTriggerPhrases, setInitialTriggerPhrases] = createSignal<string[]>([]);

  const handleDelete = async () => {
    if (!confirmingDelete()) {
      setConfirmingDelete(true);
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      await props.onDelete?.();
      props.onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete pattern");
    } finally {
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  };

  // Reset form when dialog opens
  createEffect(() => {
    if (props.open) {
      if (props.mode === "edit" && props.existingPattern) {
        const initTitle = props.existingPattern.title;
        const initDesc = props.existingPattern.description || "";
        const initPrompt = props.existingPattern.prompt;
        const initPhrases = props.existingPattern.trigger_phrases || [];

        setTitle(initTitle);
        setDescription(initDesc);
        setPrompt(initPrompt);
        setTriggerPhrases(initPhrases);

        // Store initial values
        setInitialTitle(initTitle);
        setInitialDescription(initDesc);
        setInitialPrompt(initPrompt);
        setInitialTriggerPhrases(initPhrases);
      } else {
        setTitle("");
        setDescription("");
        setPrompt("");
        setTriggerPhrases([]);

        // Store initial values
        setInitialTitle("");
        setInitialDescription("");
        setInitialPrompt("");
        setInitialTriggerPhrases([]);
      }
      setNewPhrase("");
      setError(null);
      setConfirmingDelete(false);
      setConfirmingCancel(false);
    }
  });

  const isReadonly = () => props.mode === "edit" && props.existingPattern?.readonly;

  // Check if form has unsaved changes
  const isDirty = () => {
    if (title() !== initialTitle()) return true;
    if (description() !== initialDescription()) return true;
    if (prompt() !== initialPrompt()) return true;

    // Compare trigger phrases arrays
    const current = triggerPhrases();
    const initial = initialTriggerPhrases();
    if (current.length !== initial.length) return true;
    for (let i = 0; i < current.length; i++) {
      if (current[i] !== initial[i]) return true;
    }

    return false;
  };

  const addPhrase = () => {
    const phrase = newPhrase().trim();

    if (!phrase) {
      return;
    }

    if (triggerPhrases().includes(phrase)) {
      setPhraseError("This trigger phrase already exists");
      // Clear error after 3 seconds
      setTimeout(() => setPhraseError(null), 3000);
      return;
    }

    setTriggerPhrases([...triggerPhrases(), phrase]);
    setNewPhrase("");
    setPhraseError(null);
  };

  const removePhrase = (phrase: string) => {
    setTriggerPhrases(triggerPhrases().filter((p) => p !== phrase));
  };

  const handleSave = async () => {
    const titleValue = title().trim();
    const promptValue = prompt().trim();

    if (!titleValue) {
      setError("Title is required");
      return;
    }

    if (!promptValue) {
      setError("Prompt content is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const descValue = description().trim();
      await props.onSave({
        title: titleValue,
        ...(descValue ? { description: descValue } : {}),
        prompt: promptValue,
        triggerPhrases: triggerPhrases(),
      });
      props.onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pattern");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // If there are unsaved changes, show confirmation
    if (isDirty() && !confirmingCancel()) {
      setConfirmingCancel(true);
      return;
    }

    // Reset confirmation state and close
    setConfirmingCancel(false);
    props.onOpenChange(false);
  };

  const handleCancelConfirmed = () => {
    setConfirmingCancel(false);
    props.onOpenChange(false);
  };

  const handleCancelAborted = () => {
    setConfirmingCancel(false);
  };

  // Handle keyboard events
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && isDirty()) {
      e.preventDefault();
      e.stopPropagation();
      setConfirmingCancel(true);
    }
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        // If trying to close and there are unsaved changes, show confirmation
        if (!open && isDirty()) {
          setConfirmingCancel(true);
          return;
        }
        props.onOpenChange(open);
      }}
    >
      <Dialog.Portal mount={document.body}>
        <Dialog.Overlay class="fixed inset-0 bg-black/40" style={{ "z-index": "120" }} />
        <Dialog.Content
          class="fixed rounded-2xl shadow-2xl w-[90vw] h-[90dvh] max-w-[1200px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden bg-surface"
          style={{ "z-index": "122" }}
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div class="px-6 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
            <Dialog.Label class="text-lg font-semibold text-heading">
              {props.mode === "create" ? "Create Pattern" : "Edit Pattern"}
            </Dialog.Label>
            <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          {/* Scrollable Content */}
          <div class="flex-1 overflow-y-auto p-8 space-y-6">
            {/* Error Display */}
            <Show when={error()}>
              <div class="p-3 bg-danger/10 border border-danger rounded text-sm text-danger">{error()}</div>
            </Show>

            {/* Title Field */}
            <div class="space-y-2">
              <div class="block text-sm font-semibold text-heading">
                Title <span class="text-danger">*</span>
              </div>
              <input
                type="text"
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
                placeholder="Pattern title"
                disabled={isReadonly()}
                class="w-full px-4 py-3 bg-surface text-text-primary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Description Field */}
            <div class="space-y-2">
              <div class="block text-sm font-semibold text-heading">Description (optional)</div>
              <textarea
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                placeholder="Brief description (2-3 sentences)"
                rows={3}
                disabled={isReadonly()}
                class="w-full px-4 py-3 bg-surface text-text-primary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Trigger Phrases Field */}
            <div class="space-y-2">
              <div class="block text-sm font-semibold text-heading">Trigger Phrases (optional)</div>
              <div class="space-y-2">
                {/* Existing phrases */}
                <Show when={triggerPhrases().length > 0}>
                  <div class="flex flex-wrap gap-2">
                    <For each={triggerPhrases()}>
                      {(phrase) => (
                        <div class="flex items-center gap-1 px-2 py-1 bg-surface-overlay rounded text-sm">
                          <span class="font-mono text-text-primary">{phrase}</span>
                          <button
                            type="button"
                            onClick={() => removePhrase(phrase)}
                            class="text-text-muted hover:text-danger transition-colors"
                            disabled={isReadonly()}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                {/* Add new phrase */}
                <Show when={!isReadonly()}>
                  <div class="space-y-1">
                    <div class="flex gap-2">
                      <input
                        type="text"
                        value={newPhrase()}
                        onInput={(e) => {
                          setNewPhrase(e.currentTarget.value);
                          // Clear error when user starts typing
                          if (phraseError()) setPhraseError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addPhrase();
                          }
                        }}
                        placeholder="Add a trigger phrase..."
                        class="flex-1 px-4 py-2 bg-surface text-text-primary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-sm"
                        classList={{
                          "border-danger": !!phraseError(),
                        }}
                      />
                      <Button variant="secondary" onClick={addPhrase} disabled={!newPhrase().trim()}>
                        Add
                      </Button>
                    </div>
                    <Show when={phraseError()}>
                      <p class="text-xs text-danger px-1">{phraseError()}</p>
                    </Show>
                  </div>
                </Show>
              </div>
            </div>

            {/* Prompt Content Field */}
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <div class="block text-sm font-semibold text-heading">
                  What Gets Sent to the LLM <span class="text-danger">*</span>
                </div>
                <Button variant="tertiary" onClick={() => setShowPreview(true)} leftIcon={<Eye size={16} />}>
                  Preview
                </Button>
              </div>
              <textarea
                value={prompt()}
                onInput={(e) => setPrompt(e.currentTarget.value)}
                placeholder="Prompt content sent to LLM..."
                rows={15}
                disabled={isReadonly()}
                class="w-full px-4 py-3 bg-surface text-text-primary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all resize-none font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Readonly Notice */}
            <Show when={isReadonly()}>
              <div class="text-sm text-text-muted italic">
                This is a bundled pattern. Only trigger phrases can be edited.
              </div>
            </Show>

            {/* Danger Zone - edit mode only, non-readonly */}
            <Show when={props.mode === "edit" && !isReadonly() && props.onDelete}>
              <div class="border border-danger/30 rounded-lg p-4 space-y-3">
                <h3 class="text-sm font-semibold text-danger">Danger Zone</h3>
                <div class="flex items-center justify-between gap-4">
                  <p class="text-sm text-text-secondary">Permanently delete this pattern. This cannot be undone.</p>
                  <Show
                    when={confirmingDelete()}
                    fallback={
                      <Button variant="danger" onClick={handleDelete} disabled={isDeleting()}>
                        Delete Pattern
                      </Button>
                    }
                  >
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <span class="text-xs text-danger">Are you sure?</span>
                      <Button variant="danger" onClick={handleDelete} disabled={isDeleting()}>
                        {isDeleting() ? "Deleting..." : "Yes, Delete"}
                      </Button>
                      <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={isDeleting()}>
                        Cancel
                      </Button>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>
          </div>

          {/* Footer Actions */}
          <div class="flex gap-3 justify-end p-6 border-t border-border flex-shrink-0">
            <Button variant="secondary" onClick={handleCancel} disabled={isSaving()}>
              Cancel
            </Button>
            <Show when={!isReadonly()}>
              <Button variant="primary" onClick={handleSave} disabled={isSaving()}>
                {isSaving() ? "Saving..." : props.mode === "create" ? "Create Pattern" : "Save Changes"}
              </Button>
            </Show>
          </div>

          {/* Preview Dialog */}
          <Dialog open={showPreview()} onOpenChange={setShowPreview}>
            <Dialog.Portal mount={document.body}>
              <Dialog.Overlay class="fixed inset-0 bg-black/60" style={{ "z-index": "125" }} />
              <Dialog.Content
                class="fixed rounded-2xl shadow-2xl w-[90vw] h-[90dvh] max-w-[1200px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden bg-surface"
                style={{ "z-index": "127" }}
              >
                <div class="px-6 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
                  <Dialog.Label class="text-lg font-semibold text-heading">
                    Preview: What Gets Sent to the LLM
                  </Dialog.Label>
                  <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors">
                    <X size={20} />
                  </Dialog.Close>
                </div>

                <div class="flex-1 overflow-y-auto p-4">
                  <div class="rounded-xl overflow-hidden bg-surface border border-border-muted">
                    {/* XML Wrapper Header */}
                    <div class="px-4 py-2 bg-surface-overlay border-b border-border-muted font-mono text-xs text-text-muted">
                      &lt;birdhouse-pattern id="{props.existingPattern?.id || "new"}"&gt;
                    </div>

                    {/* Prompt Content */}
                    <div class="p-4">
                      <Show
                        when={prompt().trim()}
                        fallback={<p class="text-text-muted italic">No content to preview</p>}
                      >
                        <MarkdownRenderer content={prompt()} />
                      </Show>
                    </div>

                    {/* XML Wrapper Footer */}
                    <div class="px-4 py-2 bg-surface-overlay border-t border-border-muted font-mono text-xs text-text-muted">
                      &lt;/birdhouse-pattern&gt;
                    </div>
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog>

          {/* Nested Confirmation Dialog */}
          <Dialog open={confirmingCancel()} onOpenChange={setConfirmingCancel}>
            <Dialog.Portal mount={document.body}>
              <Dialog.Overlay class="fixed inset-0 bg-black/60" style={{ "z-index": "125" }} />
              <Dialog.Content
                class="fixed rounded-2xl shadow-2xl w-[90vw] max-w-[450px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface p-6"
                style={{ "z-index": "127" }}
              >
                <Dialog.Label class="text-lg font-semibold text-heading mb-3">Discard unsaved changes?</Dialog.Label>
                <Dialog.Description class="text-sm text-text-secondary mb-6">
                  You have unsaved changes. Are you sure you want to close without saving?
                </Dialog.Description>
                <div class="flex gap-3 justify-end">
                  <Button variant="secondary" onClick={handleCancelAborted}>
                    Keep Editing
                  </Button>
                  <Button variant="danger" onClick={handleCancelConfirmed}>
                    Discard Changes
                  </Button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default PatternFormModal;
