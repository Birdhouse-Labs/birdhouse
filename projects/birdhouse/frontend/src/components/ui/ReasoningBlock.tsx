// ABOUTME: Renders LLM reasoning/thinking content as a collapsible card
// ABOUTME: Minimal one-line display when collapsed, full markdown content when expanded

import { ChevronDown, ChevronUp, Lightbulb } from "lucide-solid";
import { type Component, createMemo, createSignal, Show } from "solid-js";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import type { ReasoningBlock as ReasoningBlockType } from "../../types/messages";
import { MarkdownRenderer } from "../MarkdownRenderer";

export interface ReasoningBlockProps {
  block: ReasoningBlockType;
}

const ReasoningBlock: Component<ReasoningBlockProps> = (props) => {
  const { workspaceId } = useWorkspace();
  const [isExpanded, setIsExpanded] = createSignal(false);

  // Calculate duration from time.start and time.end
  const duration = createMemo(() => {
    const time = props.block.time;
    if (!time?.start || !time?.end) return undefined;
    const ms = time.end - time.start;
    return `${(ms / 1000).toFixed(1)}s`;
  });

  // Get first ~60 chars of content as preview, clean up whitespace
  const preview = createMemo(() => {
    const content = props.block.content.trim();
    // Replace newlines and multiple spaces with single space
    const cleaned = content.replace(/\s+/g, " ");
    return cleaned;
  });

  return (
    <div
      class="my-2 overflow-hidden rounded-lg border group/toolcard transition-colors"
      classList={{
        "border-border": isExpanded(),
        "border-transparent hover:border-border": !isExpanded(),
      }}
    >
      {/* Header - one line */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded())}
        class="w-full px-3 py-2 flex items-center gap-2 bg-transparent hover:bg-surface-overlay/50 border-b border-transparent hover:border-border transition-colors"
        aria-expanded={isExpanded()}
      >
        {/* Icon: MessageCircle (thought bubble) normally, Chevron on hover */}
        <div class="flex-shrink-0 relative w-4 h-4">
          <div class="absolute inset-0 opacity-100 group-hover/toolcard:opacity-0 transition-opacity flex items-center justify-center">
            <Lightbulb size={16} class="text-accent" />
          </div>
          <div class="absolute inset-0 opacity-0 group-hover/toolcard:opacity-100 transition-opacity flex items-center justify-center">
            {isExpanded() ? (
              <ChevronUp size={16} class="text-text-secondary" />
            ) : (
              <ChevronDown size={16} class="text-text-secondary" />
            )}
          </div>
        </div>

        {/* Label */}
        <span class="text-sm text-text-secondary flex-shrink-0">Reasoning</span>

        {/* Duration */}
        <Show when={duration() && !props.block.isStreaming}>
          <span class="text-xs text-text-muted flex-shrink-0">{duration()}</span>
        </Show>

        {/* Streaming indicator */}
        <Show when={props.block.isStreaming}>
          <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-accent flex-shrink-0" />
        </Show>

        {/* Preview text - truncates naturally */}
        <Show when={!isExpanded() && preview()}>
          <span class="text-xs text-text-muted truncate">{preview()}</span>
        </Show>
      </button>

      {/* Expanded content */}
      <Show when={isExpanded()}>
        <div class="px-3 py-3 bg-surface-raised max-h-96 overflow-y-auto">
          <MarkdownRenderer content={props.block.content} workspaceId={workspaceId} class="text-sm" />
        </div>
      </Show>
    </div>
  );
};

export default ReasoningBlock;
