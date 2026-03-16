// ABOUTME: Shared skill detail content for both the library detail pane and any nested detail dialogs.
// ABOUTME: Renders metadata, trigger phrases, supporting files, and XML preview for one selected skill.

import { ChevronRight, FolderOpen } from "lucide-solid";
import { type Component, createSignal, For, Show } from "solid-js";
import MarkdownRenderer from "../../components/MarkdownRenderer";
import { CodeBlock } from "../../components/ui/CodeBlock";
import IconButton from "../../components/ui/IconButton";
import { cardSurfaceFlat } from "../../styles/containerStyles";
import { resolvedCodeTheme } from "../../theme";
import { revealSkillLocation } from "../services/pattern-library-api";
import type { Pattern } from "../types/pattern-library-types";
import SkillTagList from "./SkillTagList";
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

const FRONTMATTER_LABELS: Record<string, string> = {
  description: "Description",
  license: "License",
  compatibility: "Compatibility",
  version: "Version",
  author: "Author",
  tags: "Tags",
  metadata: "Metadata",
};

function formatMetadataLabel(key: string): string {
  return (
    FRONTMATTER_LABELS[key] ??
    key
      .split(/[-_]/g)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export interface SkillDetailContentProps {
  pattern: Pattern;
  workspaceId: string;
  onUpdateTriggerPhrases: (phrases: string[]) => Promise<void>;
}

interface DetailSectionProps {
  title: string;
  defaultExpanded?: boolean;
  description?: string;
  children: import("solid-js").JSX.Element;
}

const DetailSection: Component<DetailSectionProps> = (props) => {
  const [expanded, setExpanded] = createSignal(props.defaultExpanded ?? false);

  return (
    <section class={`rounded-xl ${cardSurfaceFlat} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded())}
        class="w-full px-5 py-4 text-left transition-colors hover:bg-surface-overlay/50"
        aria-expanded={expanded()}
      >
        <div class="flex items-center gap-3">
          <ChevronRight
            size={18}
            class="text-heading transition-transform duration-200 flex-shrink-0 mt-0.5"
            classList={{
              "rotate-90": expanded(),
            }}
            />
          <div class="space-y-1 flex-1 min-w-0">
            <h3 class="text-lg font-semibold text-heading">{props.title}</h3>
            <Show when={props.description}>
              <p class="text-sm text-text-secondary">{props.description}</p>
            </Show>
          </div>
        </div>
      </button>
      <Show when={expanded()}>
        <div class="border-t border-border-muted/60 px-6 py-4">{props.children}</div>
      </Show>
    </section>
  );
};

const SkillDetailContent: Component<SkillDetailContentProps> = (props) => {
  const [isSaving, setIsSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [isRevealing, setIsRevealing] = createSignal(false);

  const scopeTitle = () => "Trigger Phrases";
  const scopeDescription = () => "Choose the phrases that suggest this skill while you type.";
  const descriptionValue = () => {
    const value = props.pattern.metadata["description"];
    return typeof value === "string" ? value : null;
  };
  const metadataEntries = () =>
    Object.entries(props.pattern.metadata).filter(([key]) => !["name", "description", "tags"].includes(key));
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
        <DetailSection title="Details" defaultExpanded={true}>
          <dl class="space-y-4">
            <Show when={descriptionValue()}>
              <div class="space-y-1">
                <dt class="text-sm font-semibold text-heading">Description</dt>
                <dd class="whitespace-pre-wrap break-words text-sm text-text-primary leading-relaxed">
                  {isMultilineText(descriptionValue() ?? "") ? (
                    <MarkdownRenderer content={descriptionValue() ?? ""} />
                  ) : (
                    descriptionValue()
                  )}
                </dd>
              </div>
            </Show>

            <Show when={props.pattern.tags.length > 0}>
              <div class="space-y-1">
                <dt class="text-sm font-semibold text-heading">Tags</dt>
                <dd>
                  <SkillTagList tags={props.pattern.tags} />
                </dd>
              </div>
            </Show>

            <For each={metadataEntries()}>
              {([key, value]) => (
                <div class="space-y-1">
                  <dt class="text-sm font-semibold text-heading">{formatMetadataLabel(key)}</dt>
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
              <dt class="text-sm font-semibold text-heading">Location</dt>
              <dd class="flex items-center gap-2 text-sm text-text-primary">
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
        </DetailSection>
      </Show>

      <DetailSection title={scopeTitle()} description={scopeDescription()} defaultExpanded={true}>
        <TriggerPhraseEditor phrases={props.pattern.trigger_phrases} onSave={handleSaveTriggerPhrases} />
      </DetailSection>

      <Show when={props.pattern.files.length > 0}>
        <DetailSection title="Other Files in Skill Directory" defaultExpanded={false}>
          <div class="flex flex-wrap gap-2">
            <For each={props.pattern.files}>
              {(file) => <span class="text-sm font-mono text-text-primary break-all">{file}</span>}
            </For>
          </div>
        </DetailSection>
      </Show>

      <DetailSection title="What Gets Sent to the LLM" defaultExpanded={false}>
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
      </DetailSection>
    </div>
  );
};

export default SkillDetailContent;
