// ABOUTME: Renders visual diffs for file edits using @pierre/diffs library
// ABOUTME: Supports both edit tool (full diffs) and write tool (additions-only or overwrite notice)

import type { FileDiffMetadata } from "@pierre/diffs";
import { FileDiff, isHighlighterNull, parseDiffFromFile, preloadHighlighter } from "@pierre/diffs";
import { type Component, createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js";
import { codeTheme, isDark } from "../../theme";
import { resolveCodeTheme } from "../../theme/codeThemes";

export interface EditDiffViewerProps {
  /** Full file content before edit (from edit tool metadata.filediff.before) */
  before: string;
  /** Full file content after edit (from edit tool metadata.filediff.after) */
  after: string;
  /** File path for syntax highlighting and display */
  filePath: string;
  /** Display mode: "split" for side-by-side, "unified" for stacked */
  mode?: "split" | "unified";
}

// Shared diff viewer configuration
export const DEFAULT_DIFF_OPTIONS = {
  diffStyle: "unified" as const, // Unified (stacked) view
  lineDiffType: "word-alt" as const, // Word-level inline diffs with red/green highlights
  diffIndicators: "bars" as const, // Use vertical bars instead of +/- symbols for cleaner look
  disableBackground: false, // Enable diff backgrounds
  overflow: "wrap" as const, // Enable line wrapping
  disableLineNumbers: false, // Show line numbers
  enableLineSelection: true,
  disableFileHeader: true, // Hide library's header - we show our own
  unsafeCSS: `
    :host {
      border-radius: 0.5rem;
      overflow: hidden;
    }
  `,
};

// Global highlighter initialization - done once for the entire app
let highlighterInitPromise: Promise<void> | null = null;

async function ensureHighlighterInitialized(): Promise<void> {
  if (!isHighlighterNull()) {
    return; // Already initialized
  }

  if (highlighterInitPromise) {
    return highlighterInitPromise; // Initialization in progress
  }

  // Get user's selected theme and resolve both dark and light variants
  const userThemeFamily = codeTheme();
  const darkTheme = resolveCodeTheme(userThemeFamily, true);
  const lightTheme = resolveCodeTheme(userThemeFamily, false);

  highlighterInitPromise = preloadHighlighter({
    themes: [darkTheme, lightTheme],
    langs: ["typescript", "javascript", "json", "markdown", "text"],
  });

  await highlighterInitPromise;
}

/**
 * Renders a beautiful visual diff using @pierre/diffs
 *
 * Uses metadata.filediff.before/after from edit tool to generate and display diffs
 */
const EditDiffViewer: Component<EditDiffViewerProps> = (props) => {
  let wrapperRef: HTMLDivElement | undefined;
  let diffInstance: FileDiff | null = null;

  const [isHighlighterReady, setIsHighlighterReady] = createSignal(false);

  // Initialize highlighter on mount
  createEffect(() => {
    void ensureHighlighterInitialized().then(() => {
      setIsHighlighterReady(true);
    });
  });

  // Parse the diff data into the format @pierre/diffs expects
  const fileDiff = createMemo<FileDiffMetadata | null>(() => {
    try {
      const result = parseDiffFromFile(
        {
          name: props.filePath,
          contents: props.before,
        },
        {
          name: props.filePath,
          contents: props.after,
        },
      );
      return result;
    } catch (_error) {
      return null;
    }
  });

  // Theme based on current dark mode setting
  const _theme = createMemo(() => (isDark() ? "pierre-dark" : "pierre-light"));

  // Render the diff using vanilla JS API - only after highlighter is ready
  createEffect(() => {
    const diff = fileDiff();
    const ready = isHighlighterReady();

    if (!diff || !wrapperRef || !ready) {
      return;
    }

    // Clean up previous instance
    if (diffInstance) {
      diffInstance.cleanUp();
      diffInstance = null;
    }

    try {
      // Get user's selected theme and resolve both dark and light variants
      const userThemeFamily = codeTheme();
      const darkTheme = resolveCodeTheme(userThemeFamily, true);
      const lightTheme = resolveCodeTheme(userThemeFamily, false);

      // Create new FileDiff instance with options
      diffInstance = new FileDiff({
        theme: { dark: darkTheme, light: lightTheme },
        themeType: isDark() ? "dark" : "light",
        ...DEFAULT_DIFF_OPTIONS,
        diffStyle: props.mode || DEFAULT_DIFF_OPTIONS.diffStyle, // Allow override from props
      });
      // IMPORTANT: Don't pass fileContainer - let FileDiff create the <diffs-container> element
      // Then we append it to our wrapper div
      diffInstance.render({
        containerWrapper: wrapperRef, // This tells FileDiff where to append the container
        oldFile: {
          name: props.filePath,
          contents: props.before,
        },
        newFile: {
          name: props.filePath,
          contents: props.after,
        },
      });

      // Get the container that FileDiff created
      const _container = diffInstance.getFileContainer();
    } catch (_error) {
      if (wrapperRef) {
        wrapperRef.innerHTML = '<div class="px-3 py-2 text-red-600">Error rendering diff</div>';
      }
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    if (diffInstance) {
      diffInstance.cleanUp();
      diffInstance = null;
    }
  });

  return (
    <Show when={fileDiff()} fallback={<div class="px-3 py-2 text-text-muted text-sm">Failed to generate diff</div>}>
      <Show
        when={isHighlighterReady()}
        fallback={<div class="px-3 py-2 text-text-muted text-sm">Loading syntax highlighter...</div>}
      >
        <div ref={wrapperRef} class="diff-viewer-wrapper" />
      </Show>
    </Show>
  );
};

export default EditDiffViewer;
