// ABOUTME: Tests AgentTypeahead Right Shift behavior with the real AgentFinder in layered dialog flows.
// ABOUTME: Verifies Right Shift opens a peek without bubbling into the parent dialog layer.

import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import Dialog from "corvu/dialog";
import { createMemo, createSignal, Show } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as agentsApi from "../../services/agents-api";
import { AgentTypeahead } from "./AgentTypeahead";

const modalRouteState = vi.hoisted(() => ({
  modalStack: undefined as unknown as () => Array<{ type: string; id: string }>,
  setModalStack: undefined as unknown as (value: Array<{ type: string; id: string }>) => void,
  openModal: vi.fn(),
}));

const [mockModalStack, setMockModalStack] = createSignal<Array<{ type: string; id: string }>>([]);
modalRouteState.modalStack = mockModalStack;
modalRouteState.setModalStack = setMockModalStack;

vi.mock("../../services/agents-api", () => ({
  fetchRecentAgentsList: vi.fn(),
  fetchRecentAgentSnippet: vi.fn(),
  searchAgentMessages: vi.fn(),
}));

vi.mock("../../contexts/ZIndexContext", () => ({
  useZIndex: () => 100,
}));

vi.mock("../../lib/routing", () => ({
  useModalRoute: () => ({
    modalStack: modalRouteState.modalStack,
    openModal: modalRouteState.openModal,
  }),
}));

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

const mockFetchRecentAgentsList = agentsApi.fetchRecentAgentsList as ReturnType<typeof vi.fn>;

const makeRecentAgent = () => ({
  id: "agent-2",
  title: "Peek Target",
  session_id: "ses-recent-1",
  parent_id: null,
  tree_id: "tree-recent-1",
});

const LayeredShiftHarness = (props: { closeParentOnShift: boolean }) => {
  const [parentOpen, setParentOpen] = createSignal(true);
  const childOpen = createMemo(() => modalRouteState.modalStack().length > 1);

  return (
    <Show when={parentOpen()}>
      <div
        data-testid="parent-layer"
        role="dialog"
        onKeyUp={(e) => {
          if (props.closeParentOnShift && e.code === "ShiftRight") {
            setParentOpen(false);
          }
        }}
      >
        <AgentTypeahead
          inputValue="@@"
          cursorPosition={2}
          visible={true}
          workspaceId="ws_test"
          currentAgentId="agent-1"
          insideAgentModal={true}
          onSelect={() => {}}
          onClose={() => setParentOpen(false)}
        >
          <textarea aria-label="Composer" />
        </AgentTypeahead>

        <Show when={childOpen()}>
          <div data-testid="peek-dialog">Peek dialog</div>
        </Show>
      </div>
    </Show>
  );
};

const RootShiftHarness = () => {
  const [typeaheadOpen, setTypeaheadOpen] = createSignal(true);
  const childOpen = createMemo(() => modalRouteState.modalStack().length > 0);

  return (
    <div data-testid="root-layer">
      <Show when={typeaheadOpen()}>
        <AgentTypeahead
          inputValue="@@"
          cursorPosition={2}
          visible={true}
          workspaceId="ws_test"
          currentAgentId="agent-1"
          onSelect={() => {}}
          onClose={() => setTypeaheadOpen(false)}
        >
          <textarea aria-label="Root Composer" />
        </AgentTypeahead>
      </Show>

      <Show when={childOpen()}>
        <Dialog
          open={true}
          closeOnEscapeKeyDown={true}
          closeOnOutsidePointer={false}
          closeOnOutsideFocus={false}
          onOpenChange={(open) => {
            if (!open) {
              modalRouteState.setModalStack([]);
            }
          }}
        >
          <Dialog.Portal mount={document.body}>
            <Dialog.Content>
              <div data-testid="root-peek-dialog">Peek dialog</div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog>
      </Show>
    </div>
  );
};

describe("AgentTypeahead layered Right Shift", () => {
  beforeEach(() => {
    modalRouteState.setModalStack([{ type: "agent", id: "agent-1" }]);
    modalRouteState.openModal.mockReset();
    modalRouteState.openModal.mockImplementation((type: string, id: string) => {
      const current = modalRouteState.modalStack();
      modalRouteState.setModalStack([...current, { type, id }]);
    });
    mockFetchRecentAgentsList.mockResolvedValue([makeRecentAgent()]);
    globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens a peek on first Right Shift without closing the parent layer", async () => {
    render(() => <LayeredShiftHarness closeParentOnShift={true} />);

    expect(await screen.findByText("Peek Target")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowDown" });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Peek Target" })).toHaveAttribute("aria-current", "true");
    });
    fireEvent.keyUp(screen.getByRole("button", { name: "Peek Target" }), { code: "ShiftRight", key: "Shift" });

    await waitFor(() => {
      expect(modalRouteState.openModal).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("parent-layer")).toBeInTheDocument();
      expect(screen.getByTestId("peek-dialog")).toBeInTheDocument();
    });
  });

  it("does not open a second peek on a second Right Shift while the peek is on top", async () => {
    render(() => <LayeredShiftHarness closeParentOnShift={false} />);

    expect(await screen.findByText("Peek Target")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowDown" });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Peek Target" })).toHaveAttribute("aria-current", "true");
    });
    fireEvent.keyUp(screen.getByRole("button", { name: "Peek Target" }), { code: "ShiftRight", key: "Shift" });

    await waitFor(() => {
      expect(screen.getByTestId("peek-dialog")).toBeInTheDocument();
    });

    fireEvent.keyUp(document, { code: "ShiftRight", key: "Shift" });

    await waitFor(() => {
      expect(modalRouteState.openModal).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("peek-dialog")).toBeInTheDocument();
    });
  });

  it("keeps the root-agent finder open after Escape closes a peeked modal", async () => {
    modalRouteState.setModalStack([]);
    modalRouteState.openModal.mockImplementation((type: string, id: string) => {
      modalRouteState.setModalStack([{ type, id }]);
    });

    render(() => <RootShiftHarness />);

    expect(await screen.findByText("Peek Target")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowDown" });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Peek Target" })).toHaveAttribute("aria-current", "true");
    });

    fireEvent.keyUp(screen.getByRole("button", { name: "Peek Target" }), { code: "ShiftRight", key: "Shift" });

    await waitFor(() => {
      expect(screen.getByTestId("root-peek-dialog")).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByTestId("root-peek-dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Peek Target" })).toBeInTheDocument();
    });
  });
});
