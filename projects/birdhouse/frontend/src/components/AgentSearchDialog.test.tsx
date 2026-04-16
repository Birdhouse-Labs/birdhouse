// ABOUTME: Tests the AgentSearchDialog wrapper around the shared AgentFinder component.
// ABOUTME: Verifies modal shell behavior, query wiring, and confirm-driven navigation.

import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal, type JSX } from "solid-js";
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

const modalRouteState = vi.hoisted(() => {
  return {
    modalStack: undefined as unknown as () => Array<{ type: string; id: string }>,
    setModalStack: undefined as unknown as (value: Array<{ type: string; id: string }>) => void,
  };
});

const [mockModalStack, setMockModalStack] = createSignal([{ type: "agent-search", id: "main" }]);
modalRouteState.modalStack = mockModalStack;
modalRouteState.setModalStack = setMockModalStack;

const mockNavigate = vi.fn();
const mockRemoveModalByType = vi.fn();
let dialogOnOpenChange: ((open: boolean) => void) | undefined;
let dialogCloseOnEscapeKeyDown: boolean | undefined;

vi.mock("../lib/routing", () => ({
  useModalRoute: () => ({
    modalStack: modalRouteState.modalStack,
    removeModalByType: mockRemoveModalByType,
  }),
  useWorkspaceId: () => () => "test-workspace",
}));

vi.mock("@solidjs/router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("./AgentFinder", () => ({
  default: (props: MockAgentFinderProps) => {
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
  const Dialog = (props: {
    children: JSX.Element;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    closeOnEscapeKeyDown?: boolean;
  }) => {
    dialogOnOpenChange = props.onOpenChange;
    dialogCloseOnEscapeKeyDown = props.closeOnEscapeKeyDown;
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
  modalRouteState.setModalStack(open ? [{ type: "agent-search", id: "main" }] : []);
  return render(() => <AgentSearchDialog />);
};

describe("AgentSearchDialog", () => {
  beforeEach(() => {
    modalRouteState.setModalStack([{ type: "agent-search", id: "main" }]);
    mockNavigate.mockReset();
    mockRemoveModalByType.mockReset();
    dialogOnOpenChange = undefined;
    dialogCloseOnEscapeKeyDown = undefined;
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

  it("preserves and reselects the query when the dialog is reopened", async () => {
    renderDialog();

    const input = screen.getByLabelText("Search agent messages") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "alpha" } });

    modalRouteState.setModalStack([]);

    await waitFor(() => {
      expect(screen.queryByLabelText("Search agent messages")).not.toBeInTheDocument();
    });

    modalRouteState.setModalStack([{ type: "agent-search", id: "main" }]);

    await waitFor(() => {
      const reopenedInput = screen.getByLabelText("Search agent messages") as HTMLInputElement;
      expect(reopenedInput.value).toBe("alpha");
      expect(document.activeElement).toBe(reopenedInput);
      expect(reopenedInput.selectionStart).toBe(0);
      expect(reopenedInput.selectionEnd).toBe(5);
    });
  });

  it("configures AgentFinder with the dialog confirm label", () => {
    renderDialog();

    expect(screen.getByTestId("finder-label")).toHaveTextContent("open");
  });

  it("marks the finder interactive only while the search dialog is top-most", () => {
    renderDialog();
    expect(screen.getByTestId("finder-interactive")).toHaveTextContent("true");

    cleanup();

    modalRouteState.setModalStack([
      { type: "agent-search", id: "main" },
      { type: "agent", id: "agent-123" },
    ]);
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

    modalRouteState.setModalStack([
      { type: "agent-search", id: "main" },
      { type: "agent", id: "agent-123" },
    ]);
    render(() => <AgentSearchDialog />);
    dialogOnOpenChange?.(false);

    expect(mockRemoveModalByType).not.toHaveBeenCalled();
  });

  it("only enables Escape dismissal when the search dialog is top-most", () => {
    renderDialog();
    expect(dialogCloseOnEscapeKeyDown).toBe(true);

    cleanup();

    modalRouteState.setModalStack([
      { type: "agent-search", id: "main" },
      { type: "agent", id: "agent-123" },
    ]);
    render(() => <AgentSearchDialog />);

    expect(dialogCloseOnEscapeKeyDown).toBe(false);
  });
});
