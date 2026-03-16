// ABOUTME: Tests skill selection helpers for the flat list/detail layout.
// ABOUTME: Verifies the library avoids default selection and clears invalid selections.

import { describe, expect, it } from "vitest";
import { resolveSelectedSkillId, resolveVisibleSkillDetail } from "./skill-selection";

describe("resolveSelectedSkillId", () => {
  it("does not auto-select the first visible skill when nothing is selected", () => {
    expect(resolveSelectedSkillId(null, ["find-docs", "release-notes-from-branch"])).toBeNull();
  });

  it("keeps the current selection when it is still visible", () => {
    expect(resolveSelectedSkillId("find-docs", ["find-docs", "release-notes-from-branch"])).toBe("find-docs");
  });

  it("clears the selection when it is no longer visible", () => {
    expect(resolveSelectedSkillId("find-docs", ["release-notes-from-branch"])).toBeNull();
  });
});

describe("resolveVisibleSkillDetail", () => {
  it("returns null when no skill is selected even if a stale detail value exists", () => {
    expect(resolveVisibleSkillDetail(null, { id: "find-docs" })).toBeNull();
  });

  it("returns the detail when a skill is selected", () => {
    expect(resolveVisibleSkillDetail("find-docs", { id: "find-docs" })).toEqual({ id: "find-docs" });
  });
});
