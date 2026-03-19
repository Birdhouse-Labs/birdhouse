// ABOUTME: Main full-screen dialog for the flat skills library shell.
// ABOUTME: Preserves the outer library dialog while replacing grouped navigation with flat list search and filtering.

import Dialog from "corvu/dialog";
import Resizable from "corvu/resizable";
import { Menu, RefreshCw, X } from "lucide-solid";
import { type Component, createEffect, createMemo, createResource, createSignal, on, Show } from "solid-js";
import MobileNavDrawer from "../../components/MobileNavDrawer";
import { Button } from "../../components/ui";
import { useModalRoute } from "../../lib/routing";
import { cardSurfaceFlat } from "../../styles/containerStyles";
import { createMediaQuery } from "../../theme/createMediaQuery";
import { fetchSkill, fetchSkillLibrary, reloadSkills, updateTriggerPhrases } from "../services/skill-library-api";
import type { SkillListScopeFilter } from "../types/skill-library-types";
import { filterSkills } from "../utils/skill-library-filtering";
import { resolveSelectedSkillIdAfterLoad, resolveVisibleSkillDetail } from "../utils/skill-selection";
import SkillDetailPane from "./SkillDetailPane";
import SkillListPane from "./SkillListPane";

const MODAL_TYPE_LIBRARY = "skill-library-v2";
const SKILL_LIBRARY_UI_STATE_STORAGE_PREFIX = "birdhouse:skill-library-ui:";

interface SkillLibraryUIState {
  searchQuery: string;
  scopeFilter: SkillListScopeFilter;
  selectedSkillId: string | null;
}

function isSkillListScopeFilter(value: unknown): value is SkillListScopeFilter {
  return value === "all" || value === "workspace" || value === "global";
}

function loadSkillLibraryUIState(workspaceId: string): SkillLibraryUIState {
  const fallbackState: SkillLibraryUIState = {
    searchQuery: "",
    scopeFilter: "all",
    selectedSkillId: null,
  };

  const rawState = sessionStorage.getItem(`${SKILL_LIBRARY_UI_STATE_STORAGE_PREFIX}${workspaceId}`);
  if (!rawState) {
    return fallbackState;
  }

  try {
    const parsed = JSON.parse(rawState) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return fallbackState;
    }

    const state = parsed as Record<string, unknown>;
    return {
      searchQuery: typeof state["searchQuery"] === "string" ? state["searchQuery"] : "",
      scopeFilter: isSkillListScopeFilter(state["scopeFilter"]) ? state["scopeFilter"] : "all",
      selectedSkillId: typeof state["selectedSkillId"] === "string" ? state["selectedSkillId"] : null,
    };
  } catch {
    return fallbackState;
  }
}

function saveSkillLibraryUIState(workspaceId: string, state: SkillLibraryUIState): void {
  sessionStorage.setItem(`${SKILL_LIBRARY_UI_STATE_STORAGE_PREFIX}${workspaceId}`, JSON.stringify(state));
}

export interface SkillLibraryDialogProps {
  workspaceId: string;
  hasActiveAgents?: boolean;
}

