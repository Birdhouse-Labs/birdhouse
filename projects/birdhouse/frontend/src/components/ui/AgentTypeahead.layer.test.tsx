// ABOUTME: Tests AgentTypeahead inside nested dialog layers with a peeked dialog on top.
// ABOUTME: Verifies Escape closes the top dialog without dismissing the underlying typeahead host.

import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import Dialog from "corvu/dialog";
import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentTypeahead } from "./AgentTypeahead";

const modalRouteState = vi.hoisted(() => ({
  modalStack: undefined as unknown as () => Array<{ type: string; id: string }>,
  setModalStack: undefined as unknown as (value: Array<{ type: string; id: string }>) => void,
}));

const agentFinderLifecycle = vi.hoisted(() => ({
  mounts: 0,
  unmounts: 0,
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
    openModal: vi.fn(),
  }),
}));

vi.mock("../AgentFinder", () => ({
  default: (props: { interactive: boolean }) => {
    agentFinderLifecycle.mounts += 1;
    onCleanup(() => {
      agentFinderLifecycle.unmounts += 1;
    });

    return <div data-testid="finder-interactive">{String(props.interactive)}</div>;
  },
}));

const NestedTypeaheadHarness = () => {
  const [typeaheadOpen, setTypeaheadOpen] = createSignal(true);
  const childOpen = createMemo(() => modalRouteState.modalStack().length > 1);

  return (
    <Dialog closeOnEscapeKeyDown={modalRouteState.modalStack().length === 1} closeOnOutsidePointer={false} open={true}>
      <Dialog.Portal mount={document.body}>
        <Dialog.Content>
          <button
            type="button"
            onClick={() =>
              modalRouteState.setModalStack([
                { type: "agent", id: "agent-1" },
                { type: "agent", id: "agent-2" },
              ])
            }
          >
            Open peek
          </button>

          <Show when={typeaheadOpen()}>
            <AgentTypeahead
              inputValue="@@"
              cursorPosition={2}
              visible={true}
              workspaceId="ws_test"
              currentAgentId="agent-1"
              insideAgentModal={true}
              onSelect={() => {}}
              onClose={() => setTypeaheadOpen(false)}
            >
              <textarea aria-label="Composer" />
            </AgentTypeahead>
          </Show>

          <Show when={childOpen()}>
            <Dialog
              closeOnEscapeKeyDown={true}
              closeOnOutsidePointer={false}
              open={true}
              onOpenChange={(open) => {
                if (!open) {
                  modalRouteState.setModalStack([{ type: "agent", id: "agent-1" }]);
                }
              }}
            >
              <Dialog.Portal mount={document.body}>
                <Dialog.Content>
                  <div data-testid="peek-dialog">Peek dialog</div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog>
          </Show>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

const StaleEscapeListenerHarness = () => {
  const [typeaheadClosed, setTypeaheadClosed] = createSignal(false);
  const childOpen = createMemo(() => modalRouteState.modalStack().length > 1);

  const simulateRouterLagWindow = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    modalRouteState.setModalStack([
      { type: "agent", id: "agent-1" },
      { type: "agent", id: "agent-2" },
    ]);
    document.removeEventListener("keydown", simulateRouterLagWindow, true);
  };

  onCleanup(() => {
    document.removeEventListener("keydown", simulateRouterLagWindow, true);
  });

  return (
    <Dialog closeOnEscapeKeyDown={modalRouteState.modalStack().length === 1} closeOnOutsidePointer={false} open={true}>
      <Dialog.Portal mount={document.body}>
        <Dialog.Content>
          <button type="button" onClick={() => document.addEventListener("keydown", simulateRouterLagWindow, true)}>
            Start handoff race
          </button>

          <Show when={!typeaheadClosed()}>
            <AgentTypeahead
              inputValue="@@"
              cursorPosition={2}
              visible={true}
              workspaceId="ws_test"
              currentAgentId="agent-1"
              insideAgentModal={true}
              onSelect={() => {}}
              onClose={() => setTypeaheadClosed(true)}
            >
              <textarea aria-label="Composer" />
            </AgentTypeahead>
          </Show>

          <Show when={childOpen()}>
            <Dialog
              closeOnEscapeKeyDown={true}
              closeOnOutsidePointer={false}
              open={true}
              onOpenChange={(open) => {
                if (!open) {
                  modalRouteState.setModalStack([{ type: "agent", id: "agent-1" }]);
                }
              }}
            >
              <Dialog.Portal mount={document.body}>
                <Dialog.Content>
                  <div data-testid="stale-race-peek">Peek dialog</div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog>
          </Show>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

describe("AgentTypeahead layered Escape handling", () => {
  beforeEach(() => {
    modalRouteState.setModalStack([{ type: "agent", id: "agent-1" }]);
  });

  afterEach(() => {
    cleanup();
    agentFinderLifecycle.mounts = 0;
    agentFinderLifecycle.unmounts = 0;
    vi.clearAllMocks();
  });

  it("closes the peeked dialog without dismissing the underlying typeahead", async () => {
    render(() => <NestedTypeaheadHarness />);

    expect(screen.getByTestId("finder-interactive")).toHaveTextContent("true");
    const textarea = screen.getByLabelText("Composer");
    textarea.focus();

    expect(textarea).toHaveFocus();

    fireEvent.click(screen.getByText("Open peek"));

    await waitFor(() => {
      expect(screen.getByTestId("peek-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("finder-interactive")).toHaveTextContent("false");
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByTestId("peek-dialog")).not.toBeInTheDocument();
      expect(screen.getByTestId("finder-interactive")).toHaveTextContent("true");
    });
  });

  it("does not let a stale Escape listener swallow the first Escape during the peek handoff", async () => {
    render(() => <StaleEscapeListenerHarness />);

    fireEvent.click(screen.getByText("Start handoff race"));
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByTestId("stale-race-peek")).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("finder-interactive")).toBeInTheDocument();
  });

  it("keeps focus on the textarea while the typeahead popover is open", () => {
    render(() => <NestedTypeaheadHarness />);

    const textarea = screen.getByLabelText("Composer");
    textarea.focus();

    expect(textarea).toHaveFocus();
  });

  it("keeps the same AgentFinder instance mounted through a peek open and close round-trip", async () => {
    render(() => <NestedTypeaheadHarness />);

    expect(agentFinderLifecycle.mounts).toBe(1);
    expect(agentFinderLifecycle.unmounts).toBe(0);

    fireEvent.click(screen.getByText("Open peek"));

    await waitFor(() => {
      expect(screen.getByTestId("peek-dialog")).toBeInTheDocument();
    });

    expect(agentFinderLifecycle.mounts).toBe(1);
    expect(agentFinderLifecycle.unmounts).toBe(0);

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByTestId("peek-dialog")).not.toBeInTheDocument();
    });

    expect(agentFinderLifecycle.mounts).toBe(1);
    expect(agentFinderLifecycle.unmounts).toBe(0);
  });
});
