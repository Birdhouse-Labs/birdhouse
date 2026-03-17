// ABOUTME: Tests flat skill list filtering for the library search and scope controls.
// ABOUTME: Verifies scope filtering plus text matching across names, tags, descriptions, and trigger phrases.

import { describe, expect, it } from "vitest";
import { filterSkills } from "./skill-library-filtering";

const skills = [
  {
    id: "find-docs",
    title: "find-docs",
    description: "Retrieve current library docs.",
    tags: ["docs", "research"],
    trigger_phrases: ["docs please"],
    scope: "global" as const,
    readonly: true,
  },
  {
    id: "release-notes-from-branch",
    title: "release-notes-from-branch",
    description: "Generate release notes from git history.",
    tags: ["git", "release"],
    trigger_phrases: ["generate release notes"],
    scope: "workspace" as const,
    readonly: true,
  },
];

describe("filterSkills", () => {
  it("keeps all skills when there is no query and the filter is all", () => {
    expect(filterSkills(skills, "", "all")).toEqual(skills);
  });

  it("filters by install location scope", () => {
    expect(filterSkills(skills, "", "workspace")).toEqual([skills[1]]);
    expect(filterSkills(skills, "", "global")).toEqual([skills[0]]);
  });

  it("matches the search query against names, tags, descriptions, and trigger phrases", () => {
    expect(filterSkills(skills, "release", "all")).toEqual([skills[1]]);
    expect(filterSkills(skills, "library docs", "all")).toEqual([skills[0]]);
    expect(filterSkills(skills, "docs please", "all")).toEqual([skills[0]]);
    expect(filterSkills(skills, "research", "all")).toEqual([skills[0]]);
  });
});
