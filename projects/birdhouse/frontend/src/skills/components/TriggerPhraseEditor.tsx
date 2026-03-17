// ABOUTME: Reusable trigger phrase editor with add/edit/delete functionality
// ABOUTME: Extracted from Experiment 1, supports inline editing and confirmation for deletion

import { type Component, createEffect, createSignal, For, Show } from "solid-js";
import { cardSurfaceFlat } from "../../styles/containerStyles";

export interface TriggerPhraseEditorProps {
  phrases: string[];
  disabled?: boolean;
  onSave: (phrases: string[]) => Promise<void>;
}

const TriggerPhraseEditor: Component<TriggerPhraseEditorProps> = (props) => {
  // State for editing existing phrase
  const [editingPhrase, setEditingPhrase] = createSignal<string | null>(null);
  const [editPhraseInput, setEditPhraseInput] = createSignal("");

  // State for adding new phrase
  const [isAddingPhrase, setIsAddingPhrase] = createSignal(false);
  const [newPhraseInput, setNewPhraseInput] = createSignal("");

  // State for delete confirmation
  const [confirmingDelete, setConfirmingDelete] = createSignal<string | null>(null);
  let deleteTimeoutId: number | undefined;

  // Refs for auto-focusing
  let editInputRef: HTMLInputElement | undefined;
  let addInputRef: HTMLInputElement | undefined;

  // Auto-focus edit input
  createEffect(() => {
    if (editingPhrase()) {
      queueMicrotask(() => editInputRef?.focus());
    }
  });

  // Auto-focus add input
  createEffect(() => {
    if (isAddingPhrase()) {
      queueMicrotask(() => addInputRef?.focus());
    }
  });

  const startEditPhrase = (phrase: string) => {
    setEditingPhrase(phrase);
    setEditPhraseInput(phrase);
  };

  const saveEditPhrase = async (oldPhrase: string) => {
    const newPhrase = editPhraseInput().trim();
    if (!newPhrase) return;

    const updated = props.phrases.map((p) => (p === oldPhrase ? newPhrase : p));
    await props.onSave(updated);

    setEditingPhrase(null);
    setEditPhraseInput("");
  };

  const cancelEditPhrase = () => {
    setEditingPhrase(null);
    setEditPhraseInput("");
  };

  const startDeleteConfirmation = (phrase: string) => {
    if (deleteTimeoutId !== undefined) {
      clearTimeout(deleteTimeoutId);
    }
    setConfirmingDelete(phrase);
    deleteTimeoutId = setTimeout(() => {
      setConfirmingDelete(null);
    }, 2000) as unknown as number;
  };

  const removeTriggerPhrase = async (phrase: string) => {
    if (deleteTimeoutId !== undefined) {
      clearTimeout(deleteTimeoutId);
    }

    const updated = props.phrases.filter((p) => p !== phrase);
    await props.onSave(updated);

    setConfirmingDelete(null);
  };

  const addTriggerPhrase = async () => {
    const phrase = newPhraseInput().trim();
    if (!phrase) return;

    const updated = [...props.phrases, phrase];
    await props.onSave(updated);

    setNewPhraseInput("");
    setIsAddingPhrase(false);
  };

  const cancelAddPhrase = () => {
    setNewPhraseInput("");
    setIsAddingPhrase(false);
  };

  return (
    <div class={`rounded-xl ${cardSurfaceFlat} p-6 space-y-1`}>
      <For each={props.phrases}>
        {(phrase) => (
          <Show
            when={editingPhrase() === phrase}
            fallback={
              <div class="flex items-center gap-2 group">
                <span class="text-text-muted flex-shrink-0">•</span>
                <span class="text-sm font-mono text-text-primary flex-1">{phrase}</span>
                <Show when={!props.disabled}>
                  <div class="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <button
                      type="button"
                      onClick={() => startEditPhrase(phrase)}
                      class="p-1 hover:bg-accent/10 rounded transition-all flex-shrink-0"
                      title="Edit trigger phrase"
                    >
                      <svg
                        class="w-3 h-3 text-text-muted hover:text-accent"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    <Show
                      when={confirmingDelete() === phrase}
                      fallback={
                        <button
                          type="button"
                          onClick={() => startDeleteConfirmation(phrase)}
                          class="p-1 hover:bg-danger/10 rounded transition-all flex-shrink-0"
                          title="Remove trigger phrase"
                        >
                          <svg
                            class="w-3 h-3 text-text-muted hover:text-danger"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      }
                    >
                      <button
                        type="button"
                        onClick={() => removeTriggerPhrase(phrase)}
                        class="px-2 py-1 bg-danger/10 hover:bg-danger/20 rounded transition-all flex-shrink-0 text-xs font-medium text-danger"
                        title="Click again to confirm deletion"
                      >
                        Confirm
                      </button>
                    </Show>
                  </div>
                </Show>
              </div>
            }
          >
            <div class="flex items-center gap-2">
              <span class="text-text-muted flex-shrink-0">•</span>
              <input
                ref={editInputRef}
                type="text"
                value={editPhraseInput()}
                onInput={(e) => setEditPhraseInput(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    saveEditPhrase(phrase);
                  } else if (e.key === "Escape") {
                    cancelEditPhrase();
                  }
                }}
                class="flex-1 px-2 py-1 text-sm font-mono text-text-primary bg-surface-raised border border-border-muted rounded focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
              <button
                type="button"
                onClick={() => saveEditPhrase(phrase)}
                class="px-2 py-1 text-xs bg-accent text-text-on-accent rounded hover:opacity-90 transition-opacity"
                disabled={!editPhraseInput().trim()}
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelEditPhrase}
                class="px-2 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </Show>
        )}
      </For>

      {/* Add new phrase input or button */}
      <Show when={!props.disabled}>
        <Show
          when={isAddingPhrase()}
          fallback={
            <button
              type="button"
              onClick={() => setIsAddingPhrase(true)}
              class="flex items-center gap-2 text-sm text-text-muted hover:text-accent transition-colors group mt-2"
            >
              <svg
                class="w-3 h-3 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add trigger phrase</span>
            </button>
          }
        >
          <div class="flex items-center gap-2">
            <input
              ref={addInputRef}
              type="text"
              value={newPhraseInput()}
              onInput={(e) => setNewPhraseInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addTriggerPhrase();
                } else if (e.key === "Escape") {
                  cancelAddPhrase();
                }
              }}
              placeholder="Enter trigger phrase..."
              class="flex-1 px-3 py-2 text-sm font-mono text-text-primary bg-surface-raised border border-border-muted rounded focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
            <button
              type="button"
              onClick={addTriggerPhrase}
              class="px-3 py-2 text-sm bg-accent text-text-on-accent rounded hover:opacity-90 transition-opacity"
              disabled={!newPhraseInput().trim()}
            >
              Add
            </button>
            <button
              type="button"
              onClick={cancelAddPhrase}
              class="px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default TriggerPhraseEditor;
