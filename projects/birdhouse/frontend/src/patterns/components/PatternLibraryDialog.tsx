// ABOUTME: Main full-screen dialog for the reused skills library shell.
// ABOUTME: Manages modal routing, skills API calls, and the read-only detail flow.

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
import { fetchPattern, fetchPatternLibrary, updateTriggerPhrases } from "../services/pattern-library-api";
import type { Pattern } from "../types/pattern-library-types";
import GroupView from "./GroupView";
import PatternDetailModal from "./PatternDetailModal";
import PatternLibraryLeft from "./PatternLibraryLeft";

const MODAL_TYPE_LIBRARY = "pattern-library-v2";
const MODAL_TYPE_PATTERN = "pattern-v2";

export interface PatternLibraryDialogProps {
  workspaceId: string;
}

const PatternLibraryDialog: Component<PatternLibraryDialogProps> = (props) => {
  const { openModal, closeModal, modalStack } = useModalRoute();
  const [_searchParams, setSearchParams] = useSearchParams<{ modals?: string }>();
  const isDesktop = createMediaQuery("(min-width: 768px)");
  const [sidebarOpen, setSidebarOpen] = createSignal(true);
  const [groupRefetchTrigger, setGroupRefetchTrigger] = createSignal(0);

  const isLibraryOpen = createMemo(() => modalStack().some((modal) => modal.type === MODAL_TYPE_LIBRARY));

  const [libraryData, { refetch: refetchLibrary }] = createResource(
    () => (isLibraryOpen() ? props.workspaceId : null),
    async (workspaceId) => fetchPatternLibrary(workspaceId),
  );

  const selectedGroupId = createMemo(() => {
    const libraryModal = modalStack().find((modal) => modal.type === MODAL_TYPE_LIBRARY);
    if (libraryModal && libraryModal.id !== "main") {
      return libraryModal.id;
    }
    return null;
  });

  const selectedPatternId = createMemo(() => {
    const patternModal = modalStack().find((modal) => modal.type === MODAL_TYPE_PATTERN);
    return patternModal?.id || null;
  });

  const [patternData, { refetch: refetchPattern }] = createResource(
    () => {
      const patternId = selectedPatternId();
      const groupId = selectedGroupId();
      if (!patternId || !groupId) return null;
      return { patternId, groupId, workspaceId: props.workspaceId };
    },
    async ({ patternId, groupId, workspaceId }) => fetchPattern(groupId, patternId, workspaceId),
  );

  const [lastPattern, setLastPattern] = createSignal<Pattern | null>(null);
  createEffect(() => {
    if (patternData.error) return;
    const pattern = patternData();
    if (pattern && !patternData.loading) {
      setLastPattern(pattern);
    }
  });

  createEffect(() => {
    if (isLibraryOpen()) {
      setSidebarOpen(isDesktop());
    }
  });

  const selectGroup = (groupId: string) => {
    const updatedStack = modalStack()
      .filter((modal) => modal.type === MODAL_TYPE_LIBRARY)
      .map(() => ({ type: MODAL_TYPE_LIBRARY, id: groupId }));
    setSearchParams({ modals: serializeModalStack(updatedStack) });

    if (!isDesktop()) {
      setSidebarOpen(false);
    }
  };

  const viewPattern = (patternId: string) => {
    openModal(MODAL_TYPE_PATTERN, patternId);
  };

  const previewPattern = (patternId: string) => {
    openModal(MODAL_TYPE_PATTERN, patternId);
  };

  const handleUpdateTriggerPhrases = async (phrases: string[]) => {
    const pattern = lastPattern();
    const groupId = selectedGroupId();
    if (!pattern || !groupId) return;

    await updateTriggerPhrases(groupId, pattern.id, props.workspaceId, {
      trigger_phrases: phrases,
    });

    refetchPattern();
    refetchLibrary();
    setGroupRefetchTrigger((previous) => previous + 1);
  };

  const handleDialogChange = (open: boolean) => {
    if (!open && isLibraryOpen()) {
      closeModal();
    }
  };

  createEffect(() => {
    if (libraryData.error) return;
    const data = libraryData();
    const currentGroupId = selectedGroupId();

    if (data && !currentGroupId) {
      const firstGroup = data.sections.flatMap((section) => section.groups).find((group) => group.pattern_count > 0);
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
          <div class="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
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

            <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors">
              <X size={20} />
            </Dialog.Close>
          </div>

          <div class="flex-1 overflow-hidden p-2 bg-gradient-to-br from-bg-from via-bg-via to-bg-to">
            <Show
              when={isDesktop()}
              fallback={
                <>
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

                  <div class="h-full bg-surface rounded-lg overflow-hidden">
                    <Show when={selectedGroupId()}>
                      {(groupId) => (
                        <GroupView
                          groupId={groupId()}
                          workspaceId={props.workspaceId}
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
              <Resizable class="h-full" orientation="horizontal">
                {() => (
                  <>
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

                    <Resizable.Handle
                      aria-label="Resize skill groups panel"
                      class="w-4 cursor-col-resize flex items-center justify-center group"
                    >
                      <div class="w-1 h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Resizable.Handle>

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
                workspaceId={props.workspaceId}
                onUpdateTriggerPhrases={handleUpdateTriggerPhrases}
              />
            )}
          </Show>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default PatternLibraryDialog;
