// ABOUTME: Shared TypeScript types for git/PR data.
// ABOUTME: Matches the server response shape from the pull-requests endpoint.

export type PullRequestState = "open" | "closed" | "merged";
export type ReviewDecision = "approved" | "changes_requested" | "review_required" | "none";
export type ChecksStatus = "pending" | "success" | "failure" | "none";

export interface PullRequestInfo {
  number: number;
  title: string;
  url: string;
  state: PullRequestState;
  isDraft: boolean;
  reviewDecision: ReviewDecision;
  checksStatus: ChecksStatus;
}
