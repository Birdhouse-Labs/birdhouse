// ABOUTME: Tests the AgentTypeahead wrapper around the shared AgentFinder component.
// ABOUTME: Verifies @@ trigger parsing, floating container behavior, and confirm wiring.

import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentTypeahead } from "./AgentTypeahead";

interface MockAgentFinderProps {
  query: string;
  workspaceId: string;
  interactive: boolean;
  currentAgentId?: string;
  confirmLabel?: string;
  onConfirm: (selection: { agentId: string; title: string }) => void;
  onDismiss: () => void;
}

let mockModalStack: Array<{ type: string; id: string }> = [];

vi.mock("../../contexts/ZIndexContext", () => ({
  useZIndex: () => 100,
}));

vi.mock("../../lib/routing", () => ({
  useModalRoute: () => ({
    modalStack: () => mockModalStack,
  }),
}));

vi.mock("solid-floating-ui", () => ({
  useFloating: () => ({
    strategy: "absolute",
    x: 12,
    y: 34,
  }),
}));

vi.mock("../AgentFinder", () => ({
  default: (props: MockAgentFinderProps) => {
    return (
      <div>
        <div data-testid="finder-query">{props.query}</div>
        <div data-testid="finder-workspace">{props.workspaceId}</div>
        <div data-testid="finder-interactive">{String(props.interactive)}</div>
        <div data-testid="finder-current-agent">{props.currentAgentId ?? ""}</div>
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

const renderTypeahead = (props?: Partial<Parameters<typeof AgentTypeahead>[0]>) => {
  const onSelect = vi.fn();
  const onClose = vi.fn();

  render(() => (
    <AgentTypeahead
      referenceElement={undefined}
      inputValue="@@alpha"
      cursorPosition={7}
      visible={true}
      workspaceId="ws_test"
      currentAgentId="agent-current"
      onSelect={onSelect}
      onClose={onClose}
      {...props}
    />
  ));

  return { onSelect, onClose };
};

describe("AgentTypeahead", () => {
  beforeEach(() => {
    mockModalStack = [];
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders a floating AgentFinder for a valid @@ trigger", () => {
    renderTypeahead();

    expect(screen.getByTestId("finder-query")).toHaveTextContent("alpha");
    expect(screen.getByTestId("finder-workspace")).toHaveTextContent("ws_test");
    expect(screen.getByTestId("finder-current-agent")).toHaveTextContent("agent-current");
    expect(screen.getByTestId("finder-label")).toHaveTextContent("insert");

    const container = screen.getByTestId("finder-query").parentElement?.parentElement;
    expect(container).toHaveStyle({ position: "absolute", top: "34px", left: "12px", "z-index": "100" });
  });

  it("confirm maps the selected agent back to @@ replacement metadata", () => {
    const { onSelect } = renderTypeahead();

    fireEvent.click(screen.getByText("Confirm finder result"));

    expect(onSelect).toHaveBeenCalledWith({ id: "agent-123", title: "Alpha Agent" }, "alpha", 0);
  });

  it("dismiss delegates to onClose", () => {
    const { onClose } = renderTypeahead();

    fireEvent.click(screen.getByText("Dismiss finder"));

    expect(onClose).toHaveBeenCalled();
  });

  it("does not render when not visible", () => {
    renderTypeahead({ visible: false });

    expect(screen.queryByTestId("finder-query")).not.toBeInTheDocument();
  });

  it("does not render for the @@@ model trigger", () => {
    renderTypeahead({ inputValue: "@@@claude", cursorPosition: 9 });

    expect(screen.queryByTestId("finder-query")).not.toBeInTheDocument();
  });

  it("uses the nearest active @@ trigger before the cursor", () => {
    renderTypeahead({ inputValue: "first @@alpha and @@beta", cursorPosition: 24 });

    expect(screen.getByTestId("finder-query")).toHaveTextContent("beta");
  });

  it("disables AgentFinder interaction while a modal sits on top", () => {
    mockModalStack = [{ type: "agent", id: "agent-123" }];
    renderTypeahead();

    expect(screen.getByTestId("finder-interactive")).toHaveTextContent("false");
  });

  it("keeps AgentFinder interactive for the top-most agent modal composer", () => {
    mockModalStack = [{ type: "agent", id: "agent-123" }];
    renderTypeahead({ insideAgentModal: true });

    expect(screen.getByTestId("finder-interactive")).toHaveTextContent("true");
  });
});
