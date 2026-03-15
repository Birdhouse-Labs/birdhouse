// ABOUTME: Tests the skill detail dialog shown from the reused library shell.
// ABOUTME: Verifies scope copy, XML preview, and trigger phrase editing callbacks.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import PatternDetailModal from "./PatternDetailModal";

describe("PatternDetailModal", () => {
  const basePattern = {
    id: "find-docs",
    group_id: "global",
    title: "find-docs",
    description: "Retrieve current library docs.",
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

  it("renders shared trigger phrase scope and skill-based XML preview", () => {
    render(() => (
      <PatternDetailModal
        open={true}
        onOpenChange={() => {}}
        pattern={basePattern}
        workspaceId="ws_test"
        onUpdateTriggerPhrases={vi.fn().mockResolvedValue(undefined)}
      />
    ));

    expect(screen.getByText("Shared trigger phrases")).toBeInTheDocument();
    expect(screen.getByText("Metadata")).toBeInTheDocument();
    expect(screen.getByText("description")).toBeInTheDocument();
    expect(screen.getByText("Retrieve current library docs.")).toBeInTheDocument();
    expect(screen.getByText("license")).toBeInTheDocument();
    expect(screen.getByText("MIT")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("~/.claude/skills/find-docs/SKILL.md")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Applies across all workspaces because this skill resolves outside the current workspace directory.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('<skill name="find-docs">')).toBeInTheDocument();
    expect(screen.getByText("Other Files in Skill Directory")).toBeInTheDocument();
    expect(screen.getByText("examples/basic.md")).toBeInTheDocument();
    expect(screen.getByText("templates/query.txt")).toBeInTheDocument();
  });

  it("saves edited trigger phrases through the provided callback", async () => {
    const onUpdateTriggerPhrases = vi.fn().mockResolvedValue(undefined);

    render(() => (
      <PatternDetailModal
        open={true}
        onOpenChange={() => {}}
        pattern={{
          ...basePattern,
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
    expect(screen.getByText("Workspace trigger phrases")).toBeInTheDocument();
  });
});