const SkillLibraryDialog: Component<SkillLibraryDialogProps> = (props) => {
  const { closeModal, modalStack, replaceModal } = useModalRoute();
  const isDesktop = createMediaQuery("(min-width: 768px)");
  const [sidebarOpen, setSidebarOpen] = createSignal(true);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [scopeFilter, setScopeFilter] = createSignal<SkillListScopeFilter>("all");
  const [storedSelectedSkillId, setStoredSelectedSkillId] = createSignal<string | null>(null);
  const [reloadingSkills, setReloadingSkills] = createSignal(false);
  const [reloadError, setReloadError] = createSignal<string | null>(null);

  const isLibraryOpen = createMemo(() => modalStack().some((modal) => modal.type === MODAL_TYPE_LIBRARY));

  const [libraryData, { refetch: refetchLibrary }] = createResource(
    () => (isLibraryOpen() ? props.workspaceId : null),
    async (workspaceId) => fetchSkillLibrary(workspaceId),
  );

  const selectedSkillId = createMemo(() => {
    const libraryModal = modalStack().find((modal) => modal.type === MODAL_TYPE_LIBRARY);
    if (libraryModal && libraryModal.id !== "main") {
      return libraryModal.id;
    }
    return null;
  });

  const skills = createMemo(() => libraryData()?.skills ?? []);
  const hasVisibleLibraryData = createMemo(() => !libraryData.error && skills().length > 0);

  const filteredSkills = createMemo(() => filterSkills(skills(), searchQuery(), scopeFilter()));

  const [skillData, { refetch: refetchSkill }] = createResource(
    () => {
      const skillId = selectedSkillId();
      if (!skillId) return null;
      return { skillId, workspaceId: props.workspaceId };
    },
    async ({ skillId, workspaceId }) => fetchSkill(skillId, workspaceId),
  );
  const visibleSkill = createMemo(() =>
    resolveVisibleSkillDetail(selectedSkillId(), skillData.error ? null : (skillData() ?? null)),
  );

  createEffect(() => {
    const persistedState = loadSkillLibraryUIState(props.workspaceId);
    setSearchQuery(persistedState.searchQuery);
    setScopeFilter(persistedState.scopeFilter);
    setStoredSelectedSkillId(persistedState.selectedSkillId);
  });

  createEffect(() => {
    if (isLibraryOpen()) {
      setSidebarOpen(isDesktop());
    }
  });

  createEffect(() => {
    const currentSelectedSkillId = selectedSkillId();
    if (currentSelectedSkillId) {
      setStoredSelectedSkillId(currentSelectedSkillId);
    }
  });

  createEffect(() => {
    saveSkillLibraryUIState(props.workspaceId, {
      searchQuery: searchQuery(),
      scopeFilter: scopeFilter(),
      selectedSkillId: storedSelectedSkillId(),
    });
  });

  const selectSkill = (skillId: string | null) => {
    const nextId = skillId || "main";
    if (skillId) {
      setStoredSelectedSkillId(skillId);
    }
    replaceModal(MODAL_TYPE_LIBRARY, nextId);

    if (!isDesktop()) {
      setSidebarOpen(false);
    }
  };

  const handleUpdateTriggerPhrases = async (phrases: string[]) => {
    const skill = skillData();
    if (!skill) return;

    await updateTriggerPhrases(skill.id, props.workspaceId, {
      trigger_phrases: phrases,
    });

    refetchSkill();
    refetchLibrary();
  };

  const handleReloadSkills = async () => {
    if (reloadingSkills() || props.hasActiveAgents) {
      return;
    }

    setReloadingSkills(true);
    setReloadError(null);

    try {
      await reloadSkills(props.workspaceId);
      await refetchLibrary();

      if (selectedSkillId()) {
        await refetchSkill();
      }
    } catch (error) {
      setReloadError(error instanceof Error ? error.message : "Failed to reload skills");
    } finally {
      setReloadingSkills(false);
    }
  };

  const handleDialogChange = (open: boolean) => {
    if (!open && isLibraryOpen()) {
      closeModal();
    }
  };

  createEffect(
    on(
      [selectedSkillId, storedSelectedSkillId, filteredSkills, () => !!libraryData(), () => libraryData.error],
      ([currentSelectedSkillId, currentStoredSkillId, currentFilteredSkills, hasLoaded, hasError]) => {
        if (hasError) return;

        const nextSelectedSkillId = resolveSelectedSkillIdAfterLoad(
          currentSelectedSkillId ?? currentStoredSkillId,
          currentFilteredSkills.map((skill) => skill.id),
          hasLoaded,
        );

        if (currentSelectedSkillId !== nextSelectedSkillId) {
          selectSkill(nextSelectedSkillId);
        }
      },
    ),
  );

  const listPane = () => (
    <SkillListPane
      skills={skills()}
      filteredSkills={filteredSkills()}
      searchQuery={searchQuery()}
      scopeFilter={scopeFilter()}
      selectedSkillId={selectedSkillId()}
      onSearchQueryChange={setSearchQuery}
      onScopeFilterChange={setScopeFilter}
      onSelectSkill={selectSkill}
    />
  );

  const listPaneContent = () => (
    <>
      <Show when={hasVisibleLibraryData()}>{listPane()}</Show>

      <Show when={libraryData.loading && !hasVisibleLibraryData()}>
        <div class="flex items-center justify-center p-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      </Show>

      <Show when={libraryData.error && !hasVisibleLibraryData()}>
        <div class="flex items-center justify-center p-8">
          <div class="text-center space-y-4">
            <p class="text-sm text-danger">Failed to load library</p>
            <Button variant="secondary" onClick={() => refetchLibrary()}>
              Retry
            </Button>
          </div>
        </div>
      </Show>
    </>
  );

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

            <div class="flex items-center gap-3">
              <Show when={reloadError()}>
                {(message) => <span class="hidden md:inline text-sm text-danger">{message()}</span>}
              </Show>

              <Button
                variant="secondary"
                onClick={handleReloadSkills}
                disabled={reloadingSkills() || !!props.hasActiveAgents}
                leftIcon={<RefreshCw size={16} classList={{ "animate-spin": reloadingSkills() }} />}
                class="whitespace-nowrap"
                aria-label="Reload Skills"
              >
                {reloadingSkills() ? "Reloading..." : "Reload Skills"}
              </Button>

              <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors">
                <X size={20} />
              </Dialog.Close>
            </div>
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
                    <div class="h-full bg-surface-raised overflow-hidden flex flex-col">{listPaneContent()}</div>
                  </MobileNavDrawer>

                  <SkillDetailPane
                    skill={visibleSkill()}
                    loading={skillData.loading}
                    error={skillData.error ?? null}
                    workspaceId={props.workspaceId}
                    onRetry={() => refetchSkill()}
                    onUpdateTriggerPhrases={handleUpdateTriggerPhrases}
                  />
                </>
              }
            >
              <Resizable class="h-full" orientation="horizontal">
                {() => (
                  <>
                    <Resizable.Panel
                      initialSize={0.382}
                      minSize={0.25}
                      maxSize={0.5}
                      class="h-full bg-surface-raised rounded-lg overflow-hidden flex flex-col"
                    >
                      {listPaneContent()}
                    </Resizable.Panel>

                    <Resizable.Handle
                      aria-label="Resize skill list panel"
                      class="w-4 cursor-col-resize flex items-center justify-center group"
                    >
                      <div class="w-1 h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Resizable.Handle>

                    <Resizable.Panel initialSize={0.618} minSize={0.5} class="h-full rounded-lg overflow-hidden">
                      <SkillDetailPane
                        skill={visibleSkill()}
                        loading={skillData.loading}
                        error={skillData.error ?? null}
                        workspaceId={props.workspaceId}
                        onRetry={() => refetchSkill()}
                        onUpdateTriggerPhrases={handleUpdateTriggerPhrases}
                      />
                    </Resizable.Panel>
                  </>
                )}
              </Resizable>
            </Show>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default SkillLibraryDialog;
