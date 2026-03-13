// ABOUTME: Tests for git-client module.
// ABOUTME: Validates test client defaults, overrides, and normalization helpers.

import { describe, expect, test } from "bun:test";
import type { GhPrResult, PullRequestInfo } from "./git-client.ts";
import {
  createLiveGitClient,
  createTestGitClient,
  mapPrResult,
  normalizeChecksStatus,
  normalizeReviewDecision,
  normalizeState,
} from "./git-client.ts";

describe("createTestGitClient", () => {
  test("returns sensible defaults", async () => {
    const client = createTestGitClient();
    expect(await client.getCurrentBranch("/tmp")).toBe("main");
    expect(await client.getPullRequests("/tmp", "main")).toEqual([]);
  });

  test("accepts overrides for getCurrentBranch", async () => {
    const client = createTestGitClient({
      async getCurrentBranch() {
        return "feature/my-branch";
      },
    });
    expect(await client.getCurrentBranch("/tmp")).toBe("feature/my-branch");
    expect(await client.getPullRequests("/tmp", "main")).toEqual([]);
  });

  test("accepts overrides for getPullRequests", async () => {
    const pr: PullRequestInfo = {
      number: 42,
      title: "Add feature",
      url: "https://github.com/org/repo/pull/42",
      state: "open",
      isDraft: false,
      reviewDecision: "approved",
      checksStatus: "success",
    };
    const client = createTestGitClient({
      async getPullRequests() {
        return [pr];
      },
    });
    const result = await client.getPullRequests("/tmp", "feature");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(pr);
  });
});

describe("normalizeState", () => {
  test("normalizes OPEN/Open/open to open", () => {
    expect(normalizeState("OPEN")).toBe("open");
    expect(normalizeState("Open")).toBe("open");
    expect(normalizeState("open")).toBe("open");
  });

  test("normalizes CLOSED/Closed to closed", () => {
    expect(normalizeState("CLOSED")).toBe("closed");
    expect(normalizeState("Closed")).toBe("closed");
  });

  test("normalizes MERGED/Merged to merged", () => {
    expect(normalizeState("MERGED")).toBe("merged");
    expect(normalizeState("Merged")).toBe("merged");
  });

  test("defaults unknown values to open", () => {
    expect(normalizeState("")).toBe("open");
    expect(normalizeState("unknown")).toBe("open");
  });
});

describe("normalizeReviewDecision", () => {
  test("normalizes APPROVED", () => {
    expect(normalizeReviewDecision("APPROVED")).toBe("approved");
    expect(normalizeReviewDecision("approved")).toBe("approved");
  });

  test("normalizes CHANGES_REQUESTED", () => {
    expect(normalizeReviewDecision("CHANGES_REQUESTED")).toBe("changes_requested");
  });

  test("normalizes REVIEW_REQUIRED", () => {
    expect(normalizeReviewDecision("REVIEW_REQUIRED")).toBe("review_required");
  });

  test("defaults empty or unknown to none", () => {
    expect(normalizeReviewDecision("")).toBe("none");
    expect(normalizeReviewDecision("something")).toBe("none");
  });
});

describe("normalizeChecksStatus", () => {
  test("returns none for empty or missing rollup", () => {
    expect(normalizeChecksStatus([])).toBe("none");
  });

  test("returns failure when any check is FAILURE or ERROR", () => {
    expect(normalizeChecksStatus([{ state: "SUCCESS" }, { state: "FAILURE" }])).toBe("failure");
    expect(normalizeChecksStatus([{ state: "ERROR" }])).toBe("failure");
  });

  test("returns pending when any check is PENDING or EXPECTED", () => {
    expect(normalizeChecksStatus([{ state: "SUCCESS" }, { state: "PENDING" }])).toBe("pending");
    expect(normalizeChecksStatus([{ state: "EXPECTED" }])).toBe("pending");
  });

  test("returns success when all checks succeed", () => {
    expect(normalizeChecksStatus([{ state: "SUCCESS" }, { state: "SUCCESS" }])).toBe("success");
  });
});

describe("mapPrResult", () => {
  test("maps a complete GhPrResult to PullRequestInfo", () => {
    const input: GhPrResult = {
      number: 42,
      title: "Add feature",
      url: "https://github.com/org/repo/pull/42",
      state: "OPEN",
      isDraft: false,
      reviewDecision: "APPROVED",
      statusCheckRollup: [{ state: "SUCCESS" }],
    };
    expect(mapPrResult(input)).toEqual({
      number: 42,
      title: "Add feature",
      url: "https://github.com/org/repo/pull/42",
      state: "open",
      isDraft: false,
      reviewDecision: "approved",
      checksStatus: "success",
    });
  });

  test("handles missing reviewDecision and statusCheckRollup", () => {
    const input = {
      number: 1,
      title: "Fix bug",
      url: "https://github.com/org/repo/pull/1",
      state: "CLOSED",
      isDraft: true,
      reviewDecision: undefined,
      statusCheckRollup: undefined,
    } as unknown as GhPrResult;
    const result = mapPrResult(input);
    expect(result.reviewDecision).toBe("none");
    expect(result.checksStatus).toBe("none");
    expect(result.state).toBe("closed");
    expect(result.isDraft).toBe(true);
  });

  test("maps a full gh JSON array to PullRequestInfo[]", () => {
    const ghJson = JSON.stringify([
      {
        number: 10,
        title: "PR one",
        url: "https://github.com/org/repo/pull/10",
        state: "OPEN",
        isDraft: false,
        reviewDecision: "REVIEW_REQUIRED",
        statusCheckRollup: [{ state: "PENDING" }],
      },
      {
        number: 11,
        title: "PR two",
        url: "https://github.com/org/repo/pull/11",
        state: "MERGED",
        isDraft: false,
        reviewDecision: "APPROVED",
        statusCheckRollup: [{ state: "SUCCESS" }, { state: "SUCCESS" }],
      },
    ]);
    const results: GhPrResult[] = JSON.parse(ghJson);
    const mapped = results.map(mapPrResult);
    expect(mapped).toHaveLength(2);
    expect(mapped[0]?.state).toBe("open");
    expect(mapped[0]?.reviewDecision).toBe("review_required");
    expect(mapped[0]?.checksStatus).toBe("pending");
    expect(mapped[1]?.state).toBe("merged");
    expect(mapped[1]?.checksStatus).toBe("success");
  });

  test("handles empty JSON array", () => {
    const results: GhPrResult[] = JSON.parse("[]");
    expect(results.map(mapPrResult)).toEqual([]);
  });

  test("malformed JSON throws", () => {
    expect(() => JSON.parse("not json")).toThrow();
    expect(() => JSON.parse("{truncated")).toThrow();
  });
});

describe("createLiveGitClient", () => {
  test("getCurrentBranch returns current branch name", async () => {
    const client = createLiveGitClient();
    const branch = await client.getCurrentBranch(process.cwd());
    expect(typeof branch).toBe("string");
    expect(branch.length).toBeGreaterThan(0);
  });

  test("getCurrentBranch rejects for invalid directory", async () => {
    const client = createLiveGitClient();
    expect(client.getCurrentBranch("/nonexistent-dir-xyz")).rejects.toThrow();
  });
});
