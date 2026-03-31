// ABOUTME: Dialog for storing private scratchpad notes on an individual agent.
// ABOUTME: Loads notes on open and saves them when the user closes the scratchpad.

import Dialog from "corvu/dialog";
import { type Component, createEffect, createSignal, Show } from "solid-js";
import { useZIndex } from "../contexts/ZIndexContext";
import { clearAgentNote, getAgentNote, saveAgentNote } from "../services/agent-notes-api";
import { borderColor, cardSurfaceFlat } from "../styles/containerStyles";

export interface AgentNotesDialogProps {
  agentId: string;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SaveState = "idle" | "saving" | "error";

export function getAgentNotesDialogUiState(hasLoaded: boolean, loadFailed: boolean, saveState: SaveState) {
  return {
    errorMessage: loadFailed
      ? "Failed to load notes. Check your connection and try again."
      : saveState === "error"
        ? "Save failed. Your changes are still here."
        : null,
    isSaveDisabled: saveState === "saving" || !hasLoaded,
    isTextareaDisabled: !hasLoaded,
  };
}

const AgentNotesDialog: Component<AgentNotesDialogProps> = (props) => {
  const baseZIndex = useZIndex();
  const [text, setText] = createSignal("");
  const [saveState, setSaveState] = createSignal<SaveState>("idle");
  const [hasLoaded, setHasLoaded] = createSignal(false);
  const [loadFailed, setLoadFailed] = createSignal(false);
  let textareaRef: HTMLTextAreaElement | undefined;
  let lastPersistedText = "";
  let activeLoad = 0;
  let isClosing = false;

  const persistNote = async (currentText: string) => {
    if (!hasLoaded()) {
      return false;
    }

    if (currentText === lastPersistedText) {
      setSaveState("idle");
      return true;
    }

    try {
      if (currentText === "") {
        await clearAgentNote(props.workspaceId, props.agentId);
      } else {
        await saveAgentNote(props.workspaceId, props.agentId, currentText);
      }
      lastPersistedText = currentText;
      setSaveState("idle");
      return true;
    } catch {
      setSaveState("error");
      return false;
    }
  };

  const handleSaveAndClose = async () => {
    if (isClosing) {
      return;
    }

    isClosing = true;
    setSaveState("saving");
    const didSave = await persistNote(text());
    isClosing = false;

    if (didSave) {
      props.onOpenChange(false);
    }
  };

  createEffect(() => {
    if (!props.open) {
      activeLoad += 1;
      isClosing = false;
      return;
    }

    const loadId = ++activeLoad;
    setHasLoaded(false);
    setLoadFailed(false);
    setSaveState("idle");
    setText("");
    lastPersistedText = "";

    getAgentNote(props.workspaceId, props.agentId)
      .then((note) => {
        if (loadId !== activeLoad) return;
        lastPersistedText = note;
        setText(note);
        setHasLoaded(true);
        setSaveState("idle");
      })
      .catch(() => {
        if (loadId !== activeLoad) return;
        setLoadFailed(true);
      });
  });

  createEffect(() => {
    if (!props.open || !hasLoaded() || !textareaRef) return;
    textareaRef.focus();
  });

  const uiState = () => getAgentNotesDialogUiState(hasLoaded(), loadFailed(), saveState());

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (open) {
          props.onOpenChange(true);
          return;
        }

        void handleSaveAndClose();
      }}
      closeOnOutsideFocus={false}
      preventScroll={false}
    >
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ "z-index": baseZIndex }} />
        <Dialog.Content
          class={`fixed left-1/2 top-1/2 w-[min(92vw,42rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl ${cardSurfaceFlat} shadow-2xl`}
          style={{ "z-index": baseZIndex }}
        >
          <div class={`border-b px-5 py-4 ${borderColor}`}>
            <div>
              <Dialog.Label class="text-lg font-semibold text-heading">Agent Notes</Dialog.Label>
              <p class="mt-1 text-sm text-text-secondary">Jot down anything you want to remember for this agent.</p>
            </div>
          </div>

          <div class="p-5">
            <textarea
              ref={(el) => {
                textareaRef = el;
              }}
              value={text()}
              onInput={(e) => setText(e.currentTarget.value)}
              disabled={uiState().isTextareaDisabled}
              class="min-h-64 w-full resize-y rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent"
              placeholder="Scratchpad notes for this agent"
            />

            <Show when={uiState().errorMessage}>
              {(message) => <p class="mt-3 text-sm text-danger">{message()}</p>}
            </Show>

            <div class="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  void handleSaveAndClose();
                }}
                class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-on-accent transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={uiState().isSaveDisabled}
                aria-busy={saveState() === "saving" ? "true" : "false"}
              >
                Save & Close
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default AgentNotesDialog;
