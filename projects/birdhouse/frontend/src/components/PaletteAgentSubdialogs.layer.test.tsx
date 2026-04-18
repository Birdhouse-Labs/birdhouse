// ABOUTME: Tests palette agent subdialogs when they are JSX-nested inside an agent modal layer.
// ABOUTME: Verifies one Escape closes only the notes dialog while leaving the parent agent modal open.

import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { type Accessor, type Component, createMemo, createSignal, Show } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AgentModal from "./AgentModal";
import PaletteAgentSubdialogs, { type PaletteAgentDialogRequest } from "./PaletteAgentSubdialogs";

vi.mock("./LiveMessages", () => ({
  default: (props: { agentId: string }) => (
    <div data-testid={`agent-modal-${props.agentId}`}>Agent {props.agentId}</div>
  ),
}));

vi.mock("../services/agent-notes-api", () => ({
  getAgentNote: vi.fn(async () => ""),
  saveAgentNote: vi.fn(async () => undefined),
  clearAgentNote: vi.fn(async () => undefined),
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

interface NestedModalNodeProps {
  stack: Accessor<TestModalState[]>;
  index: number;
  request: Accessor<PaletteAgentDialogRequest | null>;
  onRequestChange: (request: PaletteAgentDialogRequest | null) => void;
}

const NestedModalNode: Component<NestedModalNodeProps> = (props) => {
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
        <AgentModal
          agentId={currentModal.id}
          navigationDepth={props.index + 1}
          isTop={props.index === props.stack().length - 1}
          onClose={() => {}}
          onOpenAgentModal={() => {}}
        >
          <PaletteAgentSubdialogs
            request={requestForModal()}
            workspaceId="ws_test"
            onRequestChange={props.onRequestChange}
          />
          <NestedModalNode
            stack={props.stack}
            index={props.index + 1}
            request={props.request}
            onRequestChange={props.onRequestChange}
          />
        </AgentModal>
      )}
    </Show>
  );
};

const NotesDialogInModalHarness: Component = () => {
  const [stack] = createSignal<TestModalState[]>([{ type: "agent", id: "agent-1" }]);
  const [request, setRequest] = createSignal<PaletteAgentDialogRequest | null>(null);

  return (
    <>
      <button type="button" onClick={() => setRequest({ kind: "notes", agentId: "agent-1" })}>
        Open notes
      </button>
      <NestedModalNode stack={stack} index={0} request={request} onRequestChange={setRequest} />
    </>
  );
};

describe("PaletteAgentSubdialogs nested layer behavior", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("closes only the notes dialog on Escape when nested inside an agent modal", async () => {
    render(() => <NotesDialogInModalHarness />);

    expect(screen.getByTestId("agent-modal-agent-1")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Open notes"));

    await waitFor(() => {
      expect(screen.getByText("Agent Notes")).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("Agent Notes")).not.toBeInTheDocument();
      expect(screen.getByTestId("agent-modal-agent-1")).toBeInTheDocument();
    });
  });

  it("renders the notes dialog above the parent agent modal content", async () => {
    render(() => <NotesDialogInModalHarness />);

    fireEvent.click(screen.getByText("Open notes"));

    const dialogContents = await waitFor(() => {
      const contents = Array.from(document.querySelectorAll("[data-corvu-dialog-content]"));
      expect(contents).toHaveLength(2);
      return contents;
    });

    const parentModalContent = dialogContents[0] as HTMLElement;
    const notesDialogContent = dialogContents[1] as HTMLElement;

    expect(parentModalContent.style.zIndex).toBe("62");
    expect(notesDialogContent.style.zIndex).toBe("70");
  });
});
