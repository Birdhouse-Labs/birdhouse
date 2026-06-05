// ABOUTME: Tests the shared skill detail content used by the library detail pane.
// ABOUTME: Verifies the detail scroll container resets only when the selected skill changes.

import { fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillDetail } from "../types/skill-library-types";
import SkillDetailContent from "./SkillDetailContent";

vi.mock("../../components/MarkdownRenderer", () => ({
  default: (props: { content: string }) => <div>{props.content}</div>,
}));

vi.mock("../../components/ui/CodeBlock", () => ({
  CodeBlock: (props: { code: string }) => <pre>{props.code}</pre>,
}));

vi.mock("../../components/ui/IconButton", () => ({
  default: (props: { "aria-label": string; onClick?: () => void }) => (
    <button type="button" aria-label={props["aria-label"]} onClick={props.onClick} />
  ),
}));

vi.mock("../../file-viewer/components/FileViewerDialog", () => ({
  default: () => null,
}));

vi.mock("../../file-viewer/services/file-viewer-api", () => ({
  fetchFileViewerContent: vi.fn(),
}));

vi.mock("../../theme", () => ({
  resolvedCodeTheme: () => "github-dark",
}));

vi.mock("../services/skill-library-api", () => ({
  revealSkillLocation: vi.fn(),
}));

vi.mock("./SkillTagList", () => ({
  default: (props: { tags: string[] }) => <div>{props.tags.join(", ")}</div>,
}));

vi.mock("./TriggerPhraseEditor", () => ({
  default: () => <div>Trigger Phrase Editor</div>,
}));

const baseSkill: SkillDetail = {
  id: "find-docs",
  title: "find-docs",
  description: "Retrieve current library docs.",
  tags: ["docs", "research"],
  metadata: {
    description: "Retrieve current library docs.",
    license: "MIT",
  },
  prompt: "# Find Docs\n\nUse Context7 first.",
  trigger_phrases: ["docs please"],
  metadata_trigger_phrases: [],
  files: [],
  readonly: true,
  scope: "global",
  location: "/Users/test/.claude/skills/find-docs/SKILL.md",
  display_location: "~/.claude/skills/find-docs/SKILL.md",
};

describe("SkillDetailContent", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  it("resets the detail scroll position when switching to a different skill", async () => {
    const otherSkill: SkillDetail = {
      ...baseSkill,
      id: "release-notes-from-branch",
      title: "release-notes-from-branch",
      description: "Generate release notes from git history.",
      metadata: {
        description: "Generate release notes from git history.",
        license: "Apache-2.0",
      },
      prompt: "# Release Notes\n\nSummarize the branch.",
      trigger_phrases: ["generate release notes"],
      location: "/repo/.agents/skills/release-notes/SKILL.md",
      display_location: "/repo/.agents/skills/release-notes/SKILL.md",
    };

    const Wrapper = () => {
      const [skill, setSkill] = createSignal(baseSkill);

      return (
        <>
          <button type="button" onClick={() => setSkill(otherSkill)}>
            Select release notes
          </button>
          <button type="button" onClick={() => setSkill({ ...baseSkill })}>
            Refetch same skill
          </button>
          <SkillDetailContent
            skill={skill()}
            workspaceId="ws_test"
            onUpdateTriggerPhrases={vi.fn().mockResolvedValue(undefined)}
          />
        </>
      );
    };

    render(() => <Wrapper />);

    const scrollToMock = vi.mocked(HTMLElement.prototype.scrollTo);

    fireEvent.click(screen.getByRole("button", { name: "Refetch same skill" }));
    expect(scrollToMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Select release notes" }));
    expect(scrollToMock).toHaveBeenCalledWith({ top: 0 });
  });
});
