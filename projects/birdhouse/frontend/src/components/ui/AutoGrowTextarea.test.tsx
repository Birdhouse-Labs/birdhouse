// ABOUTME: Tests composer skill suggestion acceptance and markdown link insertion.
// ABOUTME: Verifies accepted skill completions become canonical birdhouse:skill links.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AutoGrowTextarea from "./AutoGrowTextarea";

vi.mock("../../contexts/SkillCacheContext", () => ({
  useSkillCache: () => ({
    skills: () => [
      {
        id: "release-notes-from-branch",
        title: "release-notes-from-branch",
        triggerPhrases: ["generate release notes"],
      },
      {
        id: "find-skills",
        title: "find-skills",
        triggerPhrases: ["search for skills"],
      },
    ],
    loading: () => false,
    error: () => null,
    refetch: async () => {},
    getSkill: () => undefined,
  }),
}));

vi.mock("../../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "ws_test" }),
}));

vi.mock("../../lib/routing", () => ({
  useWorkspaceAgentId: () => () => undefined,
}));

vi.mock("../../services/agents-api", () => ({
  fetchAgentsForTypeahead: async () => [],
}));

vi.mock("../../services/messages-api", () => ({
  fetchModels: async () => [],
}));

describe("AutoGrowTextarea", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.execCommand = vi.fn((command: string, _ui: boolean, value?: string) => {
      if (command !== "insertText") return false;

      const textarea = document.activeElement;
      if (!(textarea instanceof HTMLTextAreaElement) || typeof value !== "string") {
        return false;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextValue = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
      textarea.value = nextValue;
      textarea.setSelectionRange(start + value.length, start + value.length);
      fireEvent.input(textarea, { target: { value: nextValue } });
      return true;
    }) as typeof document.execCommand;
  });

  it("rewrites an accepted skill suggestion into a canonical markdown link", async () => {
    const Wrapper = () => {
      const [value, setValue] = createSignal("");
      return <AutoGrowTextarea value={value()} onInput={setValue} onSend={() => {}} />;
    };

    render(() => <Wrapper />);

    const textarea = screen.getByRole("textbox");
    fireEvent.input(textarea, { target: { value: "generate rele" } });

    await waitFor(() => {
      expect(screen.getByText("release-notes-from-branch")).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "Enter" });

    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe(
        "[generate release notes](birdhouse:skill/release-notes-from-branch)",
      );
    });
  });

  it("preserves the user typed capitalization when completing a trigger phrase", async () => {
    const Wrapper = () => {
      const [value, setValue] = createSignal("");
      return <AutoGrowTextarea value={value()} onInput={setValue} onSend={() => {}} />;
    };

    render(() => <Wrapper />);

    const textarea = screen.getByRole("textbox");
    fireEvent.input(textarea, { target: { value: "Search" } });

    await waitFor(() => {
      expect(screen.getByText("find-skills")).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "Enter" });

    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe("[Search for skills](birdhouse:skill/find-skills)");
    });
  });
});
