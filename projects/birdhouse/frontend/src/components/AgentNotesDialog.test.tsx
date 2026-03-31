// ABOUTME: Tests the per-agent notes dialog backed by draft persistence.
// ABOUTME: Covers loading notes and the explicit save action in the scratchpad UI.

import { render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as agentNotesApi from "../services/agent-notes-api";
import AgentNotesDialog from "./AgentNotesDialog";

vi.mock("corvu/dialog", () => {
  const Dialog = (props: { open: boolean; children: unknown }) => (props.open ? props.children : null);
  Dialog.Portal = (props: { children: unknown }) => props.children;
  Dialog.Overlay = (props: Record<string, unknown>) => <div {...props} />;
  Dialog.Content = (props: Record<string, unknown>) => <div {...props}>{props["children"] as string}</div>;
  Dialog.Label = (props: Record<string, unknown>) => <div {...props}>{props["children"] as string}</div>;
  Dialog.Close = (props: Record<string, unknown>) => (
    <button type="button" {...props}>
      {props["children"] as string}
    </button>
  );
  return { default: Dialog };
});

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
});
