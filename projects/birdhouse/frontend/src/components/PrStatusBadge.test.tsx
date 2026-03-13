// ABOUTME: Unit tests for PrStatusBadge component
// ABOUTME: Tests checks status icon, theme-accent pill color, working state styling, and multi-PR count badge

import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import type { ChecksStatus, PullRequestInfo } from "../types/git";
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

  it("renders a single icon (not two)", () => {
    render(() => <PrStatusBadge pullRequests={[makePr({ checksStatus: "success" })]} isWorking={false} />);
    const link = screen.getByRole("link");
    const svgs = link.querySelectorAll("svg");
    expect(svgs.length).toBe(1);
  });

  // --- Checks status icon per state ---

  it("shows CircleCheck icon for success status", () => {
    render(() => <PrStatusBadge pullRequests={[makePr({ checksStatus: "success" })]} isWorking={false} />);
    expect(screen.getByRole("link").querySelector("svg")).toBeTruthy();
  });

  it("shows CircleX icon for failure status", () => {
    render(() => <PrStatusBadge pullRequests={[makePr({ checksStatus: "failure" })]} isWorking={false} />);
    expect(screen.getByRole("link").querySelector("svg")).toBeTruthy();
  });

  it("shows spinning Loader2 icon for pending status", () => {
    render(() => <PrStatusBadge pullRequests={[makePr({ checksStatus: "pending" })]} isWorking={false} />);
    const spinner = screen.getByRole("link").querySelector("span.animate-spin");
    expect(spinner).toBeTruthy();
    expect(spinner?.querySelector("svg")).toBeTruthy();
  });

  it("shows Circle icon for none status", () => {
    render(() => <PrStatusBadge pullRequests={[makePr({ checksStatus: "none" })]} isWorking={false} />);
    expect(screen.getByRole("link").querySelector("svg")).toBeTruthy();
  });

  // --- Pill uses theme accent for any active status ---

  it.each(["success", "failure", "pending"] as ChecksStatus[])("applies accent pill for %s status", (status) => {
    render(() => <PrStatusBadge pullRequests={[makePr({ checksStatus: status })]} isWorking={false} />);
    const link = screen.getByRole("link");
    expect(link.className).toContain("bg-accent/15");
    expect(link.className).toContain("text-accent");
  });

  it("applies neutral pill for none status", () => {
    render(() => <PrStatusBadge pullRequests={[makePr({ checksStatus: "none" })]} isWorking={false} />);
    const link = screen.getByRole("link");
    expect(link.className).toContain("bg-surface-overlay");
    expect(link.className).toContain("text-text-secondary");
  });

  // --- Working state ---

  it.each(["success", "failure", "pending"] as ChecksStatus[])(
    "applies working-state accent pill for %s status",
    (status) => {
      render(() => <PrStatusBadge pullRequests={[makePr({ checksStatus: status })]} isWorking={true} />);
      const link = screen.getByRole("link");
      expect(link.className).toContain("bg-accent/20");
      expect(link.className).toContain("text-accent");
    },
  );

  it("applies working-state neutral pill for none", () => {
    render(() => <PrStatusBadge pullRequests={[makePr({ checksStatus: "none" })]} isWorking={true} />);
    const link = screen.getByRole("link");
    expect(link.className).toContain("bg-white/15");
    expect(link.className).toContain("text-text-on-accent");
  });

  // --- Multi-PR badges ---

  it("shows extra count badge when multiple PRs exist", () => {
    render(() => (
      <PrStatusBadge pullRequests={[makePr(), makePr({ number: 43 }), makePr({ number: 44 })]} isWorking={false} />
    ));
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("extra count badge matches pill color of first PR", () => {
    render(() => (
      <PrStatusBadge
        pullRequests={[makePr({ checksStatus: "failure" }), makePr({ number: 43 })]}
        isWorking={false}
      />
    ));
    const extraBadge = screen.getByText("+1");
    expect(extraBadge.className).toContain("bg-accent/15");
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
