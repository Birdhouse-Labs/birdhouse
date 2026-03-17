// ABOUTME: Right-side detail pane for the flat skills library layout.
// ABOUTME: Shows selection, loading, error, and the shared skill detail content without a nested modal.

import { type Component, Show } from "solid-js";
import { Button } from "../../components/ui";
import type { SkillDetail } from "../types/skill-library-types";
import SkillDetailContent from "./SkillDetailContent";

export interface SkillDetailPaneProps {
  pattern: SkillDetail | null;
  loading: boolean;
  error: Error | null;
  workspaceId: string;
  onRetry: () => void;
  onUpdateTriggerPhrases: (phrases: string[]) => Promise<void>;
}

const SkillDetailPane: Component<SkillDetailPaneProps> = (props) => {
  return (
    <div class="flex flex-col h-full bg-surface rounded-lg overflow-hidden">
      <Show
        when={props.pattern}
        fallback={
          <Show
            when={props.loading}
            fallback={
              <Show
                when={props.error}
                fallback={<div class="flex items-center justify-center h-full text-text-muted">Select a skill.</div>}
              >
                {(error) => (
                  <div class="flex items-center justify-center h-full">
                    <div class="text-center space-y-4 p-8">
                      <p class="text-danger">Failed to load skill</p>
                      <p class="text-sm text-text-muted">{error().message}</p>
                      <Button variant="secondary" onClick={props.onRetry}>
                        Retry
                      </Button>
                    </div>
                  </div>
                )}
              </Show>
            }
          >
            <div class="flex items-center justify-center h-full">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
            </div>
          </Show>
        }
      >
        {(pattern) => (
          <>
            <div class="px-6 py-4 border-b border-border flex-shrink-0 bg-surface-raised">
              <h2 class="text-xl font-semibold text-heading break-all">{pattern().title}</h2>
            </div>
            <SkillDetailContent
              pattern={pattern()}
              workspaceId={props.workspaceId}
              onUpdateTriggerPhrases={props.onUpdateTriggerPhrases}
            />
          </>
        )}
      </Show>
    </div>
  );
};

export default SkillDetailPane;
