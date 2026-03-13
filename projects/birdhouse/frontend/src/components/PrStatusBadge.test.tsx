// ABOUTME: Unit tests for PrStatusBadge component
// ABOUTME: Tests icon selection, PR link, working state styling, and multi-PR count badge

import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import type { PullRequestInfo } from "../types/git";
import { PrStatusBadge } from "./PrStatusBadge";

function makePr(overrides: Partial<PullRequestInfo> = {}): PullRequestInfo {
  return {
    number: 42,
    title: "Test PR",
    url: "https://github.com/org/repo/pull/42",
    state: "open",
    isDraft: false,
    reviewDecision: "none",
    checksStatus: "none",
    ...overrides,
  };
}

describe("PrStatusBadge", () => {
  it("renders nothing when pullRequests is empty", () => {
    const { container } = render(() => <PrStatusBadge pullRequests={[]} isWorking={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders PR number as a link", () => {
    render(() => <PrStatusBadge pullRequests={[makePr()]} isWorking={false} />);
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("PR #42");
    expect(link).toHaveAttribute("href", "https://github.com/org/repo/pull/42");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows approved icon for approved PRs", () => {
    render(() => <PrStatusBadge pullRequests={[makePr({ reviewDecision: "approved" })]} isWorking={false} />);
    const link = screen.getByRole("link");
    // CircleCheck icon should be present as an SVG
    expect(link.querySelector("svg")).toBeTruthy();
  });

  it("shows changes_requested icon for PRs needing changes", () => {
    render(() => <PrStatusBadge pullRequests={[makePr({ reviewDecision: "changes_requested" })]} isWorking={false} />);
    const link = screen.getByRole("link");
    expect(link.querySelector("svg")).toBeTruthy();
  });

  it("shows default circle icon for review_required PRs", () => {
    render(() => <PrStatusBadge pullRequests={[makePr({ reviewDecision: "review_required" })]} isWorking={false} />);
    const link = screen.getByRole("link");
    expect(link.querySelector("svg")).toBeTruthy();
  });

  it("shows draft icon for draft PRs", () => {
    render(() => <PrStatusBadge pullRequests={[makePr({ isDraft: true })]} isWorking={false} />);
    const link = screen.getByRole("link");
    expect(link.querySelector("svg")).toBeTruthy();
  });

  it("applies working state styling when isWorking is true", () => {
    render(() => <PrStatusBadge pullRequests={[makePr()]} isWorking={true} />);
    const link = screen.getByRole("link");
    expect(link.className).toContain("text-text-on-accent");
    expect(link.className).toContain("bg-white/15");
  });

  it("applies default styling when isWorking is false", () => {
    render(() => <PrStatusBadge pullRequests={[makePr()]} isWorking={false} />);
    const link = screen.getByRole("link");
    expect(link.className).toContain("bg-surface-overlay");
    expect(link.className).toContain("text-text-secondary");
  });

  it("shows extra count badge when multiple PRs exist", () => {
    render(() => (
      <PrStatusBadge pullRequests={[makePr(), makePr({ number: 43 }), makePr({ number: 44 })]} isWorking={false} />
    ));
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("does not show extra count badge for a single PR", () => {
    render(() => <PrStatusBadge pullRequests={[makePr()]} isWorking={false} />);
    expect(screen.queryByText("+")).toBeNull();
  });

  it("uses the first PR for the main badge", () => {
    render(() => <PrStatusBadge pullRequests={[makePr({ number: 10 }), makePr({ number: 20 })]} isWorking={false} />);
    expect(screen.getByText("PR #10")).toBeTruthy();
  });
});
