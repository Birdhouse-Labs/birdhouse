// ABOUTME: Dialog showing skill attachments for the current composer preview or saved message snapshot.
// ABOUTME: Lets the user inspect the exact XML-backed skill content Birdhouse sends to the model.

import Dialog from "corvu/dialog";
import { LibraryBig } from "lucide-solid";
import { type Component, createEffect, createMemo, createSignal, Show } from "solid-js";
import { useZIndex } from "../../contexts/ZIndexContext";
import { cardSurfaceFlat } from "../../styles/containerStyles";
import MarkdownRenderer from "../MarkdownRenderer";
import { Combobox } from "./Combobox";

export interface SkillAttachmentSnapshot {
  name: string;
  content: string;
}

export interface PatternReferencesDialogProps {
  attachments: SkillAttachmentSnapshot[];
  open: boolean;
  onClose: () => void;
  initialSkillName?: string;
}

export const PatternReferencesDialog: Component<PatternReferencesDialogProps> = (props) => {
  const baseZIndex = useZIndex();
  const [selectedSkillName, setSelectedSkillName] = createSignal<string | undefined>(
    props.initialSkillName || props.attachments[0]?.name,
  );

  createEffect(() => {
    if (!props.open) {
      return;
    }

    setSelectedSkillName(props.initialSkillName || props.attachments[0]?.name);
  });

  const selectedAttachment = createMemo(() => {
    const selectedName = selectedSkillName();
    return props.attachments.find((attachment) => attachment.name === selectedName) || props.attachments[0];
  });

  const comboboxOptions = createMemo(() =>
    props.attachments.map((attachment) => ({
      value: attachment.name,
      label: attachment.name,
      description: attachment.name,
    })),
  );

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/50" style={{ "z-index": baseZIndex }} />
        <div class="fixed inset-0 flex items-center justify-center p-4" style={{ "z-index": baseZIndex }}>
          <Dialog.Content class="w-full max-w-3xl h-[80vh] bg-surface-raised border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div class="px-4 py-1 border-b border-border flex items-center justify-between bg-surface-raised">
              <Dialog.Label class="text-sm font-medium text-text-primary flex items-center gap-2">
                <LibraryBig size={18} />
                Attached Skills
              </Dialog.Label>
              <Dialog.Close
                class="rounded-lg p-2 hover:bg-surface-overlay transition-colors text-text-muted hover:text-text-primary"
                aria-label="Close dialog"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Dialog.Close>
            </div>

            <div class="flex-1 overflow-y-auto p-6 space-y-6 bg-surface">
              <Show
                when={props.attachments.length > 0}
                fallback={<div class="text-center text-text-muted">No skills attached</div>}
              >
                <div>
                  <div class="block text-sm font-medium text-text-primary mb-2">Select Skill</div>
                  <Combobox
                    options={comboboxOptions()}
                    value={selectedSkillName()}
                    onSelect={(name) => setSelectedSkillName(name)}
                    onPreview={(name) => setSelectedSkillName(name)}
                    placeholder="Choose a skill..."
                  />
                </div>

                <Show when={selectedAttachment()}>
                  {(attachment) => (
                    <div class="space-y-4">
                      <h3 class="text-lg font-semibold text-heading">What Gets Sent to the LLM</h3>
                      <div class={`rounded-xl ${cardSurfaceFlat} overflow-hidden`}>
                        <div class="px-4 py-2 bg-surface-overlay border-b border-border-muted font-mono text-xs text-text-muted">
                          &lt;skill name="{attachment().name}"&gt;
                        </div>
                        <div class="p-6">
                          <MarkdownRenderer content={attachment().content} />
                        </div>
                        <div class="px-4 py-2 bg-surface-overlay border-t border-border-muted font-mono text-xs text-text-muted">
                          &lt;/skill&gt;
                        </div>
                      </div>
                    </div>
                  )}
                </Show>
              </Show>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
};

export default PatternReferencesDialog;
