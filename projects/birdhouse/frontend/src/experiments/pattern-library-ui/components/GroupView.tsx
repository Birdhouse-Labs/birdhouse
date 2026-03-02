// ABOUTME: Right panel showing group description and pattern list
// ABOUTME: Displays prominent "Add Pattern" button and pattern cards

import { type Component, createResource, For, Show } from "solid-js";
import { Button } from "../../../components/ui";
import { fetchGroupWithPatterns } from "../services/pattern-library-api";
import type { PatternMetadata } from "../types/pattern-library-types";
import PatternCard from "./PatternCard";

export interface GroupViewProps {
  groupId: string;
  workspaceId: string;
  onAddPattern: () => void;
  onViewPattern: (patternId: string) => void;
  onPreviewPattern: (patternId: string) => void;
  refetchTrigger?: number; // Increment this to force a refetch
}

const GroupView: Component<GroupViewProps> = (props) => {
  const [group, { refetch }] = createResource(
    () => ({ groupId: props.groupId, workspaceId: props.workspaceId, trigger: props.refetchTrigger }),
    async ({ groupId, workspaceId }) => {
      return fetchGroupWithPatterns(groupId, workspaceId);
    },
  );

  const refetchGroup = () => {
    refetch();
  };

  return (
    <div class="flex flex-col h-full">
      <Show when={!group.loading && !group.error && group()}>
        {(g) => (
          <>
            {/* Group Header */}
            <div class="px-6 py-4 border-b border-border flex-shrink-0">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1">
                  <h2 class="text-xl font-semibold text-heading mb-1">{g().title}</h2>
                  <p class="text-sm text-text-secondary">{g().pattern_count} patterns</p>
                </div>
                <Show when={!g().readonly && g().patterns && g().patterns?.length > 0}>
                  <Button variant="primary" onClick={props.onAddPattern}>
                    Add Pattern
                  </Button>
                </Show>
              </div>
            </div>

            {/* Scrollable Content */}
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Patterns List or Empty State */}
              <Show
                when={g().patterns && g().patterns?.length > 0}
                fallback={
                  <Show
                    when={!g().readonly}
                    fallback={
                      <div class="text-sm text-text-muted text-center py-8">No patterns in this group yet.</div>
                    }
                  >
                    {/* Empty state for editable groups */}
                    <div class="flex flex-col items-center justify-center py-16 px-8 text-center space-y-4">
                      <p class="text-text-primary font-medium">No patterns here yet.</p>
                      <Show
                        when={g().scope === "user"}
                        fallback={
                          <div class="text-sm text-text-muted max-w-sm space-y-3">
                            <p>These patterns are specific to this workspace.</p>
                            <p>
                              Teach agents how your team works: PR formats, release processes, deployment steps, and
                              project conventions.
                            </p>
                          </div>
                        }
                      >
                        <p class="text-sm text-text-muted max-w-sm">
                          Patterns in this group come with you to all your workspaces — great for techniques and
                          workflows you use everywhere.
                        </p>
                      </Show>
                      <div class="pt-2">
                        <Button variant="primary" onClick={props.onAddPattern}>
                          Create your first pattern
                        </Button>
                      </div>
                    </div>
                  </Show>
                }
              >
                <section>
                  <h3 class="text-sm font-semibold text-heading mb-3">Patterns</h3>
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

      {/* Loading State */}
      <Show when={group.loading}>
        <div class="flex items-center justify-center h-full">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
        </div>
      </Show>

      {/* Error State */}
      <Show when={group.error}>
        <div class="flex items-center justify-center h-full">
          <div class="text-center space-y-4 p-8">
            <p class="text-danger">Failed to load group</p>
            <p class="text-sm text-text-muted">{group.error?.message}</p>
            <Button variant="secondary" onClick={() => refetchGroup()}>
              Retry
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default GroupView;
