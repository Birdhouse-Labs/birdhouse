// ABOUTME: Tests skill library dialog state persistence across close and reopen cycles.
// ABOUTME: Verifies stored search, filter, and selection state is restored on open.

import { render, screen, waitFor } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SkillLibraryDialog from "./SkillLibraryDialog";

const { setSearchParamsMock, fetchSkillLibraryMock } = vi.hoisted(() => ({
  setSearchParamsMock: vi.fn(),
  fetchSkillLibraryMock: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({
  useSearchParams: () => [{}, setSearchParamsMock],
}));

vi.mock("../../lib/routing", () => ({
  serializeModalStack: (modals: Array<{ type: string; id: string }>) =>
    modals.length === 0 ? undefined : modals.map((modal) => `${modal.type}/${modal.id}`).join(","),
  useModalRoute: () => ({
    closeModal: vi.fn(),
    modalStack: () => [{ type: "skill-library-v2", id: "main" }],
  }),
}));

vi.mock("../../theme/createMediaQuery", () => ({
  createMediaQuery: () => () => true,
}));

vi.mock("../services/skill-library-api", () => ({
  fetchSkillLibrary: fetchSkillLibraryMock,
  fetchSkill: vi.fn(),
  updateTriggerPhrases: vi.fn(),
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
    fetchSkillLibraryMock.mockReset();
    sessionStorage.clear();
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
});
