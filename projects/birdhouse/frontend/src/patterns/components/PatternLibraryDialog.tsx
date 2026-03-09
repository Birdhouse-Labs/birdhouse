// ABOUTME: Main full-screen dialog for Pattern Library UI
// ABOUTME: Manages modal routing, API calls, and coordinates all child components

import { useSearchParams } from "@solidjs/router";
import Dialog from "corvu/dialog";
import Resizable from "corvu/resizable";
import { Menu, X } from "lucide-solid";
import { type Component, createEffect, createMemo, createResource, createSignal, Show } from "solid-js";
import MobileNavDrawer from "../../components/MobileNavDrawer";
import { Button } from "../../components/ui";
import { serializeModalStack, useModalRoute } from "../../lib/routing";
import { cardSurfaceFlat } from "../../styles/containerStyles";
import { createMediaQuery } from "../../theme/createMediaQuery";
import {
  createPattern,
  deletePattern,
  fetchPattern,
  fetchPatternLibrary,
  updatePattern,
  updateTriggerPhrases,
} from "../services/pattern-library-api";
import type { Pattern, PatternGroup } from "../types/pattern-library-types";
import GroupView from "./GroupView";
import PatternDetailModal from "./PatternDetailModal";
import PatternFormModal from "./PatternFormModal";
import PatternLibraryLeft from "./PatternLibraryLeft";

// Use namespaced modal types so Exp 2 doesn't clash with Exp 1 on the same page
const MODAL_TYPE_LIBRARY = "pattern-library-v2";
const MODAL_TYPE_PATTERN = "pattern-v2";
const MODAL_TYPE_FORM = "pattern-form-v2";

export interface PatternLibraryDialogProps {
  workspaceId: string;
}

