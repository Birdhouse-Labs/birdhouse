// ABOUTME: Tests the skill detail dialog shown from the reused library shell.
// ABOUTME: Verifies scope copy, XML preview, and trigger phrase editing callbacks.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import SkillDetailModal from "./SkillDetailModal";

const { fetchFileViewerContentMock } = vi.hoisted(() => ({
  fetchFileViewerContentMock: vi.fn(),
}));

vi.mock("../../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "ws_test" }),
}));

vi.mock("../../contexts/ZIndexContext", () => ({
  useZIndex: () => 100,
}));

vi.mock("../../file-viewer/services/file-viewer-api", () => ({
  fetchFileViewerContent: (workspaceId: string, path: string) => fetchFileViewerContentMock(workspaceId, path),
}));

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
    metadata_trigger_phrases: [],
    readonly: true,
    scope: "global" as const,
    location: "/Users/test/.claude/skills/find-docs/SKILL.md",
    display_location: "~/.claude/skills/find-docs/SKILL.md",
    files: ["examples/basic.md", "templates/query.txt"],
  };

  it("renders supporting files as interactive controls by default", async () => {
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
    expect(screen.getByText("Supporting Files")).toBeInTheDocument();
    expect(screen.getByText("SKILL.md Content")).toBeInTheDocument();
    expect(screen.getByText("Additional files found alongside SKILL.md.")).toBeInTheDocument();

    const fileList = screen.getByRole("list");
    const fileButtons = screen.getAllByRole("button", { name: /examples\/basic\.md|templates\/query\.txt/ });

    expect(fileList).toBeInTheDocument();
    expect(fileButtons).toHaveLength(2);
    expect(screen.getByText("examples/basic.md")).toBeInTheDocument();
    expect(screen.getByText("templates/query.txt")).toBeInTheDocument();
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

  it("opens the generic file viewer when a supporting file is clicked", async () => {
    fetchFileViewerContentMock.mockResolvedValueOnce({
      path: "/Users/test/.claude/skills/find-docs/examples/basic.md",
      name: "basic.md",
      content: "# Example\n\nSkill example content.",
      language: "markdown",
      isMarkdown: true,
    });

    render(() => (
      <SkillDetailModal
        open={true}
        onOpenChange={() => {}}
        skill={baseSkill}
        workspaceId="ws_test"
        onUpdateTriggerPhrases={vi.fn().mockResolvedValue(undefined)}
      />
    ));

    fireEvent.click(screen.getByRole("button", { name: "examples/basic.md" }));

    await waitFor(() => {
      expect(fetchFileViewerContentMock).toHaveBeenCalledWith(
        "ws_test",
        "/Users/test/.claude/skills/find-docs/examples/basic.md",
      );
    });

    expect(screen.getByRole("dialog", { name: "basic.md" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rich" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Example" })).toBeInTheDocument();
  });
});
