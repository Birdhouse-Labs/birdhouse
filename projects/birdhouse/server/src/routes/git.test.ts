// ABOUTME: Tests for git routes (pull requests endpoint)
// ABOUTME: Verifies success response shape and error handling for various failure modes

import { describe, expect, test } from "bun:test";
import { createTestDeps, withDeps } from "../dependencies";
import type { PullRequestInfo } from "../lib/git-client";
import {
  GhAuthError,
  GhNotInstalledError,
  GitRepoNotFoundError,
  createTestGitClient,
} from "../lib/git-client";
import { withWorkspaceContext } from "../test-utils";
import { createGitRoutes } from "./git";

describe("GET /pull-requests", () => {
  test("returns branch and pull requests on success", async () => {
    const mockPRs: PullRequestInfo[] = [
      {
        number: 42,
        title: "Add feature",
        url: "https://github.com/org/repo/pull/42",
        state: "open",
        isDraft: false,
        reviewDecision: "approved",
        checksStatus: "success",
      },
    ];

    const deps = createTestDeps();
    deps.git = createTestGitClient({
      async getCurrentBranch() {
        return "feature-branch";
      },
      async getPullRequests() {
        return mockPRs;
      },
    });

    await withDeps(deps, async () => {
      const app = withWorkspaceContext(createGitRoutes);
      const res = await app.fetch(new Request("http://localhost/pull-requests"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        available: true,
        branch: "feature-branch",
        pullRequests: mockPRs,
      });
    });
  });

  test("returns empty pull requests array when none exist", async () => {
    const deps = createTestDeps();
    deps.git = createTestGitClient({
      async getCurrentBranch() {
        return "main";
      },
      async getPullRequests() {
        return [];
      },
    });

    await withDeps(deps, async () => {
      const app = withWorkspaceContext(createGitRoutes);
      const res = await app.fetch(new Request("http://localhost/pull-requests"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        available: true,
        branch: "main",
        pullRequests: [],
      });
    });
  });

  test("returns not_a_git_repo when directory is not a git repo", async () => {
    const deps = createTestDeps();
    deps.git = createTestGitClient({
      async getCurrentBranch() {
        throw new GitRepoNotFoundError("not a git repository");
      },
    });

    await withDeps(deps, async () => {
      const app = withWorkspaceContext(createGitRoutes);
      const res = await app.fetch(new Request("http://localhost/pull-requests"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ available: false, reason: "not_a_git_repo" });
    });
  });

  test("returns gh_not_installed when gh CLI is missing", async () => {
    const deps = createTestDeps();
    deps.git = createTestGitClient({
      async getCurrentBranch() {
        return "main";
      },
      async getPullRequests() {
        throw new GhNotInstalledError("gh: command not found");
      },
    });

    await withDeps(deps, async () => {
      const app = withWorkspaceContext(createGitRoutes);
      const res = await app.fetch(new Request("http://localhost/pull-requests"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ available: false, reason: "gh_not_installed" });
    });
  });

  test("returns not_authenticated when gh auth fails", async () => {
    const deps = createTestDeps();
    deps.git = createTestGitClient({
      async getCurrentBranch() {
        return "main";
      },
      async getPullRequests() {
        throw new GhAuthError("gh auth login required");
      },
    });

    await withDeps(deps, async () => {
      const app = withWorkspaceContext(createGitRoutes);
      const res = await app.fetch(new Request("http://localhost/pull-requests"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ available: false, reason: "not_authenticated" });
    });
  });

  test("returns unknown and logs error for unexpected errors", async () => {
    const deps = createTestDeps();
    deps.git = createTestGitClient({
      async getCurrentBranch() {
        throw new Error("something unexpected");
      },
    });

    await withDeps(deps, async () => {
      const app = withWorkspaceContext(createGitRoutes);
      const res = await app.fetch(new Request("http://localhost/pull-requests"));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ available: false, reason: "unknown" });
    });
  });
});