const PatternLibraryDialog: Component<PatternLibraryDialogProps> = (props) => {
  const { openModal, closeModal, modalStack } = useModalRoute();
  const [_searchParams, setSearchParams] = useSearchParams<{ modals?: string }>();

  // Responsive breakpoint: use drawer on screens < 768px (md breakpoint)
  const isDesktop = createMediaQuery("(min-width: 768px)");

  // Sidebar state - open on desktop, closed on mobile initially
  const [sidebarOpen, setSidebarOpen] = createSignal(true);

  // Check if library modal is open
  const isLibraryOpen = createMemo(() => {
    return modalStack().some((m) => m.type === MODAL_TYPE_LIBRARY);
  });

  // Fetch pattern library data — only when dialog is open
  const [libraryData, { refetch: refetchLibrary }] = createResource(
    () => (isLibraryOpen() ? props.workspaceId : null),
    async (wsId) => {
      return fetchPatternLibrary(wsId);
    },
  );

  // Parse selected group ID from modal stack — scan the stack, don't rely on currentModal
  // since currentModal returns the last item which may be a nested pattern or form modal
  const selectedGroupId = createMemo(() => {
    const stack = modalStack();
    const libraryModal = stack.find((m) => m.type === MODAL_TYPE_LIBRARY);
    if (libraryModal && libraryModal.id !== "main") {
      return libraryModal.id;
    }
    return null;
  });

  // Parse selected pattern ID from modal stack
  const selectedPatternId = createMemo(() => {
    const stack = modalStack();
    const patternModal = stack.find((m) => m.type === MODAL_TYPE_PATTERN);
    return patternModal?.id || null;
  });

  // Parse form mode from modal stack
  const formMode = createMemo<"create" | "edit" | null>(() => {
    const stack = modalStack();
    const formModal = stack.find((m) => m.type === MODAL_TYPE_FORM);
    if (!formModal) return null;
    return formModal.id.startsWith("create") ? "create" : "edit";
  });

  // Track which pattern is being edited
  const [editingPattern, setEditingPattern] = createSignal<Pattern | null>(null);

  // Refetch trigger for GroupView - increment to force refetch
  const [groupRefetchTrigger, setGroupRefetchTrigger] = createSignal(0);

  // Fetch selected pattern details
  const [patternData, { refetch: refetchPattern }] = createResource(
    () => {
      const patternId = selectedPatternId();
      const groupId = selectedGroupId();
      if (!patternId || !groupId) return null;
      return { patternId, groupId, workspaceId: props.workspaceId };
    },
    async ({ patternId, groupId, workspaceId }) => {
      return fetchPattern(groupId, patternId, workspaceId);
    },
  );

  // Keep track of the last successfully loaded pattern to avoid closing modal during refetch
  const [lastPattern, setLastPattern] = createSignal<Pattern | null>(null);
  createEffect(() => {
    const pattern = patternData();
    if (pattern && !patternData.loading && !patternData.error) {
      setLastPattern(pattern);
    }
  });

  // Reset sidebar state based on screen size when dialog opens
  createEffect(() => {
    if (isLibraryOpen()) {
      setSidebarOpen(isDesktop());
    }
  });

  // Actions
  const selectGroup = (groupId: string) => {
    // Replace pattern-library-v2 modal in stack with the selected group, dropping any nested modals
    const stack = modalStack();
    const updatedStack = stack
      .filter((m) => m.type === MODAL_TYPE_LIBRARY)
      .map(() => ({ type: MODAL_TYPE_LIBRARY, id: groupId }));
    setSearchParams({ modals: serializeModalStack(updatedStack) });

    // Close drawer on mobile after selection
    if (!isDesktop()) {
      setSidebarOpen(false);
    }
  };

  const viewPattern = async (patternId: string) => {
    const groupId = selectedGroupId();
    if (!groupId) {
      return;
    }

    // Find the group to check if it's readonly
    const data = libraryData();
    if (!data) return;

    let foundGroup: PatternGroup | null = null;
    for (const section of data.sections) {
      const group = section.groups.find((g) => g.id === groupId);
      if (group) {
        foundGroup = group;
        break;
      }
    }

    if (!foundGroup) {
      return;
    }

    // Readonly patterns -> detail modal, editable patterns -> form modal
    if (foundGroup.readonly) {
      openModal(MODAL_TYPE_PATTERN, patternId);
    } else {
      // For editable patterns, fetch full pattern data then open form
      try {
        const fullPattern = await fetchPattern(foundGroup.id, patternId, props.workspaceId);
        setEditingPattern(fullPattern);
        openModal(MODAL_TYPE_FORM, `edit-${fullPattern.id}`);
      } catch (_err) {
        // Silently fail - user will see the pattern list remains
      }
    }
  };

  const previewPattern = (patternId: string) => {
    // Preview always opens the detail modal (readonly view) regardless of editability
    openModal(MODAL_TYPE_PATTERN, patternId);
  };

  const openCreateForm = () => {
    openModal(MODAL_TYPE_FORM, "create");
  };

  const handleCreatePattern = async (data: {
    title: string;
    description?: string;
    prompt: string;
    triggerPhrases: string[];
  }) => {
    const groupId = selectedGroupId();
    if (!groupId) return;

    const createData: {
      title: string;
      prompt: string;
      trigger_phrases?: string[];
      description?: string;
    } = {
      title: data.title,
      prompt: data.prompt,
      trigger_phrases: data.triggerPhrases,
    };

    if (data.description) {
      createData.description = data.description;
    }

    await createPattern(groupId, props.workspaceId, createData);

    refetchLibrary();
    setGroupRefetchTrigger((prev) => prev + 1); // Force GroupView to refetch
    // Don't call closeModal() here - the form modal's onOpenChange will handle it
  };

  const handleUpdatePattern = async (data: {
    title: string;
    description?: string;
    prompt: string;
    triggerPhrases: string[];
  }) => {
    const pattern = editingPattern();
    if (!pattern) return;

    // Update pattern content (title, description, prompt)
    const updateData: {
      title?: string;
      prompt?: string;
      description?: string;
    } = {};

    if (data.title) updateData.title = data.title;
    if (data.prompt) updateData.prompt = data.prompt;
    if (data.description) updateData.description = data.description;

    await updatePattern(pattern.group_id, pattern.id, props.workspaceId, updateData);

    // Update trigger phrases separately
    await updateTriggerPhrases(pattern.group_id, pattern.id, props.workspaceId, {
      trigger_phrases: data.triggerPhrases,
    });

    refetchPattern();
    refetchLibrary();
    setGroupRefetchTrigger((prev) => prev + 1); // Force GroupView to refetch
    // Don't call closeModal() here - the form modal's onOpenChange will handle it
    setEditingPattern(null);
  };

  const handleUpdateTriggerPhrases = async (phrases: string[]) => {
    const pattern = lastPattern();
    const groupId = selectedGroupId();
    if (!pattern || !groupId) return;

    await updateTriggerPhrases(groupId, pattern.id, props.workspaceId, {
      trigger_phrases: phrases,
    });

    // Refetch to get fresh data - lastPattern signal keeps modal open during refetch
    refetchPattern();
    refetchLibrary();
  };

  const handleDeletePattern = async () => {
    const pattern = editingPattern();
    if (!pattern) return;

    await deletePattern(pattern.group_id, pattern.id, props.workspaceId);

    refetchLibrary();
    setGroupRefetchTrigger((prev) => prev + 1);
    setEditingPattern(null);
    // Close the form modal
    closeModal();
  };

  const handleDialogChange = (open: boolean) => {
    // Only close the modal stack if the Dialog is actually trying to close
    // and the library is currently open
    if (!open && isLibraryOpen()) {
      closeModal();
    }
  };

  // Auto-select first group in "Your Patterns" section on load
  createEffect(() => {
    const data = libraryData();
    const currentGroupId = selectedGroupId();

    // Only auto-select if: library loaded, no group selected, and we have sections
    if (data && !currentGroupId && data.sections.length > 0) {
      const userSection = data.sections.find((s) => s.id === "user");
      const firstGroup = userSection?.groups[0];
      if (firstGroup) {
        selectGroup(firstGroup.id);
      }
    }
  });

  return (
    <Dialog
      open={isLibraryOpen()}
      onOpenChange={handleDialogChange}
      closeOnOutsidePointer={false}
      closeOnOutsideFocus={false}
      preventScroll={false}
      restoreScrollPosition={false}
    >
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" />
        <Dialog.Content
          class={`fixed rounded-2xl ${cardSurfaceFlat} shadow-2xl
                   w-[95vw] h-[95dvh] max-w-[1600px]
                   left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                   flex flex-col overflow-hidden z-[100]`}
        >
          {/* Header */}
          <div class="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
            {/* Left: Hamburger (mobile only) + Title */}
            <div class="flex items-center gap-3">
              <Show when={!isDesktop()}>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(!sidebarOpen())}
                  class="flex items-center justify-center p-2 rounded-lg transition-all hover:bg-surface-overlay"
                  classList={{
                    "text-accent": sidebarOpen(),
                    "text-text-secondary": !sidebarOpen(),
                  }}
                  aria-label="Toggle skills library"
                >
                  <Menu size={20} />
                </button>
              </Show>
              <Dialog.Label class="text-lg font-semibold text-heading">Skills Library</Dialog.Label>
            </div>

            {/* Right: Close */}
            <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          {/* Content - Responsive Layout */}
          <div class="flex-1 overflow-hidden p-2 bg-gradient-to-br from-bg-from via-bg-via to-bg-to">
            <Show
              when={isDesktop()}
              fallback={
                <>
                  {/* Mobile: Drawer + Details */}
                  <MobileNavDrawer
                    components={[]}
                    selectedComponent=""
                    onSelect={() => {}}
                    open={sidebarOpen()}
                    onOpenChange={setSidebarOpen}
                    trigger={null}
                    zIndex={110}
                  >
                    <div class="h-full bg-surface-raised overflow-hidden flex flex-col">
                      <Show when={!libraryData.loading && !libraryData.error && libraryData()}>
                        {(data) => (
                          <PatternLibraryLeft
                            sections={data().sections}
                            selectedGroupId={selectedGroupId()}
                            onSelectGroup={selectGroup}
                          />
                        )}
                      </Show>

                      <Show when={libraryData.loading}>
                        <div class="flex items-center justify-center p-8">
                          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
                        </div>
                      </Show>

                      <Show when={libraryData.error}>
                        <div class="flex items-center justify-center p-8">
                          <div class="text-center space-y-4">
                            <p class="text-sm text-danger">Failed to load library</p>
                            <Button variant="secondary" onClick={() => refetchLibrary()}>
                              Retry
                            </Button>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </MobileNavDrawer>

                  {/* Main content - Group Details */}
                  <div class="h-full bg-surface rounded-lg overflow-hidden">
                    <Show when={selectedGroupId()}>
                      {(groupId) => (
                        <GroupView
                          groupId={groupId()}
                          workspaceId={props.workspaceId}
                          onAddPattern={openCreateForm}
                          onViewPattern={viewPattern}
                          onPreviewPattern={previewPattern}
                          refetchTrigger={groupRefetchTrigger()}
                        />
                      )}
                    </Show>
                  </div>
                </>
              }
            >
              {/* Desktop: Resizable Split Panel */}
              <Resizable class="h-full" orientation="horizontal">
                {() => (
                  <>
                    {/* Left Panel - Pattern Groups */}
                    <Resizable.Panel
                      initialSize={0.382}
                      minSize={0.2}
                      maxSize={0.5}
                      class="h-full bg-surface-raised rounded-lg overflow-hidden flex flex-col"
                    >
                      <Show when={!libraryData.loading && !libraryData.error && libraryData()}>
                        {(data) => (
                          <PatternLibraryLeft
                            sections={data().sections}
                            selectedGroupId={selectedGroupId()}
                            onSelectGroup={selectGroup}
                          />
                        )}
                      </Show>

                      <Show when={libraryData.loading}>
                        <div class="flex items-center justify-center p-8">
                          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
                        </div>
                      </Show>

                      <Show when={libraryData.error}>
                        <div class="flex items-center justify-center p-8">
                          <div class="text-center space-y-4">
                            <p class="text-sm text-danger">Failed to load library</p>
                            <Button variant="secondary" onClick={() => refetchLibrary()}>
                              Retry
                            </Button>
                          </div>
                        </div>
                      </Show>
                    </Resizable.Panel>

                    {/* Resizable Handle */}
                    <Resizable.Handle
                      aria-label="Resize skill groups panel"
                      class="w-4 cursor-col-resize flex items-center justify-center group"
                    >
                      <div class="w-1 h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Resizable.Handle>

                    {/* Right Panel - Group Details */}
                    <Resizable.Panel
                      initialSize={0.618}
                      minSize={0.5}
                      class="h-full bg-surface rounded-lg overflow-hidden"
                    >
                      <Show when={selectedGroupId()}>
                        {(groupId) => (
                          <GroupView
                            groupId={groupId()}
                            workspaceId={props.workspaceId}
                            onAddPattern={openCreateForm}
                            onViewPattern={viewPattern}
                            onPreviewPattern={previewPattern}
                            refetchTrigger={groupRefetchTrigger()}
                          />
                        )}
                      </Show>
                    </Resizable.Panel>
                  </>
                )}
              </Resizable>
            </Show>
          </div>

          {/* Pattern Detail Modal - non-keyed Show keeps modal open during refetch */}
          <Show when={lastPattern()}>
            {(pattern) => (
              <PatternDetailModal
                open={true}
                onOpenChange={(open) => {
                  if (!open) {
                    closeModal();
                    setLastPattern(null);
                  }
                }}
                pattern={pattern()}
                onUpdateTriggerPhrases={handleUpdateTriggerPhrases}
              />
            )}
          </Show>

          {/* Pattern Form Modal (Create or Edit) */}
          <Show when={formMode()}>
            {(mode) => {
              const isEditMode = mode() === "edit";
              const pattern = isEditMode ? editingPattern() : null;
              const formProps: {
                open: boolean;
                onOpenChange: (open: boolean) => void;
                mode: "create" | "edit";
                groupId: string;
                existingPattern?: Pattern;
                onSave: (data: {
                  title: string;
                  description?: string;
                  prompt: string;
                  triggerPhrases: string[];
                }) => Promise<void>;
                onDelete?: () => Promise<void>;
              } = {
                open: true,
                onOpenChange: (open: boolean) => {
                  if (!open) {
                    closeModal();
                    setEditingPattern(null);
                  }
                },
                mode: mode(),
                groupId: selectedGroupId() || "",
                onSave: mode() === "create" ? handleCreatePattern : handleUpdatePattern,
                ...(isEditMode ? { onDelete: handleDeletePattern } : {}),
              };
              if (pattern) {
                formProps.existingPattern = pattern;
              }
              return <PatternFormModal {...formProps} />;
            }}
          </Show>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default PatternLibraryDialog;
