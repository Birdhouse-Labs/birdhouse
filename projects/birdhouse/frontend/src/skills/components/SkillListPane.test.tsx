// ABOUTME: Tests the flat list pane used by the skills library dialog.
// ABOUTME: Verifies search input, install location filter, and visible skill selection callbacks.

import { fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library";
import { createMemo, createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { filterSkills } from "../utils/skill-library-filtering";
import SkillListPane from "./SkillListPane";

const skills = [
  {
    id: "find-docs",
    title: "find-docs",
    description: "Retrieve current library docs.",
    tags: ["docs", "research"],
    trigger_phrases: ["docs please"],
    metadata_trigger_phrases: [],
    display_location: "~/.agents/skills/find-docs/SKILL.md",
    scope: "global" as const,
    readonly: true,
  },
  {
    id: "release-notes-from-branch",
    title: "release-notes-from-branch",
    description: "Generate release notes from git history.",
    tags: ["git", "release"],
    trigger_phrases: ["generate release notes"],
    metadata_trigger_phrases: [],
    display_location: "/repo/workspace/.agents/skills/release-notes/SKILL.md",
    scope: "workspace" as const,
    readonly: true,
  },
];

describe("SkillListPane", () => {
  it("updates search and filter controls while showing a flat filtered list", async () => {
    const onSelectSkill = vi.fn();

    const Wrapper = () => {
      const [searchQuery, setSearchQuery] = createSignal("");
      const [scopeFilter, setScopeFilter] = createSignal<"all" | "workspace" | "global">("all");
      const [selectedSkillId, setSelectedSkillId] = createSignal<string | null>(skills[0]?.id ?? null);
      const filteredSkills = createMemo(() => filterSkills(skills, searchQuery(), scopeFilter()));

      return (
        <SkillListPane
          skills={skills}
          filteredSkills={filteredSkills()}
          searchQuery={searchQuery()}
          scopeFilter={scopeFilter()}
          selectedSkillId={selectedSkillId()}
          onSearchQueryChange={setSearchQuery}
          onScopeFilterChange={setScopeFilter}
          onSelectSkill={(skillId) => {
            setSelectedSkillId(skillId);
            onSelectSkill(skillId);
          }}
        />
      );
    };

    render(() => <Wrapper />);

    expect(screen.getByText("find-docs")).toBeInTheDocument();
    expect(screen.getByText("release-notes-from-branch")).toBeInTheDocument();
    expect(screen.getByText("docs")).toBeInTheDocument();
    expect(screen.getByText("research")).toBeInTheDocument();

    fireEvent.input(screen.getByPlaceholderText("Search skills"), {
      target: { value: "release" },
    });

    await waitFor(() => {
      expect(screen.queryByText("find-docs")).not.toBeInTheDocument();
      expect(screen.getByText("release-notes-from-branch")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Filter skills" }));
    const filterDialog = screen.getByRole("dialog", { name: "Install location" });
    fireEvent.click(within(filterDialog).getByText("Workspace"));

    await waitFor(() => {
      expect(screen.getByText("1 skill")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /release-notes-from-branch/i }));

    expect(onSelectSkill).toHaveBeenCalledWith("release-notes-from-branch");
  });
});
