// ABOUTME: Tests the AgentTypeahead wrapper around the shared AgentFinder component.
// ABOUTME: Verifies @@ trigger parsing, Corvu popover wiring, and confirm behavior.

import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal, type JSX, Show } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentTypeahead } from "./AgentTypeahead";

interface MockAgentFinderProps {
  query: string;
  workspaceId: string;
  interactive: boolean;
  currentAgentId?: string;
  confirmLabel?: string;
  setOpenPopoverIndex?: ((value: number | null | ((current: number | null) => number | null)) => void) | undefined;
  onConfirm: (selection: { agentId: string; title: string }) => void;
  onDismiss: () => void;
}

const modalRouteState = vi.hoisted(() => ({
  modalStack: undefined as unknown as () => Array<{ type: string; id: string }>,
  setModalStack: undefined as unknown as (value: Array<{ type: string; id: string }>) => void,
}));

const popoverMockState = vi.hoisted(() => ({
  open: undefined as boolean | undefined,
  modal: undefined as boolean | undefined,
  trapFocus: undefined as boolean | undefined,
  closeOnOutsidePointer: undefined as boolean | undefined,
  strategy: undefined as string | undefined,
  floatingOptions: undefined as unknown,
  onOpenChange: undefined as ((open: boolean) => void) | undefined,
}));

const [mockModalStack, setMockModalStack] = createSignal<Array<{ type: string; id: string }>>([]);
modalRouteState.modalStack = mockModalStack;
modalRouteState.setModalStack = setMockModalStack;

vi.mock("../../contexts/ZIndexContext", () => ({
  useZIndex: () => 100,
}));

vi.mock("../../lib/routing", () => ({
  useModalRoute: () => ({
    modalStack: modalRouteState.modalStack,
  }),
}));

vi.mock("corvu/popover", () => {
  const Popover = (props: {
    children: JSX.Element;
    open?: boolean;
    modal?: boolean;
    trapFocus?: boolean;
    closeOnOutsidePointer?: boolean;
    strategy?: string;
    floatingOptions?: unknown;
    onOpenChange?: (open: boolean) => void;
  }) => {
    popoverMockState.open = props.open;
    popoverMockState.modal = props.modal;
    popoverMockState.trapFocus = props.trapFocus;
    popoverMockState.closeOnOutsidePointer = props.closeOnOutsidePointer;
    popoverMockState.strategy = props.strategy;
    popoverMockState.floatingOptions = props.floatingOptions;
    popoverMockState.onOpenChange = props.onOpenChange;
    return <>{props.children}</>;
  };

  Popover.Anchor = (props: { children: JSX.Element; class?: string }) => (
    <div data-testid="popover-anchor" class={props.class}>
      {props.children}
    </div>
  );
  Popover.Portal = (props: { children: JSX.Element }) => <>{props.children}</>;
  Popover.Content = (props: { children: JSX.Element; class?: string; style?: JSX.CSSProperties }) => (
    <Show when={popoverMockState.open}>
      <div data-testid="popover-content" class={props.class} style={props.style}>
        {props.children}
      </div>
    </Show>
  );

  return { default: Popover };
});

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
        <button type="button" onClick={() => props.setOpenPopoverIndex?.(0)}>
          Open matches popover
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
      inputValue="@@alpha"
      cursorPosition={7}
      visible={true}
      workspaceId="ws_test"
      currentAgentId="agent-current"
      onSelect={onSelect}
      onClose={onClose}
      {...props}
    >
      <textarea aria-label="Composer" />
    </AgentTypeahead>
  ));

  return { onSelect, onClose };
};

describe("AgentTypeahead", () => {
  beforeEach(() => {
    modalRouteState.setModalStack([]);
  });

  afterEach(() => {
    cleanup();
    popoverMockState.open = undefined;
    popoverMockState.modal = undefined;
    popoverMockState.trapFocus = undefined;
    popoverMockState.closeOnOutsidePointer = undefined;
    popoverMockState.strategy = undefined;
    popoverMockState.floatingOptions = undefined;
    popoverMockState.onOpenChange = undefined;
    vi.clearAllMocks();
  });

  it("renders a controlled popover for a valid @@ trigger", () => {
    renderTypeahead();

    expect(screen.getByTestId("finder-query")).toHaveTextContent("alpha");
    expect(screen.getByTestId("finder-workspace")).toHaveTextContent("ws_test");
    expect(screen.getByTestId("finder-current-agent")).toHaveTextContent("agent-current");
    expect(screen.getByTestId("finder-label")).toHaveTextContent("insert");
    expect(screen.getByLabelText("Composer")).toBeInTheDocument();
    expect(popoverMockState.open).toBe(true);
    expect(popoverMockState.modal).toBe(false);
    expect(popoverMockState.trapFocus).toBe(false);
    expect(popoverMockState.closeOnOutsidePointer).toBe(false);
    expect(popoverMockState.strategy).toBe("fixed");
  });

  it("confirm maps the selected agent back to @@ replacement metadata", () => {
    const { onSelect } = renderTypeahead();

    fireEvent.click(screen.getByText("Confirm finder result"));

    expect(onSelect).toHaveBeenCalledWith({ id: "agent-123", title: "Alpha Agent" }, "alpha", 0);
  });

  it("popover dismissal delegates to onClose", () => {
    const { onClose } = renderTypeahead();

    popoverMockState.onOpenChange?.(false);

    expect(onClose).toHaveBeenCalled();
  });

  it("does not render when not visible", () => {
    renderTypeahead({ visible: false });

    expect(screen.queryByTestId("finder-query")).not.toBeInTheDocument();
    expect(popoverMockState.open).toBe(false);
  });

  it("does not render for the @@@ model trigger", () => {
    renderTypeahead({ inputValue: "@@@claude", cursorPosition: 9 });

    expect(screen.queryByTestId("finder-query")).not.toBeInTheDocument();
    expect(popoverMockState.open).toBe(false);
  });

  it("uses the nearest active @@ trigger before the cursor", () => {
    renderTypeahead({ inputValue: "first @@alpha and @@beta", cursorPosition: 24 });

    expect(screen.getByTestId("finder-query")).toHaveTextContent("beta");
  });

  it("disables AgentFinder interaction while a modal sits on top", () => {
    modalRouteState.setModalStack([{ type: "agent", id: "agent-123" }]);
    renderTypeahead();

    expect(screen.getByTestId("finder-interactive")).toHaveTextContent("false");
  });

  it("keeps AgentFinder interactive for the top-most agent modal composer", () => {
    modalRouteState.setModalStack([{ type: "agent", id: "agent-123" }]);
    renderTypeahead({ insideAgentModal: true });

    expect(screen.getByTestId("finder-interactive")).toHaveTextContent("true");
  });

  it("disables AgentFinder interaction when a peeked agent modal opens above its owning modal", () => {
    modalRouteState.setModalStack([{ type: "agent", id: "agent-123" }]);
    renderTypeahead({ insideAgentModal: true });

    expect(screen.getByTestId("finder-interactive")).toHaveTextContent("true");

    modalRouteState.setModalStack([
      { type: "agent", id: "agent-123" },
      { type: "agent", id: "agent-456" },
    ]);

    expect(screen.getByTestId("finder-interactive")).toHaveTextContent("false");
  });
});
