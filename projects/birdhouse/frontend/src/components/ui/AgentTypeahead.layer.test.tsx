// ABOUTME: Tests AgentTypeahead inside nested dialog layers with a peeked dialog on top.
// ABOUTME: Verifies Escape closes the top dialog without dismissing the underlying typeahead host.

import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import Dialog from "corvu/dialog";
import { createMemo, createSignal, Show } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentTypeahead } from "./AgentTypeahead";

const modalRouteState = vi.hoisted(() => ({
  modalStack: undefined as unknown as () => Array<{ type: string; id: string }>,
  setModalStack: undefined as unknown as (value: Array<{ type: string; id: string }>) => void,
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

vi.mock("solid-floating-ui", () => ({
  useFloating: () => ({
    strategy: "absolute",
    x: 12,
    y: 34,
  }),
}));

vi.mock("../AgentFinder", () => ({
  default: (props: { interactive: boolean }) => <div data-testid="finder-interactive">{String(props.interactive)}</div>,
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
              referenceElement={undefined}
              inputValue="@@"
              cursorPosition={2}
              visible={true}
              workspaceId="ws_test"
              currentAgentId="agent-1"
              insideAgentModal={true}
              onSelect={() => {}}
              onClose={() => setTypeaheadOpen(false)}
            />
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

describe("AgentTypeahead layered Escape handling", () => {
  beforeEach(() => {
    modalRouteState.setModalStack([{ type: "agent", id: "agent-1" }]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("closes the peeked dialog without dismissing the underlying typeahead", async () => {
    render(() => <NestedTypeaheadHarness />);

    expect(screen.getByTestId("finder-interactive")).toHaveTextContent("true");

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
});
