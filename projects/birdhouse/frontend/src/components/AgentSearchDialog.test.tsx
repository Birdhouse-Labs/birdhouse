// ABOUTME: Tests the AgentSearchDialog wrapper around the shared AgentFinder component.
// ABOUTME: Verifies modal shell behavior, query wiring, and confirm-driven navigation.

import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AgentSearchDialog from "./AgentSearchDialog";

interface MockAgentFinderProps {
  query: string;
  interactive: boolean;
  confirmLabel?: string;
  onConfirm: (selection: { agentId: string; title: string }) => void;
  onDismiss: () => void;
}

vi.mock("../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "test-workspace" }),
}));

let mockModalStack = [{ type: "agent-search", id: "main" }];
const mockNavigate = vi.fn();
const mockRemoveModalByType = vi.fn();
let dialogOnOpenChange: ((open: boolean) => void) | undefined;
let lastFinderProps: MockAgentFinderProps | undefined;

vi.mock("../lib/routing", () => ({
  useModalRoute: () => ({
    modalStack: () => mockModalStack,
    removeModalByType: mockRemoveModalByType,
  }),
  useWorkspaceId: () => () => "test-workspace",
}));

vi.mock("@solidjs/router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("./AgentFinder", () => ({
  default: (props: MockAgentFinderProps) => {
    lastFinderProps = props;

    return (
      <div>
        <div data-testid="finder-query">{props.query}</div>
        <div data-testid="finder-interactive">{String(props.interactive)}</div>
        <div data-testid="finder-label">{props.confirmLabel ?? ""}</div>
        <button type="button" onClick={() => props.onConfirm({ agentId: "agent-123", title: "Alpha Agent" })}>
          Confirm finder result
        </button>
        <button type="button" onClick={props.onDismiss}>
          Dismiss finder
        </button>
      </div>
    );
  },
}));

vi.mock("corvu/dialog", () => {
  const Dialog = (props: { children: JSX.Element; open?: boolean; onOpenChange?: (open: boolean) => void }) => {
    dialogOnOpenChange = props.onOpenChange;
    return <>{props.open ? props.children : null}</>;
  };
  Dialog.Portal = (props: { children: JSX.Element }) => <>{props.children}</>;
  Dialog.Overlay = () => null;
  Dialog.Content = (props: { children: JSX.Element; class?: string }) => (
    <div role="presentation" class={props.class}>
      {props.children}
    </div>
  );
  return { default: Dialog };
});

const renderDialog = (open = true) => {
  mockModalStack = open ? [{ type: "agent-search", id: "main" }] : [];
  render(() => <AgentSearchDialog />);
};

describe("AgentSearchDialog", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRemoveModalByType.mockReset();
    dialogOnOpenChange = undefined;
    lastFinderProps = undefined;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the search input when open", () => {
    renderDialog();
    expect(screen.getByLabelText("Search agent messages")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    renderDialog(false);
    expect(screen.queryByLabelText("Search agent messages")).not.toBeInTheDocument();
  });

  it("passes the local query signal through to AgentFinder", () => {
    renderDialog();

    const input = screen.getByLabelText("Search agent messages");
    fireEvent.input(input, { target: { value: "alpha" } });

    expect(screen.getByTestId("finder-query")).toHaveTextContent("alpha");
  });

  it("configures AgentFinder with the dialog confirm label", () => {
    renderDialog();

    expect(screen.getByTestId("finder-label")).toHaveTextContent("open");
  });

  it("marks the finder interactive only while the search dialog is top-most", () => {
    renderDialog();
    expect(screen.getByTestId("finder-interactive")).toHaveTextContent("true");

    cleanup();

    mockModalStack = [
      { type: "agent-search", id: "main" },
      { type: "agent", id: "agent-123" },
    ];
    render(() => <AgentSearchDialog />);

    expect(screen.getByTestId("finder-interactive")).toHaveTextContent("false");
  });

  it("confirm navigates to the agent and closes the dialog", async () => {
    renderDialog();

    fireEvent.click(screen.getByText("Confirm finder result"));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/workspace/test-workspace/agent/agent-123");
      expect(mockRemoveModalByType).toHaveBeenCalledWith("agent-search");
    });
  });

  it("dismiss from AgentFinder closes the dialog", () => {
    renderDialog();

    fireEvent.click(screen.getByText("Dismiss finder"));

    expect(mockRemoveModalByType).toHaveBeenCalledWith("agent-search");
  });

  it("close button closes the dialog", () => {
    renderDialog();

    fireEvent.click(screen.getByLabelText("Close search"));

    expect(mockRemoveModalByType).toHaveBeenCalledWith("agent-search");
  });

  it("Dialog onOpenChange closes only when the search dialog is top-most", () => {
    renderDialog();
    dialogOnOpenChange?.(false);

    expect(mockRemoveModalByType).toHaveBeenCalledWith("agent-search");

    cleanup();
    mockRemoveModalByType.mockReset();

    mockModalStack = [
      { type: "agent-search", id: "main" },
      { type: "agent", id: "agent-123" },
    ];
    render(() => <AgentSearchDialog />);
    dialogOnOpenChange?.(false);

    expect(mockRemoveModalByType).not.toHaveBeenCalled();
  });
});
