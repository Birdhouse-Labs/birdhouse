// ABOUTME: Skill card component displaying title, description, and trigger phrase preview.
// ABOUTME: Uses the existing card layout while keeping skills read-only except for trigger phrases in detail.

import { Eye } from "lucide-solid";
import { type Component, For, Show } from "solid-js";
import { Button } from "../../components/ui";
import { cardSurfaceFlat } from "../../styles/containerStyles";
import type { PatternMetadata } from "../types/pattern-library-types";

export interface PatternCardProps {
  pattern: PatternMetadata;
  onView: (patternId: string) => void;
  onPreview: (patternId: string) => void;
  readonly?: boolean;
}

const PatternCard: Component<PatternCardProps> = (props) => {
  return (
    <div class={`p-4 rounded-lg ${cardSurfaceFlat}`}>
      <div class="flex items-start justify-between gap-3 mb-2">
        <div class="flex-1 min-w-0">
          <h4 class="text-sm font-semibold text-heading mb-1">{props.pattern.title}</h4>
          <Show when={props.pattern.description}>
            <p class="text-xs text-text-secondary line-clamp-2 mt-1">{props.pattern.description}</p>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <Show when={!props.readonly}>
            <button
              type="button"
              onClick={() => props.onPreview(props.pattern.id)}
              class="text-text-muted hover:text-accent transition-colors"
              aria-label="Preview skill"
            >
              <Eye size={16} />
            </button>
          </Show>
          <Button variant="tertiary" onClick={() => props.onView(props.pattern.id)}>
            View
          </Button>
        </div>
      </div>
      <div class="flex flex-wrap gap-1 mt-2">
        <For each={props.pattern.trigger_phrases.slice(0, 5)}>
          {(phrase) => (
            <span class="px-2 py-0.5 text-xs bg-surface-overlay text-text-muted rounded font-mono">{phrase}</span>
          )}
        </For>
        <Show when={props.pattern.trigger_phrases.length > 5}>
          <span class="px-2 py-0.5 text-xs text-text-muted">+{props.pattern.trigger_phrases.length - 5} more</span>
        </Show>
      </div>
    </div>
  );
};

export default PatternCard;
