// ABOUTME: Skill typeahead dropdown for message input with keyboard navigation.
// ABOUTME: Shows skill suggestions as user types and supports instant arrow key selection.

import { autoUpdate, flip, offset, shift } from "@floating-ui/dom";
import { useFloating } from "solid-floating-ui";
import { type Component, createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { useZIndex } from "../../contexts/ZIndexContext";
import { uiSize } from "../../theme";
import { findMatches, type MatchResult, type SkillSuggestion } from "./skill-typeahead-matching";

export type { SkillSuggestion };

export interface SkillTypeaheadProps {
  /** Reference element to position dropdown relative to */
  referenceElement: HTMLElement | undefined;
  /** Current input value to match against */
  inputValue: string;
  /** Current cursor position in the input */
  cursorPosition: number;
  /** Whether the dropdown should be visible */
  visible: boolean;
  /** Array of skills to match against */
  skills: SkillSuggestion[];
  /** Callback when user selects a skill */
  onSelect: (skill: SkillSuggestion, matchedPhrase: string, matchedText: string, matchStartIndex: number) => void;
  /** Callback to close the dropdown */
  onClose: () => void;
  /** Callback when highlighted index changes (for external keyboard handling) */
  onHighlightChange?: (index: number) => void;
}

export const SkillTypeahead: Component<SkillTypeaheadProps> = (props) => {
  const baseZIndex = useZIndex();
  const [highlightedIndex, setHighlightedIndex] = createSignal(0);
  let listRef: HTMLElement | undefined;

  const filteredMatches = (): MatchResult[] => {
    return findMatches(props.inputValue, props.cursorPosition, props.skills);
  };

  // Setup floating UI for dropdown positioning
  const [floating, setFloating] = createSignal<HTMLElement>();

  const position = useFloating(() => props.referenceElement, floating, {
    placement: "top-start",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  // Reset highlight when filtered results change
  createEffect(() => {
    filteredMatches();
    setHighlightedIndex(0);
  });

  // Scroll highlighted option into view
  createEffect(() => {
    if (props.visible && listRef) {
      const highlightedEl = listRef.children[highlightedIndex()] as HTMLElement;
      highlightedEl?.scrollIntoView({ block: "nearest" });
    }
  });

  // Notify parent of highlight changes
  createEffect(() => {
    props.onHighlightChange?.(highlightedIndex());
  });

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.visible) return;

    const filtered = filteredMatches();
    if (filtered.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter": {
        // Only handle plain Enter - let Cmd/Ctrl/Shift+Enter pass through
        if (e.metaKey || e.ctrlKey || e.shiftKey) {
          return;
        }
        e.preventDefault();
        const match = filtered[highlightedIndex()];
        if (match) {
          props.onSelect(match.skill, match.matchedPhrase, match.matchedText, match.startIndex);
        }
        break;
      }
      case "Escape":
        e.preventDefault();
        props.onClose();
        break;
    }
  };

  // Listen for keyboard events globally when visible
  createEffect(() => {
    if (props.visible) {
      document.addEventListener("keydown", handleKeyDown);
      onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
    }
  });

  // Size classes based on uiSize setting
  const sizeClasses = () => {
    const size = uiSize();
    return {
      option: size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base",
    };
  };

  const shouldShow = () => {
    const filtered = filteredMatches();
    return props.visible && filtered.length > 0;
  };

  return (
    <Show when={shouldShow()}>
      <div
        ref={(el) => {
          listRef = el;
          setFloating(el);
        }}
        class="rounded-xl border shadow-xl overflow-y-auto bg-surface-overlay border-border"
        style={{
          position: position.strategy,
          top: `${position.y ?? 0}px`,
          left: `${position.x ?? 0}px`,
          "max-height": "16rem",
          "min-width": "20rem",
          "z-index": baseZIndex,
        }}
      >
        <For each={filteredMatches()}>
          {(match, index) => (
            <div
              role="option"
              tabIndex={-1}
              aria-selected={highlightedIndex() === index()}
              class="px-3 py-2 cursor-pointer transition-colors"
              classList={{
                [sizeClasses().option]: true,
                "bg-gradient-from/30 text-text-primary": highlightedIndex() === index(),
                "hover:bg-surface-raised": highlightedIndex() !== index(),
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => {
                props.onSelect(match.skill, match.matchedPhrase, match.matchedText, match.startIndex);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  props.onSelect(match.skill, match.matchedPhrase, match.matchedText, match.startIndex);
                }
              }}
              onMouseEnter={() => {
                setHighlightedIndex(index());
              }}
            >
              <div>
                <div class="font-medium text-text-primary">{match.skill.title}</div>
                <div class="text-text-secondary text-xs mt-0.5">{match.matchedPhrase}</div>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
};

export default SkillTypeahead;
