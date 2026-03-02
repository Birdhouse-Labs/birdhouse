// ABOUTME: Nested modal for viewing full pattern details
// ABOUTME: Shows description, trigger phrases (editable), and LLM prompt content

import Dialog from "corvu/dialog";
import { X } from "lucide-solid";
import { type Component, createSignal, Show } from "solid-js";
import MarkdownRenderer from "../../components/MarkdownRenderer";
import { cardSurfaceFlat } from "../../styles/containerStyles";
import type { Pattern } from "../types/pattern-library-types";
import TriggerPhraseEditor from "./TriggerPhraseEditor";

export interface PatternDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pattern: Pattern;
  onUpdateTriggerPhrases: (phrases: string[]) => Promise<void>;
}

const PatternDetailModal: Component<PatternDetailModalProps> = (props) => {
  const [isSaving, setIsSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleSaveTriggerPhrases = async (phrases: string[]) => {
    setIsSaving(true);
    setError(null);

    try {
      await props.onUpdateTriggerPhrases(phrases);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update trigger phrases");
      throw err;
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      closeOnOutsidePointer={false}
      closeOnOutsideFocus={false}
      preventScroll={false}
      restoreScrollPosition={false}
    >
      <Dialog.Portal mount={document.body}>
        <Dialog.Overlay class="fixed inset-0 bg-black/20" style={{ "z-index": "115" }} />
        <Dialog.Content
          class="fixed rounded-2xl shadow-2xl w-[90vw] h-[90dvh] max-w-[1200px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden bg-surface"
          style={{ "z-index": "117" }}
        >
          {/* Header */}
          <div class="px-6 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
            <Dialog.Label class="text-lg font-semibold text-heading">{props.pattern.title}</Dialog.Label>
            <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          {/* Scrollable Content */}
          <div class="flex-1 overflow-y-auto p-8 space-y-8">
            {/* Error Display */}
            <Show when={error()}>
              <div class="p-3 bg-danger/10 border border-danger rounded text-sm text-danger">{error()}</div>
            </Show>

            {/* Saving Indicator */}
            <Show when={isSaving()}>
              <div class="text-xs text-text-muted px-2">Saving changes...</div>
            </Show>

            {/* Description Section */}
            <Show when={props.pattern.description}>
              <section class="space-y-4">
                <h3 class="text-lg font-semibold text-heading">Description</h3>
                <div class={`rounded-xl ${cardSurfaceFlat} px-6 py-4`}>
                  <MarkdownRenderer content={props.pattern.description || ""} />
                </div>
              </section>
            </Show>

            {/* Trigger Phrases Section */}
            <section class="space-y-4">
              <h3 class="text-lg font-semibold text-heading">Trigger Phrases</h3>
              <TriggerPhraseEditor phrases={props.pattern.trigger_phrases} onSave={handleSaveTriggerPhrases} />
            </section>

            {/* Prompt Content Section */}
            <section class="space-y-4">
              <h3 class="text-lg font-semibold text-heading">What Gets Sent to the LLM</h3>
              <div class={`rounded-xl ${cardSurfaceFlat} overflow-hidden`}>
                {/* XML Wrapper Header */}
                <div class="px-4 py-2 bg-surface-overlay border-b border-border-muted font-mono text-xs text-text-muted">
                  &lt;birdhouse-pattern id="{props.pattern.id}"&gt;
                </div>

                {/* Prompt Content */}
                <div class="p-6">
                  <MarkdownRenderer content={props.pattern.prompt} />
                </div>

                {/* XML Wrapper Footer */}
                <div class="px-4 py-2 bg-surface-overlay border-t border-border-muted font-mono text-xs text-text-muted">
                  &lt;/birdhouse-pattern&gt;
                </div>
              </div>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default PatternDetailModal;
