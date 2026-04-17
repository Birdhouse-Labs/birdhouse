// ABOUTME: Tests nested agent modal behavior with the real Corvu dialog primitive.
// ABOUTME: Verifies one Escape closes only the top modal in the recursive modal tree.

import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { type Accessor, type Component, createMemo, createSignal, type JSX, onCleanup, Show } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import AgentModal from "./AgentModal";

const liveMessagesLifecycle = vi.hoisted(() => ({
  mounts: new Map<string, number>(),
  unmounts: new Map<string, number>(),
}));

vi.mock("./LiveMessages", () => ({
  default: (props: { agentId: string }) => {
    liveMessagesLifecycle.mounts.set(props.agentId, (liveMessagesLifecycle.mounts.get(props.agentId) ?? 0) + 1);
    onCleanup(() => {
      liveMessagesLifecycle.unmounts.set(props.agentId, (liveMessagesLifecycle.unmounts.get(props.agentId) ?? 0) + 1);
    });

    return <div data-testid={`agent-modal-${props.agentId}`}>Agent {props.agentId}</div>;
  },
}));

vi.mock("../contexts/ZIndexContext", () => ({
  ZIndexProvider: (props: { children: JSX.Element }) => <>{props.children}</>,
}));

interface TestModalState {
  type: "agent";
  id: string;
}

interface RecursiveModalNodeProps {
  stack: Accessor<TestModalState[]>;
  index: number;
  onClose: () => void;
  onOpenAgentModal: (agentId: string) => void;
}

const RecursiveModalNode: Component<RecursiveModalNodeProps> = (props) => {
  const modal = createMemo(() => props.stack()[props.index]);

  return (
    <Show when={modal()} keyed>
      {(currentModal) => (
        <AgentModal
          agentId={currentModal.id}
          navigationDepth={props.index + 1}
          isTop={props.index === props.stack().length - 1}
          onClose={props.onClose}
          onOpenAgentModal={props.onOpenAgentModal}
        >
          <RecursiveModalNode
            stack={props.stack}
            index={props.index + 1}
            onClose={props.onClose}
            onOpenAgentModal={props.onOpenAgentModal}
          />
        </AgentModal>
      )}
    </Show>
  );
};

const RecursiveModalHarness: Component = () => {
  const [stack, setStack] = createSignal<TestModalState[]>([
    { type: "agent", id: "agent-1" },
    { type: "agent", id: "agent-2" },
  ]);

  const agentStack = createMemo(() => stack().filter((modal) => modal.type === "agent"));

  return (
    <RecursiveModalNode
      stack={agentStack}
      index={0}
      onClose={() => setStack((current) => current.slice(0, -1))}
      onOpenAgentModal={() => {}}
    />
  );
};

const PushChildModalHarness: Component = () => {
  const [stack, setStack] = createSignal<TestModalState[]>([{ type: "agent", id: "agent-1" }]);

  const agentStack = createMemo(() => stack().filter((modal) => modal.type === "agent"));

  return (
    <>
      <button type="button" onClick={() => setStack((current) => [...current, { type: "agent", id: "agent-2" }])}>
        Open child modal
      </button>
      <RecursiveModalNode
        stack={agentStack}
        index={0}
        onClose={() => setStack((current) => current.slice(0, -1))}
        onOpenAgentModal={(agentId) => setStack((current) => [...current, { type: "agent", id: agentId }])}
      />
    </>
  );
};

describe("AgentModal nested dialog layers", () => {
  afterEach(() => {
    cleanup();
    liveMessagesLifecycle.mounts.clear();
    liveMessagesLifecycle.unmounts.clear();
    vi.clearAllMocks();
  });

  it("closes only the top modal on each Escape press", async () => {
    render(() => <RecursiveModalHarness />);

    expect(screen.getByTestId("agent-modal-agent-1")).toBeInTheDocument();
    expect(screen.getByTestId("agent-modal-agent-2")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByTestId("agent-modal-agent-1")).toBeInTheDocument();
      expect(screen.queryByTestId("agent-modal-agent-2")).not.toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByTestId("agent-modal-agent-1")).not.toBeInTheDocument();
    });
  });

  it("keeps the parent modal content mounted when a child modal is pushed", async () => {
    render(() => <PushChildModalHarness />);

    expect(screen.getByTestId("agent-modal-agent-1")).toBeInTheDocument();
    expect(liveMessagesLifecycle.mounts.get("agent-1")).toBe(1);
    expect(liveMessagesLifecycle.unmounts.get("agent-1") ?? 0).toBe(0);

    fireEvent.click(screen.getByText("Open child modal"));

    await waitFor(() => {
      expect(screen.getByTestId("agent-modal-agent-2")).toBeInTheDocument();
    });

    expect(liveMessagesLifecycle.mounts.get("agent-1")).toBe(1);
    expect(liveMessagesLifecycle.unmounts.get("agent-1") ?? 0).toBe(0);
  });
});
