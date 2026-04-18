// ABOUTME: Tests command palette agent subdialogs against stacked agent modal z-index contexts.
// ABOUTME: Verifies agent-scoped palette dialogs render above the current agent modal stack.

import { fireEvent, render, screen } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setIsCommandPaletteOpen } from "../lib/command-palette-state";
import CommandPalette from "./CommandPalette";

const fetchAgentMock = vi.fn();

vi.mock("../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "ws_test" }),
}));

vi.mock("../lib/routing", () => ({
  useWorkspaceAgentId: () => () => "route-agent",
  useModalRoute: () => ({
    modalStack: () => [
      { type: "agent", id: "agent-1" },
      { type: "agent", id: "agent-2" },
      { type: "agent", id: "agent-3" },
    ],
    openModal: vi.fn(),
  }),
}));

vi.mock("../services/messages-api", () => ({
  fetchAgent: (...args: unknown[]) => fetchAgentMock(...args),
}));

vi.mock("./ui", () => ({
  Button: (props: { children: JSX.Element; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" disabled={props.disabled} onClick={props.onClick}>
      {props.children}
    </button>
  ),
}));

vi.mock("corvu/dialog", () => {
  const Dialog = (props: { children: JSX.Element; open?: boolean }) => <>{props.open ? props.children : null}</>;
  Dialog.Portal = (props: { children: JSX.Element }) => <>{props.children}</>;
  Dialog.Overlay = () => null;
  Dialog.Content = (props: { children: JSX.Element; class?: string; style?: Record<string, string | number> }) => (
    <div class={props.class} style={props.style}>
      {props.children}
    </div>
  );
  Dialog.Label = (props: { children: JSX.Element; class?: string }) => <div class={props.class}>{props.children}</div>;
  Dialog.Description = (props: { children: JSX.Element; class?: string }) => (
    <div class={props.class}>{props.children}</div>
  );
  return { default: Dialog };
});

vi.mock("./EditAgentDialog", () => ({
  default: () => null,
}));

vi.mock("./ArchiveAgentDialog", () => ({
  default: () => null,
}));

vi.mock("./UnarchiveAgentDialog", () => ({
  default: () => null,
}));

vi.mock("./AgentNotesDialog", async () => {
  const { useZIndex } = await import("../contexts/ZIndexContext");

  return {
    default: (props: { agentId: string; open: boolean }) => {
      const baseZIndex = useZIndex();

      return (
        <div
          data-testid="agent-notes-dialog"
          data-agent-id={props.agentId}
          data-open={props.open ? "true" : "false"}
          data-z-index={String(baseZIndex)}
        />
      );
    },
  };
});

describe("CommandPalette stacked agent dialogs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setIsCommandPaletteOpen(false);
    fetchAgentMock.mockResolvedValue({ id: "agent-3", title: "Top Agent", archived_at: null });
  });

  afterEach(() => {
    setIsCommandPaletteOpen(false);
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("opens the notes dialog above the stacked agent modals", async () => {
    setIsCommandPaletteOpen(true);
    render(() => <CommandPalette />);

    expect(screen.getByTestId("agent-notes-dialog")).toHaveAttribute("data-agent-id", "agent-3");
    expect(screen.getByTestId("agent-notes-dialog")).toHaveAttribute("data-open", "false");
    expect(screen.getByTestId("agent-notes-dialog")).toHaveAttribute("data-z-index", "90");

    const editNotesAction = screen.getByRole("button", { name: "Edit Notes" });
    fireEvent.click(editNotesAction);
    await vi.runAllTimersAsync();

    expect(screen.getByTestId("agent-notes-dialog")).toHaveAttribute("data-open", "true");
  });
});
