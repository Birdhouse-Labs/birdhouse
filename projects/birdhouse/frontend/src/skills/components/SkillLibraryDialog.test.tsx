// ABOUTME: Tests skill library dialog state persistence across close and reopen cycles.
// ABOUTME: Verifies stored search, filter, and selection state is restored on open.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SkillLibraryDialog from "./SkillLibraryDialog";

const {
  setSearchParamsMock,
  modalStackMock,
  replaceModalMock,
  fetchSkillLibraryMock,
  fetchSkillMock,
  reloadSkillsMock,
  updateTriggerPhrasesMock,
} = vi.hoisted(() => ({
  setSearchParamsMock: vi.fn(),
  modalStackMock: vi.fn(),
  replaceModalMock: vi.fn(),
  fetchSkillLibraryMock: vi.fn(),
  fetchSkillMock: vi.fn(),
  reloadSkillsMock: vi.fn(),
  updateTriggerPhrasesMock: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({
  useSearchParams: () => [{}, setSearchParamsMock],
}));

vi.mock("../../lib/routing", () => ({
  serializeModalStack: (modals: Array<{ type: string; id: string }>) =>
    modals.length === 0 ? undefined : modals.map((modal) => `${modal.type}/${modal.id}`).join(","),
  useModalRoute: () => ({
    closeModal: vi.fn(),
    modalStack: modalStackMock,
    replaceModal: (type: string, id: string) => {
      replaceModalMock(type, id);
      const stack = modalStackMock();
      const nextStack = stack.map((modal: { type: string; id: string }) =>
        modal.type === type ? { type, id } : modal,
      );
      const serialized =
        nextStack.length === 0
          ? undefined
          : nextStack.map((m: { type: string; id: string }) => `${m.type}/${m.id}`).join(",");
      setSearchParamsMock({ modals: serialized });
    },
  }),
}));

vi.mock("../../theme/createMediaQuery", () => ({
  createMediaQuery: () => () => true,
}));

vi.mock("../services/skill-library-api", () => ({
  fetchSkillLibrary: fetchSkillLibraryMock,
  fetchSkill: fetchSkillMock,
  reloadSkills: reloadSkillsMock,
  updateTriggerPhrases: updateTriggerPhrasesMock,
}));

vi.mock("corvu/dialog", () => {
  const Dialog = (props: { children: JSX.Element }) => <>{props.children}</>;
  Dialog.Portal = (props: { children: JSX.Element }) => <>{props.children}</>;
  Dialog.Overlay = () => null;
  Dialog.Content = (props: { children: JSX.Element; class?: string }) => (
    <div class={props.class}>{props.children}</div>
  );
  Dialog.Label = (props: { children: JSX.Element; class?: string }) => <div class={props.class}>{props.children}</div>;
  Dialog.Close = (props: { children: JSX.Element; class?: string }) => (
    <button type="button" class={props.class}>
      {props.children}
    </button>
  );
  return { default: Dialog };
});

vi.mock("corvu/resizable", () => {
  const Resizable = (props: { children: () => JSX.Element; class?: string }) => (
    <div class={props.class}>{props.children()}</div>
  );
  Resizable.Panel = (props: { children: JSX.Element; class?: string }) => (
    <div class={props.class}>{props.children}</div>
  );
  Resizable.Handle = (props: { class?: string; "aria-label"?: string }) => (
    <button type="button" class={props.class} aria-label={props["aria-label"]} />
  );
  return { default: Resizable };
});

vi.mock("../../components/MobileNavDrawer", () => ({
  default: (props: { children: JSX.Element }) => <>{props.children}</>,
}));

describe("SkillLibraryDialog", () => {
  beforeEach(() => {
    setSearchParamsMock.mockReset();
    modalStackMock.mockReset();
    replaceModalMock.mockReset();
    fetchSkillLibraryMock.mockReset();
    fetchSkillMock.mockReset();
    reloadSkillsMock.mockReset();
    updateTriggerPhrasesMock.mockReset();
    sessionStorage.clear();

    modalStackMock.mockReturnValue([{ type: "skill-library-v2", id: "main" }]);
  });

  it("restores persisted search, filter, and selected skill on open", async () => {
    sessionStorage.setItem(
      "birdhouse:skill-library-ui:ws_test",
      JSON.stringify({
        searchQuery: "docs",
        scopeFilter: "global",
        selectedSkillId: "find-docs",
      }),
    );

    fetchSkillLibraryMock.mockResolvedValue({
      skills: [
        {
          id: "find-docs",
          title: "find-docs",
          description: "Docs helper",
          tags: [],
          trigger_phrases: ["find docs"],
          scope: "global",
          readonly: true,
        },
      ],
    });

    render(() => <SkillLibraryDialog workspaceId="ws_test" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search skills")).toHaveValue("docs");
    });

    expect(screen.getByText("Global only")).toBeInTheDocument();

    await waitFor(() => {
      expect(setSearchParamsMock).toHaveBeenCalledWith({ modals: "skill-library-v2/find-docs" });
    });
  });

  it("keeps the list pane mounted while library data refetches after saving trigger phrases", async () => {
    modalStackMock.mockReturnValue([{ type: "skill-library-v2", id: "find-docs" }]);

    let resolveLibraryRefetch: ((value: { skills: Array<Record<string, unknown>> }) => void) | undefined;
    const pendingLibraryRefetch = new Promise<{ skills: Array<Record<string, unknown>> }>((resolve) => {
      resolveLibraryRefetch = resolve;
    });

    fetchSkillLibraryMock
      .mockResolvedValueOnce({
        skills: [
          {
            id: "find-docs",
            title: "find-docs",
            description: "Docs helper",
            tags: [],
            trigger_phrases: ["find docs"],
            scope: "global",
            readonly: true,
          },
        ],
      })
      .mockReturnValueOnce(pendingLibraryRefetch);

    fetchSkillMock
      .mockResolvedValueOnce({
        id: "find-docs",
        title: "find-docs",
        description: "Docs helper",
        tags: [],
        metadata: {},
        prompt: "# Find Docs",
        trigger_phrases: ["find docs"],
        files: [],
        readonly: true,
        scope: "global",
        location: "/tmp/find-docs/SKILL.md",
        display_location: "~/skills/find-docs/SKILL.md",
      })
      .mockResolvedValueOnce({
        id: "find-docs",
        title: "find-docs",
        description: "Docs helper",
        tags: [],
        metadata: {},
        prompt: "# Find Docs",
        trigger_phrases: ["find docs", "fresh docs"],
        files: [],
        readonly: true,
        scope: "global",
        location: "/tmp/find-docs/SKILL.md",
        display_location: "~/skills/find-docs/SKILL.md",
      });

    updateTriggerPhrasesMock.mockResolvedValue({
      name: "find-docs",
      trigger_phrases: ["find docs", "fresh docs"],
    });

    render(() => <SkillLibraryDialog workspaceId="ws_test" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search skills")).toBeInTheDocument();
      expect(screen.getAllByText("find-docs").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText("Add trigger phrase"));
    fireEvent.input(screen.getByPlaceholderText("Enter trigger phrase..."), {
      target: { value: "fresh docs" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(updateTriggerPhrasesMock).toHaveBeenCalledWith("find-docs", "ws_test", {
        trigger_phrases: ["find docs", "fresh docs"],
      });
    });

    expect(screen.getByPlaceholderText("Search skills")).toBeInTheDocument();
    expect(screen.getAllByText("find-docs").length).toBeGreaterThan(0);

    resolveLibraryRefetch?.({
      skills: [
        {
          id: "find-docs",
          title: "find-docs",
          description: "Docs helper",
          tags: [],
          trigger_phrases: ["find docs", "fresh docs"],
          scope: "global",
          readonly: true,
        },
      ],
    });
  });

  it("reloads skills and refetches the current selection", async () => {
    modalStackMock.mockReturnValue([{ type: "skill-library-v2", id: "find-docs" }]);

    fetchSkillLibraryMock
      .mockResolvedValueOnce({
        skills: [
          {
            id: "find-docs",
            title: "find-docs",
            description: "Docs helper",
            tags: [],
            trigger_phrases: ["find docs"],
            scope: "global",
            readonly: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        skills: [
          {
            id: "find-docs",
            title: "find-docs",
            description: "Docs helper",
            tags: [],
            trigger_phrases: ["fresh docs"],
            scope: "global",
            readonly: true,
          },
        ],
      });

    fetchSkillMock
      .mockResolvedValueOnce({
        id: "find-docs",
        title: "find-docs",
        description: "Docs helper",
        tags: [],
        metadata: {},
        prompt: "# Find Docs",
        trigger_phrases: ["find docs"],
        files: [],
        readonly: true,
        scope: "global",
        location: "/tmp/find-docs/SKILL.md",
        display_location: "~/skills/find-docs/SKILL.md",
      })
      .mockResolvedValueOnce({
        id: "find-docs",
        title: "find-docs",
        description: "Docs helper",
        tags: [],
        metadata: {},
        prompt: "# Find Docs",
        trigger_phrases: ["fresh docs"],
        files: [],
        readonly: true,
        scope: "global",
        location: "/tmp/find-docs/SKILL.md",
        display_location: "~/skills/find-docs/SKILL.md",
      });

    reloadSkillsMock.mockResolvedValue(undefined);

    render(() => <SkillLibraryDialog workspaceId="ws_test" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reload Skills" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Reload Skills" }));

    await waitFor(() => {
      expect(reloadSkillsMock).toHaveBeenCalledWith("ws_test");
    });

    await waitFor(() => {
      expect(fetchSkillLibraryMock).toHaveBeenCalledTimes(2);
      expect(fetchSkillMock).toHaveBeenCalledTimes(2);
    });
  });

  it("disables reload while agents are active", async () => {
    fetchSkillLibraryMock.mockResolvedValue({ skills: [] });
    reloadSkillsMock.mockResolvedValue(undefined);

    render(() => <SkillLibraryDialog workspaceId="ws_test" hasActiveAgents />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reload Skills" })).toBeDisabled();
    });
  });
});
