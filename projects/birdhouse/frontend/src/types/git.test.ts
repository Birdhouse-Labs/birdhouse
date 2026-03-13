// ABOUTME: Tests for git types ensuring PullRequestInfo shape matches server response.
// ABOUTME: Validates type constraints at compile time via type-level assertions.

import { describe, expect, it } from "vitest";
import type { ChecksStatus, PullRequestInfo, PullRequestState, ReviewDecision } from "./git";

describe("PullRequestInfo type", () => {
  it("accepts a valid PullRequestInfo object", () => {
    const pr: PullRequestInfo = {
      number: 42,
      title: "Add feature",
      url: "https://github.com/org/repo/pull/42",
      state: "open",
      isDraft: false,
      reviewDecision: "none",
      checksStatus: "none",
    };
    expect(pr.number).toBe(42);
    expect(pr.title).toBe("Add feature");
    expect(pr.url).toBe("https://github.com/org/repo/pull/42");
    expect(pr.state).toBe("open");
    expect(pr.isDraft).toBe(false);
    expect(pr.reviewDecision).toBe("none");
    expect(pr.checksStatus).toBe("none");
  });

  it("accepts all valid PullRequestState values", () => {
    const states: PullRequestState[] = ["open", "closed", "merged"];
    expect(states).toHaveLength(3);
  });

  it("accepts all valid ReviewDecision values", () => {
    const decisions: ReviewDecision[] = ["approved", "changes_requested", "review_required", "none"];
    expect(decisions).toHaveLength(4);
  });

  it("accepts all valid ChecksStatus values", () => {
    const statuses: ChecksStatus[] = ["pending", "success", "failure", "none"];
    expect(statuses).toHaveLength(4);
  });

  it("has all required fields matching the server response shape", () => {
    const pr: PullRequestInfo = {
      number: 1,
      title: "PR title",
      url: "https://example.com/pull/1",
      state: "merged",
      isDraft: true,
      reviewDecision: "approved",
      checksStatus: "success",
    };
    const keys = Object.keys(pr).sort();
    expect(keys).toEqual(["checksStatus", "isDraft", "number", "reviewDecision", "state", "title", "url"]);
  });
});
