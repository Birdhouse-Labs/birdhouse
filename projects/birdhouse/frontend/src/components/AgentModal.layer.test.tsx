// ABOUTME: Tests nested agent modal behavior with the real Corvu dialog primitive.
// ABOUTME: Verifies one Escape closes only the top modal in the recursive modal tree.

import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { type Component, createMemo, createSignal, type JSX } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import AgentModal from "./AgentModal";

vi.mock("./LiveMessages", () => ({
  default: (props: { agentId: string }) => (
    <div data-testid={`agent-modal-${props.agentId}`}>Agent {props.agentId}</div>
  ),
}));

vi.mock("../contexts/ZIndexContext", () => ({
  ZIndexProvider: (props: { children: JSX.Element }) => <>{props.children}</>,
}));

interface TestModalState {
  type: "agent";
  id: string;
}

const RecursiveModalHarness: Component = () => {
  const [stack, setStack] = createSignal<TestModalState[]>([
    { type: "agent", id: "agent-1" },
    { type: "agent", id: "agent-2" },
  ]);

  const agentStack = createMemo(() => stack().filter((modal) => modal.type === "agent"));

  const renderStack = (index = 0): JSX.Element => {
    const modal = agentStack()[index];
    if (!modal) return null;

    return (
      <AgentModal
        agentId={modal.id}
        navigationDepth={index + 1}
        isTop={index === agentStack().length - 1}
        onClose={() => setStack((current) => current.slice(0, -1))}
        onOpenAgentModal={() => {}}
      >
        {renderStack(index + 1)}
      </AgentModal>
    );
  };

  return <>{renderStack()}</>;
};

describe("AgentModal nested dialog layers", () => {
  afterEach(() => {
    cleanup();
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
});
