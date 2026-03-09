// ABOUTME: Dialog showing patterns referenced in current message with preview
// ABOUTME: Uses Combobox to switch between patterns and displays prompt content

import Dialog from "corvu/dialog";
import { LibraryBig } from "lucide-solid";
import { type Component, createEffect, createMemo, createResource, createSignal, onCleanup, Show } from "solid-js";
import { useStreaming } from "../../contexts/StreamingContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useZIndex } from "../../contexts/ZIndexContext";
import { log } from "../../lib/logger";
import { fetchPatternById } from "../../patterns/services/pattern-groups-api";
import type { PatternGroupsPattern } from "../../patterns/types/pattern-groups-types";
import { cardSurfaceFlat } from "../../styles/containerStyles";
import MarkdownRenderer from "../MarkdownRenderer";
import { Combobox } from "./Combobox";

export interface PatternReferencesDialogProps {
  /** Pattern IDs referenced in the message */
  patternIds: string[];
  /** Whether dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Optional: Pre-select this pattern when opening dialog */
  initialPatternId?: string;
}

export const PatternReferencesDialog: Component<PatternReferencesDialogProps> = (props) => {
  const baseZIndex = useZIndex();
  const { workspaceId } = useWorkspace();
  const _streaming = useStreaming();

  // Selected pattern ID (use initialPatternId if provided, otherwise first pattern)
  const [selectedPatternId, setSelectedPatternId] = createSignal<string | undefined>(
    props.initialPatternId || props.patternIds[0],
  );

  // UI state for expandable sections
  const [expandedSections, setExpandedSections] = createSignal<Set<string>>(new Set(["description", "prompt"]));

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Check if section is expanded
  const isExpanded = (section: string) => expandedSections().has(section);

  // Update selected pattern when props change
  createEffect(() => {
    // Only run when dialog is open
    if (!props.open) return;

    if (props.initialPatternId) {
      setSelectedPatternId(props.initialPatternId);
    } else if (props.patternIds.length > 0) {
      // Prefer first valid pattern if available
      const validIds = validPatternIds();
      setSelectedPatternId(validIds[0] ?? props.patternIds[0]);
    }
  });

  // Fetch full pattern content for selected pattern
  const [selectedPatternData, { refetch: refetchSelectedPattern }] = createResource(selectedPatternId, async (id) =>
    id ? await fetchPatternById(id, workspaceId) : undefined,
  );

  // Fetch metadata for all referenced patterns (for the selector)
  type LoadedPatternsResult = {
    patterns: PatternGroupsPattern[];
    failedCount: number;
  };

  const [referencedPatternsData, { refetch: refetchReferencedPatterns }] = createResource(
    () => props.patternIds,
    async (ids): Promise<LoadedPatternsResult> => {
      const results = await Promise.allSettled(ids.map((id) => fetchPatternById(id, workspaceId)));
      const patterns = results
        .filter((r): r is PromiseFulfilledResult<PatternGroupsPattern> => r.status === "fulfilled")
        .map((r) => r.value);
      const failedCount = results.filter((r) => r.status === "rejected").length;

      return { patterns, failedCount };
    },
  );

  // Subscribe to pattern.updated events - refetch when relevant patterns change
  createEffect(() => {
    const streaming = useStreaming();
    const unsubscribe = streaming.subscribeToPatternUpdated((payload) => {
      // Check if updated pattern is one we're displaying
      const isSelectedPattern = selectedPatternId() === payload.patternId;
      const isReferencedPattern = props.patternIds.includes(payload.patternId);

      if (isSelectedPattern) {
        log.ui.debug(`Pattern ${payload.patternId} updated - refetching selected pattern data`);
        refetchSelectedPattern();
      }

      if (isReferencedPattern) {
        log.ui.debug(`Pattern ${payload.patternId} updated - refetching referenced patterns data`);
        refetchReferencedPatterns();
      }
    });

    onCleanup(() => {
      unsubscribe();
    });
  });

  // Subscribe to pattern.deleted events - deleted patterns will show error state
  createEffect(() => {
    const streaming = useStreaming();
    const unsubscribe = streaming.subscribeToPatternDeleted((payload) => {
      const isSelectedPattern = selectedPatternId() === payload.patternId;
      const isReferencedPattern = props.patternIds.includes(payload.patternId);

      if (isSelectedPattern || isReferencedPattern) {
        log.ui.debug(`Pattern ${payload.patternId} deleted - refetching to show error state`);
        // Refetch will fail with 404, showing error UI
        if (isSelectedPattern) refetchSelectedPattern();
        if (isReferencedPattern) refetchReferencedPatterns();
      }
    });

    onCleanup(() => {
      unsubscribe();
    });
  });

  // Combobox options from fetched patterns
  const comboboxOptions = createMemo(() => {
    const data = referencedPatternsData();
    if (!data) return [];

    return data.patterns.map((pattern) => ({
      value: pattern.id,
      label: pattern.title,
      description: pattern.id,
    }));
  });

  const validPatternIds = createMemo(() => referencedPatternsData()?.patterns.map((p) => p.id) ?? []);

  const isSinglePatternContext = createMemo(() => props.patternIds.length === 1);

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/50" style={{ "z-index": baseZIndex }} />
        <div class="fixed inset-0 flex items-center justify-center p-4" style={{ "z-index": baseZIndex }}>
          <Dialog.Content class="w-full max-w-3xl h-[80vh] bg-surface-raised border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div class="px-4 py-1 border-b border-border flex items-center justify-between bg-surface-raised">
              <Dialog.Label class="text-sm font-medium text-text-primary flex items-center gap-2">
                <LibraryBig size={18} />
                Referenced Skills
              </Dialog.Label>
              <Dialog.Close
                class="rounded-lg p-2 hover:bg-surface-overlay transition-colors text-text-muted hover:text-text-primary"
                aria-label="Close dialog"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Dialog.Close>
            </div>

            {/* Content */}
            <div class="flex-1 overflow-y-auto p-6 space-y-6 bg-surface">
              {/* Pattern Selector */}
              <div>
                <div class="block text-sm font-medium text-text-primary mb-2">Select Skill</div>
                <Combobox
                  options={comboboxOptions()}
                  value={selectedPatternId()}
                  onSelect={(id) => setSelectedPatternId(id)}
                  onPreview={(id) => setSelectedPatternId(id)}
                  placeholder="Choose a skill..."
                />
              </div>

              {/* Pattern load failure warning */}
              <Show when={(referencedPatternsData()?.failedCount ?? 0) > 0}>
                <div class="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                  ⚠️ {referencedPatternsData()?.failedCount ?? 0} of {props.patternIds.length} skills could not be loaded
                </div>
              </Show>

              {/* Loading State */}
              <Show when={referencedPatternsData.loading}>
                <div class="text-center text-text-muted">Loading skills...</div>
              </Show>

              {/* Error State */}
              <Show when={referencedPatternsData.error}>
                <div class="text-center text-red-500">Error loading skills: {referencedPatternsData.error.message}</div>
              </Show>

              {/* Empty State */}
              <Show when={!referencedPatternsData.loading && props.patternIds.length === 0}>
                <div class="text-center text-text-muted">No skills referenced</div>
              </Show>

              {/* Pattern Preview */}
              <Show
                when={!selectedPatternData.loading && !selectedPatternData.error && selectedPatternData()}
                fallback={
                  <div class="p-8">
                    {/* Loading State */}
                    <Show when={selectedPatternData.loading}>
                      <div class="text-center space-y-2">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
                        <div class="text-text-muted text-sm">Loading skill...</div>
                      </div>
                    </Show>

                    {/* Error State */}
                    <Show when={selectedPatternData.error}>
                      <div class="text-center space-y-4">
                        <div class="text-red-500 font-medium text-lg">Skill Not Found</div>
                        <div class="text-text-muted">The skill "{selectedPatternId()}" could not be loaded.</div>

                        {/* Context-aware actions */}
                        <Show
                          when={!isSinglePatternContext() && validPatternIds().length > 0}
                          fallback={
                            <button
                              type="button"
                              class="px-4 py-2 bg-surface-overlay hover:bg-surface-raised border border-border rounded-lg transition-colors"
                              onClick={props.onClose}
                            >
                              Close
                            </button>
                          }
                        >
                          <div class="flex gap-2 justify-center">
                            <button
                              type="button"
                              class="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
                              onClick={() => setSelectedPatternId(validPatternIds()[0])}
                            >
                              View Available Skills
                            </button>
                            <button
                              type="button"
                              class="px-4 py-2 bg-surface-overlay hover:bg-surface-raised border border-border rounded-lg transition-colors"
                              onClick={props.onClose}
                            >
                              Close
                            </button>
                          </div>
                        </Show>
                      </div>
                    </Show>
                  </div>
                }
              >
                {(pattern) => (
                  <div class="space-y-6">
                    {/* Description Section */}
                    <Show when={pattern().description}>
                      <div class="space-y-4">
                        <button
                          type="button"
                          class="flex items-center gap-2 group"
                          onClick={() => toggleSection("description")}
                        >
                          <h3 class="text-lg font-semibold text-heading">Description</h3>
                          <svg
                            class="w-5 h-5 text-text-muted transition-transform group-hover:text-text-primary"
                            classList={{
                              "rotate-90": isExpanded("description"),
                            }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>

                        <Show when={isExpanded("description")}>
                          <div class={`rounded-xl ${cardSurfaceFlat} overflow-hidden`}>
                            <div class="p-6">
                              <MarkdownRenderer content={pattern().description || ""} />
                            </div>
                          </div>
                        </Show>
                      </div>
                    </Show>

                    {/* Prompt Section */}
                    <div class="space-y-4">
                      <button
                        type="button"
                        class="flex items-center gap-2 group"
                        onClick={() => toggleSection("prompt")}
                      >
                        <h3 class="text-lg font-semibold text-heading">What Gets Sent to the LLM</h3>
                        <svg
                          class="w-5 h-5 text-text-muted transition-transform group-hover:text-text-primary"
                          classList={{
                            "rotate-90": isExpanded("prompt"),
                          }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      <Show when={isExpanded("prompt")}>
                        <div class={`rounded-xl ${cardSurfaceFlat} overflow-hidden`}>
                          {/* XML Header */}
                          <div class="px-4 py-2 bg-surface-overlay border-b border-border-muted font-mono text-xs text-text-muted">
                            &lt;birdhouse-pattern id="{pattern().id}"&gt;
                          </div>

                          {/* Prompt Content */}
                          <div class="p-6">
                            <MarkdownRenderer content={pattern().prompt} />
                          </div>

                          {/* XML Footer */}
                          <div class="px-4 py-2 bg-surface-overlay border-t border-border-muted font-mono text-xs text-text-muted">
                            &lt;/birdhouse-pattern&gt;
                          </div>
                        </div>
                      </Show>
                    </div>
                  </div>
                )}
              </Show>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
};

export default PatternReferencesDialog;
