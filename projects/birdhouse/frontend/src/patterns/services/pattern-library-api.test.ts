// ABOUTME: Tests the skills-backed library API adapter used by the frontend shell.
// ABOUTME: Verifies flat list loading, detail loading, trigger phrase updates, and location reveal.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPattern, fetchPatternLibrary, revealSkillLocation, updateTriggerPhrases } from "./pattern-library-api";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch");
});

describe("fetchPatternLibrary", () => {
  it("returns a flat alphabetized skill list for the library UI", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        skills: [
          {
            id: "git/spotlight-worktree",
            name: "git/spotlight-worktree",
            description: "Keep a main clone aligned with a worktree.",
            scope: "workspace",
            trigger_phrases: ["spotlight this branch"],
            readonly: true,
          },
          {
            id: "find-docs",
            name: "find-docs",
            description: "Retrieve current library docs.",
            scope: "global",
            trigger_phrases: ["docs please"],
            readonly: true,
          },
        ],
      }),
    } as Response);

    const result = await fetchPatternLibrary("ws_test");

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/workspace/ws_test/skills"));
    expect(result).toEqual({
      skills: [
        {
          id: "find-docs",
          title: "find-docs",
          description: "Retrieve current library docs.",
          trigger_phrases: ["docs please"],
          scope: "global",
          readonly: true,
        },
        {
          id: "git/spotlight-worktree",
          title: "git/spotlight-worktree",
          description: "Keep a main clone aligned with a worktree.",
          trigger_phrases: ["spotlight this branch"],
          scope: "workspace",
          readonly: true,
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
        display_location: "/repo/current/.agents/skills/git/spotlight-worktree/SKILL.md",
        files: ["helpers.ts", "templates/commit.md"],
        metadata: {
          description: "Keep a main clone aligned with a worktree.",
          license: "MIT",
          compatibility: "opencode",
        },
      }),
    } as Response);

    const result = await fetchPattern("git/spotlight-worktree", "ws_test");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/workspace/ws_test/skills/git%2Fspotlight-worktree"),
    );
    expect(result).toEqual({
      id: "git/spotlight-worktree",
      title: "git/spotlight-worktree",
      description: "Keep a main clone aligned with a worktree.",
      metadata: {
        description: "Keep a main clone aligned with a worktree.",
        license: "MIT",
        compatibility: "opencode",
      },
      prompt: "# Git Spotlight",
      trigger_phrases: ["spotlight this branch"],
      readonly: true,
      scope: "workspace",
      location: "/repo/current/.agents/skills/git/spotlight-worktree/SKILL.md",
      display_location: "/repo/current/.agents/skills/git/spotlight-worktree/SKILL.md",
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

    const result = await updateTriggerPhrases("find-docs", "ws_test", {
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

describe("revealSkillLocation", () => {
  it("posts to the reveal endpoint for a skill", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) } as Response);

    await revealSkillLocation("git/spotlight-worktree", "ws_test");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/workspace/ws_test/skills/git%2Fspotlight-worktree/reveal"),
      { method: "POST" },
    );
  });
});
