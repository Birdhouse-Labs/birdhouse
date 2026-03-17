// ABOUTME: Tests the skill detail dialog shown from the reused library shell.
// ABOUTME: Verifies scope copy, XML preview, and trigger phrase editing callbacks.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import SkillDetailModal from "./SkillDetailModal";

describe("SkillDetailModal", () => {
  const baseSkill = {
    id: "find-docs",
    group_id: "global",
    title: "find-docs",
    description: "Retrieve current library docs.",
    tags: ["docs", "research"],
    metadata: {
      description: "Retrieve current library docs.",
      license: "MIT",
      compatibility: "opencode",
      metadata: { audience: "maintainers" },
    },
    prompt: "# Find Docs\n\nUse Context7 first.",
    trigger_phrases: ["docs please"],
    readonly: true,
    scope: "global" as const,
    location: "/Users/test/.claude/skills/find-docs/SKILL.md",
    display_location: "~/.claude/skills/find-docs/SKILL.md",
    files: ["examples/basic.md", "templates/query.txt"],
  };

  it("renders shared trigger phrase scope and skill-based XML preview", async () => {
    render(() => (
      <SkillDetailModal
        open={true}
        onOpenChange={() => {}}
        skill={baseSkill}
        workspaceId="ws_test"
        onUpdateTriggerPhrases={vi.fn().mockResolvedValue(undefined)}
      />
    ));

    expect(screen.getByText("Trigger Phrases")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Retrieve current library docs.")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("docs")).toBeInTheDocument();
    expect(screen.getByText("research")).toBeInTheDocument();
    expect(screen.getByText("License")).toBeInTheDocument();
    expect(screen.getByText("MIT")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("~/.claude/skills/find-docs/SKILL.md")).toBeInTheDocument();
    expect(screen.getByText("Choose the phrases that suggest this skill while you type.")).toBeInTheDocument();
    expect(screen.getByText("Other Files in Skill Directory")).toBeInTheDocument();
    expect(screen.getByText("SKILL.md Content")).toBeInTheDocument();
    expect(screen.queryByText("examples/basic.md")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Find Docs" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Other Files in Skill Directory" }));
    expect(screen.getByText("examples/basic.md")).toBeInTheDocument();
    expect(screen.getByText("templates/query.txt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "SKILL.md Content" }));
    expect(screen.getByRole("heading", { name: "Find Docs" })).toBeInTheDocument();
  });

  it("saves edited trigger phrases through the provided callback", async () => {
    const onUpdateTriggerPhrases = vi.fn().mockResolvedValue(undefined);

    render(() => (
      <SkillDetailModal
        open={true}
        onOpenChange={() => {}}
        skill={{
          ...baseSkill,
          scope: "workspace",
          location: "/repo/current/.agents/skills/find-docs/SKILL.md",
          display_location: "/repo/current/.agents/skills/find-docs/SKILL.md",
        }}
        workspaceId="ws_test"
        onUpdateTriggerPhrases={onUpdateTriggerPhrases}
      />
    ));

    fireEvent.click(screen.getByText("Add trigger phrase"));
    fireEvent.input(screen.getByPlaceholderText("Enter trigger phrase..."), {
      target: { value: "reference the docs" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(onUpdateTriggerPhrases).toHaveBeenCalledWith(["docs please", "reference the docs"]);
    });
    expect(screen.getByText("Trigger Phrases")).toBeInTheDocument();
  });
});
