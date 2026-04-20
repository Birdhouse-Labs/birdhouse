// ABOUTME: Tests snapped agent targeting for palette agent subdialogs across modal stack changes.
// ABOUTME: Verifies a dialog opened for one modal agent does not retarget when another modal is pushed on top.

import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { type Accessor, type Component, createMemo, createSignal, Show } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import PaletteAgentSubdialogs, { type PaletteAgentDialogRequest } from "./PaletteAgentSubdialogs";

vi.mock("./AgentNotesDialog", () => ({
  default: (props: { agentId: string; open: boolean }) => (
    <div data-testid={`notes-dialog-${props.agentId}`} data-open={props.open ? "true" : "false"} />
  ),
}));

vi.mock("./EditAgentDialog", () => ({
  default: () => null,
}));

vi.mock("./ArchiveAgentDialog", () => ({
  default: () => null,
}));

vi.mock("./UnarchiveAgentDialog", () => ({
  default: () => null,
}));

interface TestModalState {
  type: "agent";
  id: string;
}

interface SnapshotNodeProps {
  stack: Accessor<TestModalState[]>;
  index: number;
  request: Accessor<PaletteAgentDialogRequest | null>;
  onRequestChange: (request: PaletteAgentDialogRequest | null) => void;
}

const SnapshotNode: Component<SnapshotNodeProps> = (props) => {
  const modal = createMemo(() => props.stack()[props.index]);
  const requestForModal = createMemo(() => {
    const currentModal = modal();
    const request = props.request();
    if (!currentModal || !request) return null;
    return request.agentId === currentModal.id ? request : null;
  });

  return (
    <Show when={modal()} keyed>
      {(currentModal) => (
        <div data-testid={`stack-node-${currentModal.id}`}>
          <PaletteAgentSubdialogs
            request={requestForModal()}
            workspaceId="ws_test"
            onRequestChange={props.onRequestChange}
          />
          <SnapshotNode
            stack={props.stack}
            index={props.index + 1}
            request={props.request}
            onRequestChange={props.onRequestChange}
          />
        </div>
      )}
    </Show>
  );
};

const SnapshotHarness: Component = () => {
  const [stack, setStack] = createSignal<TestModalState[]>([{ type: "agent", id: "agent-1" }]);
  const [request, setRequest] = createSignal<PaletteAgentDialogRequest | null>({ kind: "notes", agentId: "agent-1" });

  return (
    <>
      <button type="button" onClick={() => setStack((current) => [...current, { type: "agent", id: "agent-2" }])}>
        Push new top modal
      </button>
      <SnapshotNode stack={stack} index={0} request={request} onRequestChange={setRequest} />
    </>
  );
};

describe("PaletteAgentSubdialogs snapped targeting", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps the dialog bound to the snapped agent when a different modal becomes topmost", () => {
    render(() => <SnapshotHarness />);

    expect(screen.getByTestId("notes-dialog-agent-1")).toHaveAttribute("data-open", "true");
    expect(screen.queryByTestId("notes-dialog-agent-2")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Push new top modal"));

    expect(screen.getByTestId("notes-dialog-agent-1")).toHaveAttribute("data-open", "true");
    expect(screen.queryByTestId("notes-dialog-agent-2")).not.toBeInTheDocument();
  });
});
