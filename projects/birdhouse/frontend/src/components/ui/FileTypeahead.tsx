// ABOUTME: File typeahead dropdown for message input with keyboard navigation
// ABOUTME: Shows file suggestions when user types @, supports search and instant arrow key selection

import { autoUpdate, flip, offset, shift } from "@floating-ui/dom";
import { useFloating } from "solid-floating-ui";
import { type Component, createEffect, createResource, createSignal, For, onCleanup, Show } from "solid-js";
import { buildWorkspaceUrl } from "../../config/api";
import { useZIndex } from "../../contexts/ZIndexContext";
import { uiSize } from "../../theme";

interface FileResult {
  path: string;
  name: string;
  type: "file" | "directory";
}

export interface FileTypeaheadProps {
  /** Reference element to position dropdown relative to */
  referenceElement: HTMLElement | undefined;
  /** Current input value to match against */
  inputValue: string;
  /** Current cursor position in the input */
  cursorPosition: number;
  /** Whether the dropdown should be visible */
  visible: boolean;
  /** Workspace ID for API calls */
  workspaceId: string;
  /** Callback when user selects a file */
  onSelect: (file: FileResult, matchedText: string, matchStartIndex: number) => void;
  /** Callback to close the dropdown */
  onClose: () => void;
}

// Search files using the backend API
async function searchFiles(workspaceId: string, query: string): Promise<FileResult[]> {
  const response = await fetch(buildWorkspaceUrl(workspaceId, `/files/find/files?query=${encodeURIComponent(query)}`), {
    method: "POST",
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();

  // The API returns an array of file path strings
  // Convert to FileResult objects with path, name, and type
  const results: FileResult[] = (data || []).map((filePath: string) => {
    const parts = filePath.split("/");
    const name = parts[parts.length - 1];
    return {
      path: filePath,
      name: name,
      type: "file" as const,
    };
  });

  // Limit to 50 results
  return results.slice(0, 50);
}

export const FileTypeahead: Component<FileTypeaheadProps> = (props) => {
  const baseZIndex = useZIndex();
  const [highlightedIndex, setHighlightedIndex] = createSignal(0);
  let listRef: HTMLElement | undefined;

  /**
   * Trigger detection algorithm:
   *
   * Searches backward from cursor for @ character, stopping at whitespace or @@.
   * This allows file paths to be typed continuously after @ without requiring quotes.
   *
   * Examples:
   * - "@Auto" → query: "Auto", matches: AutoGrowTextarea.tsx
   * - "@src/comp" → query: "src/comp", matches: src/components/...
   * - "Check @@agent and @file" → Only matches "@file" (@@agent is agent trigger)
   *
   * Lookback limit: 200 chars to handle very long file paths
   */
  interface TriggerMatch {
    found: boolean;
    query: string;
    matchedText: string;
    startIndex: number;
  }

  const findTrigger = (): TriggerMatch => {
    const text = props.inputValue;
    const cursor = props.cursorPosition;

    // Only look at text UP TO cursor position (ignore text after cursor)
    const textBeforeCursor = text.substring(0, cursor);

    // Look back up to 200 characters for @ trigger (handle long paths)
    const maxLookback = 200;
    const lookbackStart = Math.max(0, cursor - maxLookback);

    // Walk backward from cursor to find @ trigger
    for (let start = cursor - 1; start >= lookbackStart; start--) {
      const char = textBeforeCursor[start];

      // Found single @ (file trigger)
      if (char === "@") {
        const matchedText = textBeforeCursor.substring(start);
        const query = matchedText.substring(1); // Everything after @

        return {
          found: true,
          query,
          matchedText,
          startIndex: start,
        };
      }

      // Stop searching if we hit whitespace or @@ (agent trigger takes priority)
      if (char === " " || char === "\n" || (char === "@" && textBeforeCursor[start - 1] === "@")) {
        break;
      }
    }

    return {
      found: false,
      query: "",
      matchedText: "",
      startIndex: -1,
    };
  };

  // Create reactive search resource
  const trigger = () => {
    if (!props.visible) {
      return { found: false, query: "" };
    }
    return findTrigger();
  };

  const [files] = createResource(
    () => {
      const t = trigger();
      return t.found ? { workspaceId: props.workspaceId, query: t.query } : null;
    },
    ({ workspaceId, query }) => searchFiles(workspaceId, query),
  );

  // Setup floating UI for dropdown positioning
  const [floating, setFloating] = createSignal<HTMLElement>();

  const position = useFloating(() => props.referenceElement, floating, {
    placement: "top-start",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  // Reset highlight when files change
  createEffect(() => {
    files();
    setHighlightedIndex(0);
  });

  // Scroll highlighted option into view
  createEffect(() => {
    if (props.visible && listRef) {
      const highlightedEl = listRef.children[highlightedIndex()] as HTMLElement;
      highlightedEl?.scrollIntoView({ block: "nearest" });
    }
  });

  /**
   * Keyboard navigation handler (arrow keys, Enter, Escape)
   *
   * Arrow keys: Navigate through file list with wrapping at boundaries
   * Enter: Select highlighted file (plain Enter only - Cmd/Ctrl+Enter sends message)
   * Escape: Close typeahead dropdown
   */
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.visible) return;

    const fileList = files();
    if (!fileList || fileList.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, fileList.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter": {
        // Only handle plain Enter - let Cmd/Ctrl/Shift+Enter pass through to send message
        if (e.metaKey || e.ctrlKey || e.shiftKey) {
          return;
        }
        e.preventDefault();
        const selected = fileList[highlightedIndex()];
        if (selected) {
          const t = findTrigger();
          if (t.found) {
            props.onSelect(selected, t.matchedText, t.startIndex);
          }
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
      path: size === "sm" ? "text-xs" : size === "md" ? "text-xs" : "text-sm",
    };
  };

  // Truncate long paths for display
  const truncatePath = (path: string, maxLength: number = 60): string => {
    if (path.length <= maxLength) {
      return path;
    }

    // Try to keep the filename visible
    const parts = path.split("/");
    const filename = parts[parts.length - 1];

    if (filename && filename.length < maxLength - 3) {
      // Show beginning and filename
      const remaining = maxLength - filename.length - 3;
      return `${path.substring(0, remaining)}.../${filename}`;
    }

    // Just truncate
    return `...${path.substring(path.length - maxLength + 3)}`;
  };

  const shouldShow = () => {
    const t = trigger();
    const fileList = files();
    return props.visible && t.found && fileList && fileList.length > 0;
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
        <Show when={!files.loading} fallback={<div class="px-3 py-2 text-text-secondary text-sm">Loading...</div>}>
          <Show
            when={(files()?.length ?? 0) > 0}
            fallback={<div class="px-3 py-2 text-text-secondary text-sm">No files found</div>}
          >
            <For each={files() ?? []}>
              {(file, index) => (
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
                    const t = findTrigger();
                    if (t.found) {
                      props.onSelect(file, t.matchedText, t.startIndex);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      const t = findTrigger();
                      if (t.found) {
                        props.onSelect(file, t.matchedText, t.startIndex);
                      }
                    }
                  }}
                  onMouseEnter={() => {
                    setHighlightedIndex(index());
                  }}
                >
                  <div>
                    <div class="font-medium text-text-primary">{file.name}</div>
                    <div class={`${sizeClasses().path} mt-0.5 text-text-secondary`}>{truncatePath(file.path)}</div>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </Show>
      </div>
    </Show>
  );
};

export default FileTypeahead;
