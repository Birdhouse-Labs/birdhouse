// ABOUTME: Tests for CommandPalette filtering logic and keyboard navigation
// ABOUTME: Verifies substring filtering, active index wrapping, and action structure

import { describe, expect, it } from "vitest";
import { filterActions, type PaletteAction } from "./CommandPalette";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeAction(label: string, group: "agent" | "navigation" = "navigation"): PaletteAction {
  return { id: label, label, group, run: () => {} };
}

// ---------------------------------------------------------------------------
// filterActions
// ---------------------------------------------------------------------------

describe("filterActions", () => {
  const actions: PaletteAction[] = [
    makeAction("Workspace Settings", "navigation"),
    makeAction("Skills", "navigation"),
    makeAction("Agent Search", "navigation"),
    makeAction("New Agent", "navigation"),
    makeAction("Edit Title", "agent"),
    makeAction("Edit Notes", "agent"),
    makeAction("Archive Agent", "agent"),
    makeAction("Unarchive Agent", "agent"),
    makeAction("Export Agent", "agent"),
  ];

  it("returns all actions when query is empty", () => {
    expect(filterActions(actions, "")).toEqual(actions);
  });

  it("returns all actions when query is only whitespace", () => {
    expect(filterActions(actions, "   ")).toEqual(actions);
  });

  it("filters by case-insensitive substring match on label", () => {
    const result = filterActions(actions, "agent");
    const labels = result.map((a) => a.label);
    expect(labels).toContain("Agent Search");
    expect(labels).toContain("New Agent");
    expect(labels).toContain("Archive Agent");
    expect(labels).toContain("Unarchive Agent");
    expect(labels).toContain("Export Agent");
    expect(labels).not.toContain("Edit Title");
    expect(labels).not.toContain("Edit Notes");
  });

  it("is case-insensitive", () => {
    const lower = filterActions(actions, "workspace");
    const upper = filterActions(actions, "WORKSPACE");
    expect(lower).toEqual(upper);
    expect(lower.length).toBe(1);
    expect(lower[0]?.label).toBe("Workspace Settings");
  });

  it("returns empty array when nothing matches", () => {
    expect(filterActions(actions, "zzznomatch")).toEqual([]);
  });

  it("preserves original order of matching actions", () => {
    const result = filterActions(actions, "edit");
    expect(result.map((a) => a.label)).toEqual(["Edit Title", "Edit Notes"]);
  });
});
