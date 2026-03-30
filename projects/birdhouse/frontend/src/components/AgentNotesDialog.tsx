// ABOUTME: Dialog for storing private scratchpad notes on an individual agent.
// ABOUTME: Loads notes on open and autosaves them through the existing draft backend.

import Dialog from "corvu/dialog";
import { type Component, createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js";
import { useZIndex } from "../contexts/ZIndexContext";
import { clearAgentNote, getAgentNote, saveAgentNote } from "../services/agent-notes-api";
import { borderColor, cardSurfaceFlat } from "../styles/containerStyles";
import { createDebouncedSave } from "../utils/draft-persistence";

export interface AgentNotesDialogProps {
  agentId: string;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";

const AgentNotesDialog: Component<AgentNotesDialogProps> = (props) => {
  const baseZIndex = useZIndex();
  const [text, setText] = createSignal("");
  const [saveState, setSaveState] = createSignal<SaveState>("idle");
  const [hasLoaded, setHasLoaded] = createSignal(false);
  let textareaRef: HTMLTextAreaElement | undefined;
  let lastPersistedText = "";
  let activeLoad = 0;
  let suppressAutosave = false;

  const persistNote = async () => {
    const currentText = text();

    try {
      if (currentText === "") {
        await clearAgentNote(props.workspaceId, props.agentId);
      } else {
        await saveAgentNote(props.workspaceId, props.agentId, currentText);
      }
      lastPersistedText = currentText;
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const draftSave = createDebouncedSave(() => {
    setSaveState("saving");
    void persistNote();
  });

  onCleanup(() => draftSave.flush());

  createEffect(() => {
    if (!props.open) {
      activeLoad += 1;
      draftSave.flush();
      return;
    }

    const loadId = ++activeLoad;
    setHasLoaded(false);
    setSaveState("loading");

    getAgentNote(props.workspaceId, props.agentId)
      .then((note) => {
        if (loadId !== activeLoad) return;
        lastPersistedText = note;
        setText(note);
        setSaveState("idle");
      })
      .catch(() => {
        if (loadId !== activeLoad) return;
        setSaveState("error");
      })
      .finally(() => {
        if (loadId !== activeLoad) return;
        setHasLoaded(true);
      });
  });

  createEffect(() => {
    if (!props.open || !hasLoaded()) return;
    if (suppressAutosave) return;

    const currentText = text();
    if (currentText === lastPersistedText) return;

    draftSave.schedule();
  });

  createEffect(() => {
    if (!props.open || !hasLoaded() || !textareaRef) return;
    textareaRef.focus();
  });

  const handleClear = async () => {
    draftSave.cancel();
    suppressAutosave = true;
    setText("");
    setSaveState("saving");

    try {
      await clearAgentNote(props.workspaceId, props.agentId);
      lastPersistedText = "";
      setSaveState("saved");
      textareaRef?.focus();
    } catch {
      setSaveState("error");
    } finally {
      suppressAutosave = false;
    }
  };

  const statusText = createMemo(() => {
    switch (saveState()) {
      case "loading":
        return "Loading notes...";
      case "saving":
        return "Saving...";
      case "saved":
        return "Saved";
      case "error":
        return "Save failed";
      default:
        return "Private scratchpad for this agent";
    }
  });

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} closeOnOutsideFocus={false} preventScroll={false}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ "z-index": baseZIndex }} />
        <Dialog.Content
          class={`fixed left-1/2 top-1/2 w-[min(92vw,42rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl ${cardSurfaceFlat} shadow-2xl`}
          style={{ "z-index": baseZIndex }}
        >
          <div class={`flex items-center justify-between border-b px-5 py-4 ${borderColor}`}>
            <div>
              <Dialog.Label class="text-lg font-semibold text-heading">Agent Notes</Dialog.Label>
              <p class="mt-1 text-sm text-text-secondary">Jot down anything you want to remember for this agent.</p>
            </div>
            <Dialog.Close
              class="flex h-8 w-8 items-center justify-center rounded text-text-muted transition-colors hover:text-text-primary"
              aria-label="Close notes"
            >
              <span class="text-xl leading-none select-none">x</span>
            </Dialog.Close>
          </div>

          <div class="p-5">
            <textarea
              ref={(el) => {
                textareaRef = el;
              }}
              value={text()}
              onInput={(e) => setText(e.currentTarget.value)}
              class="min-h-64 w-full resize-y rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent"
              placeholder="Scratchpad notes for this agent"
            />

            <div class="mt-3 flex items-center justify-between gap-3 text-sm">
              <span
                classList={{
                  "text-text-secondary": saveState() !== "error",
                  "text-danger": saveState() === "error",
                }}
              >
                {statusText()}
              </span>

              <Show when={text() !== ""}>
                <button
                  type="button"
                  onClick={() => {
                    void handleClear();
                  }}
                  class="rounded-lg px-3 py-2 text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary"
                  aria-label="Clear notes"
                >
                  Clear
                </button>
              </Show>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default AgentNotesDialog;
