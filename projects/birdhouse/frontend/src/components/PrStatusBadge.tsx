// ABOUTME: PR status pill badge showing review state icon, PR number, and link.
// ABOUTME: Adapts styling when agent is working (light-on-dark).

import { Circle, CircleCheck, CircleX, GitPullRequestDraft } from "lucide-solid";
import { type Component, Show } from "solid-js";
import type { PullRequestInfo } from "../types/git";

export interface PrStatusBadgeProps {
  pullRequests: PullRequestInfo[];
  isWorking: boolean;
}

function ReviewIcon(props: { pr: PullRequestInfo }) {
  if (props.pr.isDraft) {
    return <GitPullRequestDraft size={12} />;
  }
  switch (props.pr.reviewDecision) {
    case "approved":
      return <CircleCheck size={12} />;
    case "changes_requested":
      return <CircleX size={12} />;
    default:
      return <Circle size={12} />;
  }
}

export const PrStatusBadge: Component<PrStatusBadgeProps> = (props) => {
  const pr = () => props.pullRequests[0];
  const extraCount = () => props.pullRequests.length - 1;

  return (
    <Show when={pr()}>
      {(pr) => (
        <div class="flex items-center gap-1">
          <a
            href={pr().url}
            target="_blank"
            rel="noopener noreferrer"
            class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
              props.isWorking ? "text-text-on-accent bg-white/15" : "bg-surface-overlay text-text-secondary"
            }`}
          >
            <ReviewIcon pr={pr()} />
            <span>PR #{pr().number}</span>
          </a>
          <Show when={extraCount() > 0}>
            <span
              class={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs transition-colors ${
                props.isWorking ? "text-text-on-accent bg-white/15" : "bg-surface-overlay text-text-secondary"
              }`}
            >
              +{extraCount()}
            </span>
          </Show>
        </div>
      )}
    </Show>
  );
};

export default PrStatusBadge;
