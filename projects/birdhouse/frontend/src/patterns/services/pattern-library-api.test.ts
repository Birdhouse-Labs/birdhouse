// ABOUTME: Tests the skills-backed library API adapter used by the frontend shell.
// ABOUTME: Verifies scope grouping, skill detail loading, and trigger phrase updates.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPattern, fetchPatternLibrary, updateTriggerPhrases } from "./pattern-library-api";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch");
});

describe("fetchPatternLibrary", () => {
  it("groups workspace and shared skills for the existing library shell", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        skills: [
          {
            id: "find-docs",
            name: "find-docs",
            description: "Retrieve current library docs.",
            scope: "global",
            trigger_phrases: ["docs please"],
            readonly: true,
          },
          {
            id: "git/spotlight-worktree",
            name: "git/spotlight-worktree",
            description: "Keep a main clone aligned with a worktree.",
            scope: "workspace",
            trigger_phrases: ["spotlight this branch"],
            readonly: true,
          },
        ],
      }),
    } as Response);

    const result = await fetchPatternLibrary("ws_test");

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/workspace/ws_test/skills"));
    expect(result).toEqual({
      sections: [
        {
          id: "workspace",
          title: "Workspace Skills",
          subtitle: "Installed in this workspace's OpenCode runtime",
          is_current: true,
          groups: [
            {
              id: "workspace",
              title: "Workspace Skills",
              description: "Skills resolved from inside the current workspace directory.",
              scope: "workspace",
              workspace_id: "ws_test",
              pattern_count: 1,
              readonly: true,
              patterns: [
                {
                  id: "git/spotlight-worktree",
                  title: "git/spotlight-worktree",
                  description: "Keep a main clone aligned with a worktree.",
                  trigger_phrases: ["spotlight this branch"],
                  scope: "workspace",
                },
              ],
            },
          ],
        },
        {
          id: "global",
          title: "Shared Skills",
          subtitle: "Installed outside this workspace but visible to its OpenCode runtime",
          is_current: false,
          groups: [
            {
              id: "global",
              title: "Shared Skills",
              description: "Skills resolved from outside the current workspace directory.",
              scope: "global",
              workspace_id: null,
              pattern_count: 1,
              readonly: true,
              patterns: [
                {
                  id: "find-docs",
                  title: "find-docs",
                  description: "Retrieve current library docs.",
                  trigger_phrases: ["docs please"],
                  scope: "global",
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("throws a useful error when the skills request fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: "Internal Server Error",
      text: async () => JSON.stringify({ error: "runtime unavailable" }),
    } as Response);

    await expect(fetchPatternLibrary("ws_test")).rejects.toThrow(
      'Failed to fetch skills library: Internal Server Error - {"error":"runtime unavailable"}',
    );
  });
});

describe("fetchPattern", () => {
  it("loads a single skill detail by encoded skill name", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "git/spotlight-worktree",
        name: "git/spotlight-worktree",
        description: "Keep a main clone aligned with a worktree.",
        scope: "workspace",
        trigger_phrases: ["spotlight this branch"],
        readonly: true,
        content: "# Git Spotlight",
        location: "/repo/current/.agents/skills/git/spotlight-worktree/SKILL.md",
        files: ["helpers.ts", "templates/commit.md"],
      }),
    } as Response);

    const result = await fetchPattern("workspace", "git/spotlight-worktree", "ws_test");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/workspace/ws_test/skills/git%2Fspotlight-worktree"),
    );
    expect(result).toEqual({
      id: "git/spotlight-worktree",
      group_id: "workspace",
      title: "git/spotlight-worktree",
      description: "Keep a main clone aligned with a worktree.",
      prompt: "# Git Spotlight",
      trigger_phrases: ["spotlight this branch"],
      readonly: true,
      scope: "workspace",
      location: "/repo/current/.agents/skills/git/spotlight-worktree/SKILL.md",
      files: ["helpers.ts", "templates/commit.md"],
    });
  });
});

describe("updateTriggerPhrases", () => {
  it("patches trigger phrases by skill name", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: "find-docs",
        trigger_phrases: ["docs please", "reference the docs"],
      }),
    } as Response);

    const result = await updateTriggerPhrases("global", "find-docs", "ws_test", {
      trigger_phrases: ["docs please", "reference the docs"],
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/workspace/ws_test/skills/find-docs/trigger-phrases"),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger_phrases: ["docs please", "reference the docs"] }),
      },
    );
    expect(result).toEqual({
      name: "find-docs",
      trigger_phrases: ["docs please", "reference the docs"],
    });
  });
});
