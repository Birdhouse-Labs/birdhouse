// ABOUTME: Left panel with sections of pattern groups
// ABOUTME: Shows user patterns, workspace sections, and bundled patterns with clear visual hierarchy

import Popover from "corvu/popover";
import { Info, User } from "lucide-solid";
import { type Component, createSignal, For } from "solid-js";
import { useZIndex } from "../../contexts/ZIndexContext";
import { WorkspaceIcon } from "../../design-system";
import { shortenPath } from "../../utils/paths";
import type { PatternGroup, PatternSection } from "../types/pattern-library-types";

export interface PatternLibraryLeftProps {
  sections: PatternSection[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
}

// Birdhouse icon component with gradient
const BirdhouseIcon: Component<{ size?: number }> = (props) => {
  const size = () => props.size || 16;
  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="flex-shrink-0"
      role="img"
      aria-label="Birdhouse"
    >
      <title>Birdhouse</title>
      <defs>
        <linearGradient id="section-birdhouse-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:var(--theme-gradient-from)" />
          <stop offset="50%" style="stop-color:var(--theme-gradient-via)" />
          <stop offset="100%" style="stop-color:var(--theme-gradient-to)" />
        </linearGradient>
      </defs>
      <path
        d="M12 18v4"
        fill="none"
        stroke="url(#section-birdhouse-gradient)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="m17 18 1.956-11.468"
        stroke="url(#section-birdhouse-gradient)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="m3 8 7.82-5.615a2 2 0 0 1 2.36 0L21 8"
        stroke="url(#section-birdhouse-gradient)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M4 18h16"
        stroke="url(#section-birdhouse-gradient)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M7 18 5.044 6.532"
        stroke="url(#section-birdhouse-gradient)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle
        cx="12"
        cy="10"
        r="2"
        stroke="url(#section-birdhouse-gradient)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};

// Info popover for a section header
const SectionInfoPopover: Component<{ section: PatternSection }> = (props) => {
  const baseZIndex = useZIndex();
  const [open, setOpen] = createSignal(false);

  const description = () => {
    if (props.section.id === "user") {
      return "These skills travel with you across all workspaces. Use them for your personal conventions, like how you like to write commits, your preferred PR style, or any workflow that is just you.";
    }
    if (props.section.id === "birdhouse") {
      return "Skills that ship with Birdhouse. These are general-purpose best practices to get you started. You can edit the trigger phrases to match how you naturally type.";
    }
    // Workspace section
    const workspaceName = props.section.title;
    return `Skills specific to the "${workspaceName}" workspace. Your team's PR best practices, changelog format, linting rules, or anything unique to this workspace.`;
  };

  const path = () =>
    props.section.id !== "user" && props.section.id !== "birdhouse" && props.section.subtitle
      ? shortenPath(props.section.subtitle)
      : null;

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
          {path() && (
            <>
              <div class="border-t border-border-muted" />
              <p class="px-4 py-2 text-xs font-mono text-text-muted">{path()}</p>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
};

const PatternLibraryLeft: Component<PatternLibraryLeftProps> = (props) => {
  const getSectionIcon = (section: PatternSection) => {
    if (section.id === "user") {
      return <User size={16} class="text-heading" />;
    }
    if (section.id === "birdhouse") {
      return <BirdhouseIcon size={16} />;
    }
    return <WorkspaceIcon size={16} class="text-heading" />;
  };

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Panel Header */}
      <div class="px-4 py-3 border-b border-border flex-shrink-0">
        <h2 class="text-sm font-semibold text-heading">Skill Groups</h2>
        <p class="text-xs text-text-muted mt-0.5">Teach agents how you work</p>
        <p class="text-xs text-text-muted mt-0.5">Your conventions, organized by where they apply</p>
      </div>

      {/* Sections List */}
      <div class="flex-1 overflow-y-auto">
        <For each={props.sections}>
          {(section) => (
            <div>
              {/* Section Header */}
              <div class="flex items-center justify-between py-2 px-3 bg-surface-overlay border-y border-border-muted">
                <div class="flex items-center gap-2 min-w-0">
                  {getSectionIcon(section)}
                  <span class="font-semibold text-sm text-heading truncate">{section.title}</span>
                </div>
                <SectionInfoPopover section={section} />
              </div>

              {/* Groups */}
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
