// ABOUTME: Tests the agent header scratchpad entry point for agent notes.
// ABOUTME: Verifies the notes button renders in the agent header.

import { render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../types/messages";
import AgentHeader from "./AgentHeader";

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

vi.mock("../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "test-workspace" }),
  WorkspaceProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock("../contexts/StreamingContext", () => ({
  StreamingProvider: ({ children }: { children: unknown }) => children,
  useStreaming: () => ({
    subscribeToSessionStatus: () => () => {},
    subscribeToConnectionEstablished: () => () => {},
    subscribeToAgentUpdated: () => () => {},
  }),
}));

vi.mock("../services/agent-notes-api", () => ({
  clearAgentNote: vi.fn(),
  getAgentNote: vi.fn().mockResolvedValue(""),
  saveAgentNote: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/agents-api", () => ({
  archiveAgent: vi.fn(),
  unarchiveAgent: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({
  useNavigate: () => vi.fn(),
}));

globalThis.fetch = vi.fn() as typeof fetch;

function renderHeader() {
  const props = {
    agentId: "agent-123",
    workspaceId: "test-workspace",
    title: "Test Agent",
    modelName: "claude-sonnet-4",
    messages: [] as Message[],
    mode: "build",
    onModeChange: vi.fn(),
  };

  return render(() => <AgentHeader {...props} />);
}

describe("AgentHeader notes button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: { type: "idle" } }),
    });
  });

  it("renders the notes button", () => {
    renderHeader();

    expect(screen.getByLabelText("Open agent notes")).toBeInTheDocument();
  });
});
