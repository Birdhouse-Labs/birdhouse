// ABOUTME: Flat list pane for browsing visible skills with local search and install location filtering.
// ABOUTME: Reuses existing themed primitives while removing the old group-based navigation model.

import Popover from "corvu/popover";
import { Filter, Search } from "lucide-solid";
import { type Component, For, Show } from "solid-js";
import { Button, ButtonGroup } from "../../components/ui";
import { useZIndex } from "../../contexts/ZIndexContext";
import { cardSurfaceFlat } from "../../styles/containerStyles";
import type { PatternMetadata, SkillListScopeFilter } from "../types/pattern-library-types";

export interface SkillListPaneProps {
  skills: PatternMetadata[];
  filteredSkills: PatternMetadata[];
  searchQuery: string;
  scopeFilter: SkillListScopeFilter;
  selectedSkillId: string | null;
  onSearchQueryChange: (value: string) => void;
  onScopeFilterChange: (value: SkillListScopeFilter) => void;
  onSelectSkill: (skillId: string) => void;
}

const SkillListPane: Component<SkillListPaneProps> = (props) => {
  const baseZIndex = useZIndex();

  const resultCountLabel = () => {
    const count = props.filteredSkills.length;
    return `${count} ${count === 1 ? "skill" : "skills"}`;
  };

  const scopeLabel = (scope: PatternMetadata["scope"]) => (scope === "workspace" ? "Workspace" : "Global");

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="px-4 py-3 border-b border-border flex-shrink-0 space-y-3">
        <div class="flex items-center gap-2">
          <label class={`flex-1 flex items-center gap-2 rounded-lg ${cardSurfaceFlat} px-3 py-2`}>
            <Search size={16} class="text-text-muted flex-shrink-0" />
            <input
              type="text"
              value={props.searchQuery}
              onInput={(event) => props.onSearchQueryChange(event.currentTarget.value)}
              placeholder="Search skills"
              class="w-full bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none"
            />
          </label>

          <Popover>
            <Popover.Trigger as={Button} variant="tertiary" leftIcon={<Filter size={16} />} aria-label="Filter skills">
              Filter
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                class="w-64 rounded-xl p-4 border shadow-2xl bg-surface-raised border-border space-y-3"
                style={{ "z-index": baseZIndex }}
              >
                <Popover.Label class="text-sm font-semibold text-heading block">Install location</Popover.Label>
                <ButtonGroup
                  items={[
                    { value: "all", label: "All" },
                    { value: "workspace", label: "Workspace" },
                    { value: "global", label: "Global" },
                  ]}
                  value={props.scopeFilter}
                  onChange={(value) => props.onScopeFilterChange(value as SkillListScopeFilter)}
                  class="w-full"
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover>
        </div>

        <div class="flex items-center justify-between text-xs text-text-muted">
          <span>{resultCountLabel()}</span>
          <Show when={props.scopeFilter !== "all"}>
            <span>{props.scopeFilter === "workspace" ? "Workspace only" : "Global only"}</span>
          </Show>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-3 space-y-2">
        <Show
          when={props.filteredSkills.length > 0}
          fallback={
            <div class="text-sm text-text-muted text-center py-10">
              {props.skills.length === 0 ? "No skills found." : "No skills match your filters."}
            </div>
          }
        >
          <For each={props.filteredSkills}>
            {(skill) => (
              <button
                type="button"
                onClick={() => props.onSelectSkill(skill.id)}
                class={`w-full rounded-lg text-left p-4 transition-colors ${cardSurfaceFlat}`}
                classList={{
                  "ring-1 ring-accent bg-gradient-to-r from-gradient-from/10 via-gradient-via/10 to-gradient-to/10":
                    props.selectedSkillId === skill.id,
                  "hover:bg-surface-overlay": props.selectedSkillId !== skill.id,
                }}
                aria-label={`View ${skill.title}`}
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="text-sm font-semibold text-heading break-all">{skill.title}</h3>
                      <span class="px-2 py-0.5 text-[11px] rounded-full bg-surface-overlay text-text-muted">
                        {scopeLabel(skill.scope)}
                      </span>
                    </div>
                    <Show when={skill.description}>
                      <p class="text-xs text-text-secondary line-clamp-2 mt-1">{skill.description}</p>
                    </Show>
                    <Show when={skill.trigger_phrases.length > 0}>
                      <div class="flex flex-wrap gap-1 mt-2">
                        <For each={skill.trigger_phrases.slice(0, 3)}>
                          {(phrase) => (
                            <span class="px-2 py-0.5 text-xs bg-surface-overlay text-text-muted rounded font-mono">
                              {phrase}
                            </span>
                          )}
                        </For>
                        <Show when={skill.trigger_phrases.length > 3}>
                          <span class="px-2 py-0.5 text-xs text-text-muted">
                            +{skill.trigger_phrases.length - 3} more
                          </span>
                        </Show>
                      </div>
                    </Show>
                  </div>
                </div>
              </button>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};

export default SkillListPane;
