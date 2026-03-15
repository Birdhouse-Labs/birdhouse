// ABOUTME: Tests markdown skill link helpers used by the composer and preview UI.
// ABOUTME: Verifies link generation plus safe parsing and deduplication of attached skills.

import { describe, expect, it } from "vitest";
import { buildSkillMarkdownLink, extractSkillLinkNames } from "./skillLinks";

describe("buildSkillMarkdownLink", () => {
  it("creates a canonical birdhouse skill link", () => {
    expect(buildSkillMarkdownLink("generate release notes", "release-notes-from-branch")).toBe(
      "[generate release notes](birdhouse:skill/release-notes-from-branch)",
    );
  });
});

describe("extractSkillLinkNames", () => {
  it("extracts unique skill names from markdown skill links", () => {
    const text = [
      "Use [generate release notes](birdhouse:skill/release-notes-from-branch) today.",
      "Then use [spotlight](birdhouse:skill/git/spotlight-worktree) too.",
      "Repeat [generate release notes](birdhouse:skill/release-notes-from-branch) again.",
    ].join("\n\n");

    expect(extractSkillLinkNames(text)).toEqual(["release-notes-from-branch", "git/spotlight-worktree"]);
  });

  it("ignores raw trigger phrase text and malformed links", () => {
    const text = [
      "generate release notes",
      "[broken](birdhouse:skill/)",
      "[almost there](birdhouse:skil/release-notes-from-branch)",
      "[still broken](birdhouse:skill release-notes-from-branch)",
    ].join("\n");

    expect(extractSkillLinkNames(text)).toEqual([]);
  });
});
