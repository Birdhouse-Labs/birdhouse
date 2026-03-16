// ABOUTME: Git routes for fetching branch and pull request info
// ABOUTME: Uses GitClient to query current branch and associated PRs via gh CLI

import { Hono } from "hono";
import { getDepsFromContext } from "../lib/context-deps";
import { GhAuthError, GhNotInstalledError, GitRepoNotFoundError } from "../lib/git-client";
import "../types/context";

export function createGitRoutes() {
  const app = new Hono();

  // GET /pull-requests - Get pull requests for the current branch
  app.get("/pull-requests", async (c) => {
    const deps = getDepsFromContext(c);
    const workspace = c.get("workspace");

    try {
      const branch = await deps.git.getCurrentBranch(workspace.directory);
      const pullRequests = await deps.git.getPullRequests(workspace.directory, branch);

      return c.json({ available: true, branch, pullRequests });
    } catch (error) {
      if (error instanceof GitRepoNotFoundError) {
        return c.json({ available: false, reason: "not_a_git_repo" as const });
      }
      if (error instanceof GhNotInstalledError) {
        return c.json({ available: false, reason: "gh_not_installed" as const });
      }
      if (error instanceof GhAuthError) {
        return c.json({ available: false, reason: "not_authenticated" as const });
      }

      deps.log.server.error({ error }, "Unexpected git error");
      return c.json({ available: false, reason: "unknown" as const });
    }
  });

  return app;
}
