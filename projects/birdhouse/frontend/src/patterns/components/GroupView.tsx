// ABOUTME: Right panel for the reused library shell showing skill groups and cards.
// ABOUTME: Fetches a selected group from the skills-backed library API and renders read-only skills.

import { type Component, createResource, For, Show } from "solid-js";
import { Button } from "../../components/ui";
import { fetchGroupWithPatterns } from "../services/pattern-library-api";
import type { PatternMetadata } from "../types/pattern-library-types";
import PatternCard from "./PatternCard";

export interface GroupViewProps {
  groupId: string;
  workspaceId: string;
  onViewPattern: (patternId: string) => void;
  onPreviewPattern: (patternId: string) => void;
  refetchTrigger?: number;
}

const GroupView: Component<GroupViewProps> = (props) => {
  const [group, { refetch }] = createResource(
    () => ({ groupId: props.groupId, workspaceId: props.workspaceId, trigger: props.refetchTrigger }),
    async ({ groupId, workspaceId }) => fetchGroupWithPatterns(groupId, workspaceId),
  );

  return (
    <div class="flex flex-col h-full">
      <Show when={!group.loading && !group.error && group()}>
        {(g) => (
          <>
            <div class="px-6 py-4 border-b border-border flex-shrink-0">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 space-y-1">
                  <h2 class="text-xl font-semibold text-heading">{g().title}</h2>
                  <p class="text-sm text-text-secondary">{g().description}</p>
                  <p class="text-sm text-text-secondary">
                    {g().pattern_count} {g().pattern_count === 1 ? "skill" : "skills"}
                  </p>
                </div>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              <Show
                when={g().patterns && g().patterns.length > 0}
                fallback={
                  <div class="text-sm text-text-muted text-center py-8">No skills are visible in this scope.</div>
                }
              >
                <section>
                  <h3 class="text-sm font-semibold text-heading mb-3">Skills</h3>
                  <div class="space-y-2">
                    <For each={g().patterns}>
                      {(pattern: PatternMetadata) => (
                        <PatternCard
                          pattern={pattern}
                          onView={props.onViewPattern}
                          onPreview={props.onPreviewPattern}
                          readonly={g().readonly}
                        />
                      )}
                    </For>
                  </div>
                </section>
              </Show>
            </div>
          </>
        )}
      </Show>

      <Show when={group.loading}>
        <div class="flex items-center justify-center h-full">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
        </div>
      </Show>

      <Show when={group.error}>
        <div class="flex items-center justify-center h-full">
          <div class="text-center space-y-4 p-8">
            <p class="text-danger">Failed to load group</p>
            <p class="text-sm text-text-muted">{group.error?.message}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default GroupView;
