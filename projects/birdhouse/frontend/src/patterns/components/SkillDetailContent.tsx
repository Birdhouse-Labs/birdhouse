// ABOUTME: Shared skill detail content for both the library detail pane and any nested detail dialogs.
// ABOUTME: Renders metadata, trigger phrases, supporting files, and XML preview for one selected skill.

import { FolderOpen } from "lucide-solid";
import { type Component, createSignal, For, Show } from "solid-js";
import MarkdownRenderer from "../../components/MarkdownRenderer";
import { CodeBlock } from "../../components/ui/CodeBlock";
import IconButton from "../../components/ui/IconButton";
import { cardSurfaceFlat } from "../../styles/containerStyles";
import { resolvedCodeTheme } from "../../theme";
import { revealSkillLocation } from "../services/pattern-library-api";
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

function isStructuredMetadataValue(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}

function isMultilineText(value: string): boolean {
  return value.includes("\n");
}

export interface SkillDetailContentProps {
  pattern: Pattern;
  workspaceId: string;
  onUpdateTriggerPhrases: (phrases: string[]) => Promise<void>;
}

const SkillDetailContent: Component<SkillDetailContentProps> = (props) => {
  const [isSaving, setIsSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [isRevealing, setIsRevealing] = createSignal(false);

  const scopeTitle = () =>
    props.pattern.scope === "workspace" ? "Workspace trigger phrases" : "Shared trigger phrases";
  const scopeDescription = () =>
    props.pattern.scope === "workspace"
      ? "Applies only in this workspace because this skill resolves inside the current workspace directory."
      : "Applies across all workspaces because this skill resolves outside the current workspace directory.";
  const metadataEntries = () => Object.entries(props.pattern.metadata).filter(([key]) => key !== "name");
  const locationDisplay = () => props.pattern.display_location;

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

  const handleRevealLocation = async () => {
    setIsRevealing(true);
    setError(null);

    try {
      await revealSkillLocation(props.pattern.id, props.workspaceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reveal skill location");
    } finally {
      setIsRevealing(false);
    }
  };

  return (
    <div class="flex-1 overflow-y-auto p-8 space-y-8">
      <Show when={error()}>
        <div class="p-3 bg-danger/10 border border-danger rounded text-sm text-danger">{error()}</div>
      </Show>

      <Show when={isSaving()}>
        <div class="text-xs text-text-muted px-2">Saving changes...</div>
      </Show>

      <Show when={metadataEntries().length > 0 || props.pattern.display_location}>
        <section class="space-y-4">
          <h3 class="text-lg font-semibold text-heading">Metadata</h3>
          <div class={`rounded-xl ${cardSurfaceFlat} px-6 py-4`}>
            <dl class="space-y-4">
              <For each={metadataEntries()}>
                {([key, value]) => (
                  <div class="space-y-1">
                    <dt class="text-sm font-medium text-text-secondary">{key}</dt>
                    <Show
                      when={isStructuredMetadataValue(value)}
                      fallback={
                        <dd
                          classList={{
                            "whitespace-pre-wrap break-words text-sm text-text-primary leading-relaxed": true,
                            "font-mono": typeof value !== "string",
                          }}
                        >
                          {typeof value === "string" && isMultilineText(value) ? (
                            <MarkdownRenderer content={value} />
                          ) : (
                            formatMetadataValue(value)
                          )}
                        </dd>
                      }
                    >
                      <dd class="overflow-hidden rounded-lg border border-border-muted bg-surface-overlay/60">
                        <CodeBlock code={formatMetadataValue(value)} language="json" theme={resolvedCodeTheme()} />
                      </dd>
                    </Show>
                  </div>
                )}
              </For>
              <div class="space-y-1 pt-2 border-t border-border-muted/60">
                <dt class="text-sm font-medium text-text-secondary">Location</dt>
                <dd class="flex items-center gap-2 text-xs text-text-muted">
                  <span class="font-mono break-all flex-1">{locationDisplay()}</span>
                  <IconButton
                    icon={<FolderOpen size={16} />}
                    variant="ghost"
                    fixedSize={true}
                    disabled={isRevealing()}
                    aria-label="Reveal skill folder in Finder"
                    onClick={() => void handleRevealLocation()}
                  />
                </dd>
              </div>
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
  );
};

export default SkillDetailContent;
