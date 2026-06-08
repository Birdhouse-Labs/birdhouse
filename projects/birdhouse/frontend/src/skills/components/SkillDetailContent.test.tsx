// ABOUTME: Tests the shared skill detail content used by the library detail pane.
// ABOUTME: Verifies the detail scroll container resets only when the selected skill changes.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillDetail } from "../types/skill-library-types";
import SkillDetailContent from "./SkillDetailContent";

const { fetchFileViewerContentMock } = vi.hoisted(() => ({
  fetchFileViewerContentMock: vi.fn(),
}));

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
  default: (props: {
    open: boolean;
    loading?: boolean;
    error?: string | null;
    file: { name: string; path: string } | null;
  }) => (
    <div data-testid="file-viewer">
      <div>{props.open ? "viewer-open" : "viewer-closed"}</div>
      <div>{props.loading ? "viewer-loading" : "viewer-idle"}</div>
      <div>{props.error ?? "viewer-no-error"}</div>
      <div>{props.file?.name ?? "viewer-no-file"}</div>
      <div>{props.file?.path ?? "viewer-no-path"}</div>
    </div>
  ),
}));

vi.mock("../../file-viewer/services/file-viewer-api", () => ({
  fetchFileViewerContent: (workspaceId: string, path: string) => fetchFileViewerContentMock(workspaceId, path),
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("SkillDetailContent", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollTo = vi.fn();
    fetchFileViewerContentMock.mockReset();
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

  it("resets the supporting file viewer when switching to a different skill", async () => {
    const skillWithFile: SkillDetail = {
      ...baseSkill,
      files: ["examples/basic.md"],
    };
    const otherSkill: SkillDetail = {
      ...baseSkill,
      id: "release-notes-from-branch",
      title: "release-notes-from-branch",
      files: [],
      location: "/repo/.agents/skills/release-notes/SKILL.md",
      display_location: "/repo/.agents/skills/release-notes/SKILL.md",
    };

    fetchFileViewerContentMock.mockResolvedValueOnce({
      path: "/Users/test/.claude/skills/find-docs/examples/basic.md",
      name: "basic.md",
      content: "# Example",
      language: "markdown",
      isMarkdown: true,
    });

    const Wrapper = () => {
      const [skill, setSkill] = createSignal(skillWithFile);

      return (
        <>
          <button type="button" onClick={() => setSkill(otherSkill)}>
            Select release notes
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

    fireEvent.click(screen.getByRole("button", { name: "examples/basic.md" }));

    await waitFor(() => {
      expect(screen.getByTestId("file-viewer")).toHaveTextContent("viewer-open");
      expect(screen.getByTestId("file-viewer")).toHaveTextContent("basic.md");
    });

    fireEvent.click(screen.getByRole("button", { name: "Select release notes" }));

    await waitFor(() => {
      expect(screen.getByTestId("file-viewer")).toHaveTextContent("viewer-closed");
      expect(screen.getByTestId("file-viewer")).toHaveTextContent("viewer-no-file");
    });
  });

  it("keeps the newest supporting file response when requests resolve out of order", async () => {
    const skillWithFiles: SkillDetail = {
      ...baseSkill,
      files: ["examples/first.md", "examples/second.md"],
    };
    const firstRequest = createDeferred<{
      path: string;
      name: string;
      content: string;
      language: string;
      isMarkdown: boolean;
    }>();
    const secondRequest = createDeferred<{
      path: string;
      name: string;
      content: string;
      language: string;
      isMarkdown: boolean;
    }>();

    fetchFileViewerContentMock.mockReturnValueOnce(firstRequest.promise).mockReturnValueOnce(secondRequest.promise);

    render(() => (
      <SkillDetailContent
        skill={skillWithFiles}
        workspaceId="ws_test"
        onUpdateTriggerPhrases={vi.fn().mockResolvedValue(undefined)}
      />
    ));

    fireEvent.click(screen.getByRole("button", { name: "examples/first.md" }));
    fireEvent.click(screen.getByRole("button", { name: "examples/second.md" }));

    secondRequest.resolve({
      path: "/Users/test/.claude/skills/find-docs/examples/second.md",
      name: "second.md",
      content: "# Second",
      language: "markdown",
      isMarkdown: true,
    });

    await waitFor(() => {
      expect(screen.getByTestId("file-viewer")).toHaveTextContent("viewer-open");
      expect(screen.getByTestId("file-viewer")).toHaveTextContent("second.md");
      expect(screen.getByTestId("file-viewer")).toHaveTextContent("viewer-idle");
    });

    firstRequest.resolve({
      path: "/Users/test/.claude/skills/find-docs/examples/first.md",
      name: "first.md",
      content: "# First",
      language: "markdown",
      isMarkdown: true,
    });

    await Promise.resolve();

    expect(screen.getByTestId("file-viewer")).toHaveTextContent("second.md");
    expect(screen.getByTestId("file-viewer")).not.toHaveTextContent("first.md");
  });
});
