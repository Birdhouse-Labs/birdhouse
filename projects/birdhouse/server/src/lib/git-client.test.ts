// ABOUTME: Tests for git-client module.
// ABOUTME: Validates test client defaults, overrides, and normalization helpers.

import { describe, expect, test } from "bun:test";
import type { PullRequestInfo } from "./git-client.ts";
import { createLiveGitClient, createTestGitClient } from "./git-client.ts";

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
