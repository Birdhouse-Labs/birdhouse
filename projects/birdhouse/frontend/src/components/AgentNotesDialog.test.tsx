// ABOUTME: Tests the per-agent notes dialog backed by draft persistence.
// ABOUTME: Covers loading notes and the explicit save action in the scratchpad UI.

import { render, screen, waitFor } from "@solidjs/testing-library";
import { createContext, type JSX, useContext } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as agentNotesApi from "../services/agent-notes-api";
import AgentNotesDialog, { getAgentNotesDialogUiState } from "./AgentNotesDialog";

const DialogContext = createContext<{ onOpenChange?: (open: boolean) => void } | undefined>(undefined);

vi.mock("corvu/dialog", () => ({
  default: Object.assign(
    (props: { open?: boolean; onOpenChange?: (open: boolean) => void; children: JSX.Element }) =>
      props.open === false ? null : (
        <DialogContext.Provider value={props.onOpenChange ? { onOpenChange: props.onOpenChange } : {}}>
          {props.children}
        </DialogContext.Provider>
      ),
    {
      Portal: (props: { children: JSX.Element }) => <>{props.children}</>,
      Overlay: (props: { class?: string; style?: JSX.CSSProperties }) => (
        <div class={props.class} style={props.style} />
      ),
      Content: (props: { children: JSX.Element; class?: string; style?: JSX.CSSProperties }) => (
        <div class={props.class} style={props.style}>
          {props.children}
        </div>
      ),
      Label: (props: { children: JSX.Element; class?: string }) => <div class={props.class}>{props.children}</div>,
      Close: (props: { children: JSX.Element; class?: string }) => {
        const context = useContext(DialogContext);
        return (
          <button type="button" class={props.class} onClick={() => context?.onOpenChange?.(false)}>
            {props.children}
          </button>
        );
      },
    },
  ),
}));

vi.mock("../services/agent-notes-api", () => ({
  clearAgentNote: vi.fn(),
  getAgentNote: vi.fn(),
  saveAgentNote: vi.fn(),
}));

describe("AgentNotesDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(agentNotesApi.getAgentNote).mockResolvedValue("");
    vi.mocked(agentNotesApi.saveAgentNote).mockResolvedValue(undefined);
    vi.mocked(agentNotesApi.clearAgentNote).mockResolvedValue(undefined);
  });

  const renderDialog = (onOpenChange = vi.fn()) => {
    const result = render(() => (
      <AgentNotesDialog agentId="agent-123" workspaceId="test-workspace" open={true} onOpenChange={onOpenChange} />
    ));
    return { ...result, onOpenChange };
  };

  it("loads notes when opened", async () => {
    renderDialog();

    await waitFor(() => {
      expect(agentNotesApi.getAgentNote).toHaveBeenCalledWith("test-workspace", "agent-123");
    });
  });

  it("renders a Save & Close action", async () => {
    renderDialog();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save & Close" })).toBeInTheDocument();
    });
  });

  it("starts with editing and saving disabled before the initial load completes", () => {
    vi.mocked(agentNotesApi.getAgentNote).mockReturnValueOnce(new Promise(() => {}));

    renderDialog();

    const textarea = screen.getByRole("textbox");
    const saveButton = screen.getByRole("button", { name: "Save & Close" });

    expect(textarea).toBeDisabled();
    expect(saveButton).toBeDisabled();
  });

  it("reports the load-failure UI state without allowing save", () => {
    expect(getAgentNotesDialogUiState(false, true, "idle")).toEqual({
      errorMessage: "Failed to load notes. Check your connection and try again.",
      isSaveDisabled: true,
      isTextareaDisabled: true,
    });
  });

  it("reports the save-failure UI state after a successful load", () => {
    expect(getAgentNotesDialogUiState(true, false, "error")).toEqual({
      errorMessage: "Save failed. Your changes are still here.",
      isSaveDisabled: false,
      isTextareaDisabled: false,
    });
  });
});
