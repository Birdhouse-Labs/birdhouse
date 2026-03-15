// ABOUTME: Left navigation for the reused skills library shell.
// ABOUTME: Shows workspace and shared skill sections with simple scope-focused copy.

import Popover from "corvu/popover";
import { FolderCode, Globe, Info } from "lucide-solid";
import { type Component, createSignal, For, Show } from "solid-js";
import { useZIndex } from "../../contexts/ZIndexContext";
import type { PatternGroup, PatternSection } from "../types/pattern-library-types";

export interface PatternLibraryLeftProps {
  sections: PatternSection[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
}

const SectionInfoPopover: Component<{ section: PatternSection }> = (props) => {
  const baseZIndex = useZIndex();
  const [open, setOpen] = createSignal(false);

  const description = () => {
    if (props.section.id === "workspace") {
      return "These skills resolve from inside the current workspace directory, so their trigger phrases apply only to this workspace.";
    }

    return "These skills resolve from outside the current workspace directory, so their trigger phrases are shared across workspaces in v1.";
  };

  return (
    <Popover open={open()} onOpenChange={setOpen}>
      <Popover.Trigger
        class="p-0.5 rounded transition-colors hover:text-text-primary text-text-muted flex-shrink-0"
        aria-label="More information"
      >
        <Info size={13} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          class="w-72 rounded-xl border shadow-xl bg-surface-raised border-border overflow-hidden"
          style={{ "z-index": baseZIndex + 60 }}
        >
          <p class="text-xs text-text-primary leading-relaxed px-4 py-3">{description()}</p>
          <Show when={props.section.subtitle}>
            <div>
              <div class="border-t border-border-muted" />
              <p class="px-4 py-2 text-xs text-text-muted">{props.section.subtitle}</p>
            </div>
          </Show>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
};

const PatternLibraryLeft: Component<PatternLibraryLeftProps> = (props) => {
  const getSectionIcon = (section: PatternSection) => {
    if (section.id === "workspace") {
      return <FolderCode size={16} class="text-heading" />;
    }

    return <Globe size={16} class="text-heading" />;
  };

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="px-4 py-3 border-b border-border flex-shrink-0">
        <h2 class="text-sm font-semibold text-heading">Skill Groups</h2>
        <p class="text-xs text-text-muted mt-0.5">Teach agents how you work</p>
        <p class="text-xs text-text-muted mt-0.5">Visible skills from this workspace's OpenCode runtime</p>
      </div>

      <div class="flex-1 overflow-y-auto">
        <For each={props.sections}>
          {(section) => (
            <div>
              <div class="flex items-center justify-between py-2 px-3 bg-surface-overlay border-y border-border-muted">
                <div class="flex items-center gap-2 min-w-0">
                  {getSectionIcon(section)}
                  <span class="font-semibold text-sm text-heading truncate">{section.title}</span>
                </div>
                <SectionInfoPopover section={section} />
              </div>

              <div>
                <For each={section.groups}>
                  {(group: PatternGroup) => (
                    <button
                      type="button"
                      onClick={() => props.onSelectGroup(group.id)}
                      class="w-full text-left px-4 py-2.5 transition-colors border-b border-border-muted/30 last:border-b-0"
                      classList={{
                        "bg-gradient-to-r from-gradient-from/10 via-gradient-via/10 to-gradient-to/10 hover:from-gradient-from/20 hover:via-gradient-via/20 hover:to-gradient-to/20":
                          props.selectedGroupId === group.id,
                        "hover:bg-surface-overlay": props.selectedGroupId !== group.id,
                      }}
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex-1 min-w-0">
                          <h4
                            class="text-sm font-medium"
                            classList={{
                              "text-heading": props.selectedGroupId === group.id,
                              "text-text-primary": props.selectedGroupId !== group.id,
                            }}
                          >
                            {group.title}
                          </h4>
                          <p class="text-xs text-text-secondary mt-0.5">
                            {group.pattern_count} {group.pattern_count === 1 ? "skill" : "skills"}
                          </p>
                        </div>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export default PatternLibraryLeft;
