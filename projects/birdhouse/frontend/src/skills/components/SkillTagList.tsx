// ABOUTME: Renders skill metadata tags using the shared chip style from the library list.
// ABOUTME: Supports optional truncation for compact list layouts and full rendering in detail views.

import { type Component, For, Show } from "solid-js";

export interface SkillTagListProps {
  tags: string[];
  maxVisible?: number;
}

const tagChipClass =
  "px-2 py-0.5 text-xs rounded-full bg-surface-overlay text-text-primary border border-border-muted/70";

const SkillTagList: Component<SkillTagListProps> = (props) => {
  const visibleTags = () => props.tags.slice(0, props.maxVisible ?? props.tags.length);
  const remainingCount = () => props.tags.length - visibleTags().length;

  return (
    <div class="flex flex-wrap gap-1">
      <For each={visibleTags()}>{(tag) => <span class={tagChipClass}>{tag}</span>}</For>
      <Show when={remainingCount() > 0}>
        <span class="px-2 py-0.5 text-xs text-text-muted">+{remainingCount()} more</span>
      </Show>
    </div>
  );
};

export default SkillTagList;
