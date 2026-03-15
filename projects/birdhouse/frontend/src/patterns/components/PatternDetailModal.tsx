// ABOUTME: Nested modal for viewing skill detail from the reused library shell.
// ABOUTME: Shows SKILL.md content, trigger phrase scope, and the XML block preview for runtime attachment.

import Dialog from "corvu/dialog";
import { X } from "lucide-solid";
import { type Component, createSignal, For, Show } from "solid-js";
import MarkdownRenderer from "../../components/MarkdownRenderer";
import { cardSurfaceFlat } from "../../styles/containerStyles";
import type { Pattern } from "../types/pattern-library-types";
import TriggerPhraseEditor from "./TriggerPhraseEditor";

function formatMetadataValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null) {
    return "null";
  }

  return JSON.stringify(value, null, 2);
}

export interface PatternDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pattern: Pattern;
  onUpdateTriggerPhrases: (phrases: string[]) => Promise<void>;
}

const PatternDetailModal: Component<PatternDetailModalProps> = (props) => {
  const [isSaving, setIsSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const scopeTitle = () =>
    props.pattern.scope === "workspace" ? "Workspace trigger phrases" : "Shared trigger phrases";
  const scopeDescription = () =>
    props.pattern.scope === "workspace"
      ? "Applies only in this workspace because this skill resolves inside the current workspace directory."
      : "Applies across all workspaces because this skill resolves outside the current workspace directory.";
  const metadataEntries = () => Object.entries(props.pattern.metadata).filter(([key]) => key !== "name");

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
          <div class="px-6 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
            <Dialog.Label class="text-lg font-semibold text-heading">{props.pattern.title}</Dialog.Label>
            <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          <div class="flex-1 overflow-y-auto p-8 space-y-8">
            <Show when={error()}>
              <div class="p-3 bg-danger/10 border border-danger rounded text-sm text-danger">{error()}</div>
            </Show>

            <Show when={isSaving()}>
              <div class="text-xs text-text-muted px-2">Saving changes...</div>
            </Show>

            <Show when={metadataEntries().length > 0}>
              <section class="space-y-4">
                <h3 class="text-lg font-semibold text-heading">Metadata</h3>
                <div class={`rounded-xl ${cardSurfaceFlat} px-6 py-4`}>
                  <dl class="space-y-4">
                    <For each={metadataEntries()}>
                      {([key, value]) => (
                        <div class="space-y-1">
                          <dt class="text-xs font-semibold uppercase tracking-wide text-text-muted">{key}</dt>
                          <dd class="whitespace-pre-wrap break-words font-mono text-sm text-text-primary">
                            {formatMetadataValue(value)}
                          </dd>
                        </div>
                      )}
                    </For>
                  </dl>
                </div>
              </section>
            </Show>

            <section class="space-y-4">
              <div class="space-y-1">
                <h3 class="text-lg font-semibold text-heading">{scopeTitle()}</h3>
                <p class="text-sm text-text-secondary">{scopeDescription()}</p>
              </div>
              <TriggerPhraseEditor phrases={props.pattern.trigger_phrases} onSave={handleSaveTriggerPhrases} />
            </section>

            <section class="space-y-4">
              <h3 class="text-lg font-semibold text-heading">Resolved Skill File</h3>
              <div class={`rounded-xl ${cardSurfaceFlat} px-6 py-4`}>
                <p class="text-sm font-mono text-text-primary break-all">{props.pattern.location}</p>
              </div>
            </section>

            <Show when={props.pattern.files.length > 0}>
              <section class="space-y-4">
                <h3 class="text-lg font-semibold text-heading">Other Files in Skill Directory</h3>
                <div class={`rounded-xl ${cardSurfaceFlat} px-6 py-4`}>
                  <div class="flex flex-wrap gap-2">
                    <For each={props.pattern.files}>
                      {(file) => <span class="text-sm font-mono text-text-primary break-all">{file}</span>}
                    </For>
                  </div>
                </div>
              </section>
            </Show>

            <section class="space-y-4">
              <h3 class="text-lg font-semibold text-heading">What Gets Sent to the LLM</h3>
              <div class={`rounded-xl ${cardSurfaceFlat} overflow-hidden`}>
                <div class="px-4 py-2 bg-surface-overlay border-b border-border-muted font-mono text-xs text-text-muted">
                  &lt;skill name="{props.pattern.title}"&gt;
                </div>

                <div class="p-6">
                  <MarkdownRenderer content={props.pattern.prompt} />
                </div>

                <div class="px-4 py-2 bg-surface-overlay border-t border-border-muted font-mono text-xs text-text-muted">
                  &lt;/skill&gt;
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
