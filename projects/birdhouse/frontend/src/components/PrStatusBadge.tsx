// ABOUTME: PR status pill badge showing CI checks status icon, PR number, and link.
// ABOUTME: Pill uses theme accent color; icon shape conveys status. Adapts styling when agent is working.

import { Circle, CircleCheck, CircleX, Loader2 } from "lucide-solid";
import { type Component, Show } from "solid-js";
import type { ChecksStatus, PullRequestInfo } from "../types/git";

export interface PrStatusBadgeProps {
  pullRequests: PullRequestInfo[];
  isWorking: boolean;
}

function StatusIcon(props: { status: ChecksStatus }) {
  switch (props.status) {
    case "success":
      return <CircleCheck size={12} />;
    case "failure":
      return <CircleX size={12} />;
    case "pending":
      return (
        <span class="inline-flex animate-spin">
          <Loader2 size={12} />
        </span>
      );
    default:
      return <Circle size={12} />;
  }
}

function pillClasses(status: ChecksStatus, isWorking: boolean): string {
  if (isWorking) {
    if (status === "none") return "bg-white/15 text-text-on-accent";
    if (status === "failure") return "bg-danger/20 text-danger";
    return "bg-accent/20 text-accent";
  }
  if (status === "none") return "bg-surface-overlay text-text-secondary";
  if (status === "failure") return "bg-danger/15 text-danger";
  return "bg-accent/15 text-accent";
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
            class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${pillClasses(pr().checksStatus, props.isWorking)}`}
          >
            <StatusIcon status={pr().checksStatus} />
            <span>PR #{pr().number}</span>
          </a>
          <Show when={extraCount() > 0}>
            <span
              class={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs transition-colors ${pillClasses(pr().checksStatus, props.isWorking)}`}
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
