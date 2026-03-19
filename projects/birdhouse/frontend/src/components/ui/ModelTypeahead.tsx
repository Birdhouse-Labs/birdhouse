// ABOUTME: Model typeahead dropdown for message input with keyboard navigation.
// ABOUTME: Shows model/provider suggestions when user types @@@, inserts the exact model ID.

import { autoUpdate, flip, offset, shift } from "@floating-ui/dom";
import { useFloating } from "solid-floating-ui";
import { type Component, createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { useZIndex } from "../../contexts/ZIndexContext";
import { uiSize } from "../../theme";

export interface ModelItem {
  id: string;
  name: string;
  provider: string;
  contextLimit: number;
}

export interface ModelTypeaheadProps {
  /** Reference element to position dropdown relative to */
  referenceElement: HTMLElement | undefined;
  /** Current input value to match against */
  inputValue: string;
  /** Current cursor position in the input */
  cursorPosition: number;
  /** Whether the dropdown should be visible */
  visible: boolean;
  /** Array of models to filter */
  models: ModelItem[];
  /** Callback when user selects a model */
  onSelect: (model: ModelItem, matchedText: string, matchStartIndex: number) => void;
  /** Callback to close the dropdown */
  onClose: () => void;
}

/**
 * Trigger detection for @@@ model mentions.
 *
 * Scans backwards from cursor for @@@, stopping at whitespace.
 * Returns the query text typed after @@@, the matched text (including @@@),
 * and the start index of @@@.
 *
 * Exported as a pure function so it can be unit tested independently.
 */
export interface ModelTriggerMatch {
  found: boolean;
  query: string;
  matchedText: string;
  startIndex: number;
}

export function findModelTrigger(inputValue: string, cursorPosition: number): ModelTriggerMatch {
  const textBeforeCursor = inputValue.substring(0, cursorPosition);

  // Walk backward from cursor to find @@@
  const maxLookback = 200;
  const lookbackStart = Math.max(0, cursorPosition - maxLookback);

  for (let start = cursorPosition - 1; start >= lookbackStart; start--) {
    const char = textBeforeCursor[start];

    // Stop at whitespace - @@@ can't span words
    if (char === " " || char === "\n") {
      break;
    }

    // Check if we've found the @@@ trigger at this position
    if (char === "@" && textBeforeCursor[start - 1] === "@" && textBeforeCursor[start - 2] === "@") {
      const triggerStart = start - 2;
      const matchedText = textBeforeCursor.substring(triggerStart);
      const query = matchedText.substring(3); // Everything after @@@

      return {
        found: true,
        query,
        matchedText,
        startIndex: triggerStart,
      };
    }
  }

  return { found: false, query: "", matchedText: "", startIndex: -1 };
}

/** Filter models by query against name and provider (case-insensitive) */
function filterModels(models: ModelItem[], query: string): ModelItem[] {
  if (!query) return models;
  const q = query.toLowerCase();
  return models.filter((m) => m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q));
}

export const ModelTypeahead: Component<ModelTypeaheadProps> = (props) => {
  const baseZIndex = useZIndex();
  const [highlightedIndex, setHighlightedIndex] = createSignal(0);
  let listRef: HTMLElement | undefined;

  const trigger = (): ModelTriggerMatch => {
    if (!props.visible) return { found: false, query: "", matchedText: "", startIndex: -1 };
    return findModelTrigger(props.inputValue, props.cursorPosition);
  };

  const displayModels = (): ModelItem[] => {
    const t = trigger();
    if (!t.found) return [];
    return filterModels(props.models, t.query);
  };

  // Setup floating UI for dropdown positioning
  const [floating, setFloating] = createSignal<HTMLElement>();

  const position = useFloating(() => props.referenceElement, floating, {
    placement: "top-start",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  // Reset highlight when displayed results change
  createEffect(() => {
    displayModels();
    setHighlightedIndex(0);
  });

  // Scroll highlighted option into view
  createEffect(() => {
    if (props.visible && listRef) {
      const highlightedEl = listRef.children[highlightedIndex()] as HTMLElement;
      highlightedEl?.scrollIntoView({ block: "nearest" });
    }
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.visible) return;

    const displayed = displayModels();
    if (displayed.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, displayed.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter": {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        const selected = displayed[highlightedIndex()];
        if (selected) {
          const t = trigger();
          if (t.found) props.onSelect(selected, t.matchedText, t.startIndex);
        }
        break;
      }
      case "Escape":
        e.preventDefault();
        props.onClose();
        break;
    }
  };

  createEffect(() => {
    if (props.visible) {
      document.addEventListener("keydown", handleKeyDown);
      onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
    }
  });

  const sizeClasses = () => {
    const size = uiSize();
    return {
      option: size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base",
      sub: size === "sm" ? "text-xs" : "text-xs",
    };
  };

  const shouldShow = () => {
    const t = trigger();
    return props.visible && t.found && displayModels().length > 0;
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
        <For each={displayModels()}>
          {(model, index) => (
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
                const t = findModelTrigger(props.inputValue, props.cursorPosition);
                if (t.found) props.onSelect(model, t.matchedText, t.startIndex);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  const t = findModelTrigger(props.inputValue, props.cursorPosition);
                  if (t.found) props.onSelect(model, t.matchedText, t.startIndex);
                }
              }}
              onMouseEnter={() => setHighlightedIndex(index())}
            >
              <div>
                <div class="font-medium text-text-primary">{model.name}</div>
                <div class={`${sizeClasses().sub} mt-0.5 flex gap-2 text-text-secondary`}>
                  <span>{model.provider}</span>
                  {model.contextLimit > 0 && (
                    <span class="text-text-muted">{model.contextLimit.toLocaleString()} ctx</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
};

export default ModelTypeahead;
