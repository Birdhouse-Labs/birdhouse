// ABOUTME: Compares recursive nested rendering with keyed sibling rendering for modal-like stacks.
// ABOUTME: Proves the current recursive JSX shape remounts parent layers when the stack grows.

import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { type Accessor, type Component, createMemo, createSignal, For, type JSX, onCleanup, Show } from "solid-js";
import { afterEach, describe, expect, it } from "vitest";

interface TestModalState {
  type: "agent";
  id: string;
}

const parentModal: TestModalState = { type: "agent", id: "agent-1" };
const childModal: TestModalState = { type: "agent", id: "agent-2" };

const lifecycle = {
  mounts: new Map<string, number>(),
  unmounts: new Map<string, number>(),
};

const PlainLayer: Component<{ agentId: string; children?: JSX.Element }> = (props) => {
  lifecycle.mounts.set(props.agentId, (lifecycle.mounts.get(props.agentId) ?? 0) + 1);
  onCleanup(() => {
    lifecycle.unmounts.set(props.agentId, (lifecycle.unmounts.get(props.agentId) ?? 0) + 1);
  });

  return (
    <div data-testid={`plain-layer-${props.agentId}`}>
      {props.agentId}
      {props.children}
    </div>
  );
};

const RecursivePlainHarness: Component = () => {
  const [stack, setStack] = createSignal<TestModalState[]>([parentModal]);

  const renderStack = (index = 0): JSX.Element => {
    const modal = stack()[index];
    if (!modal) return null;

    return <PlainLayer agentId={modal.id}>{renderStack(index + 1)}</PlainLayer>;
  };

  return (
    <>
      <button type="button" onClick={() => setStack([parentModal, childModal])}>
        Push child in recursion
      </button>
      {renderStack()}
    </>
  );
};

interface RecursivePlainNodeProps {
  stack: Accessor<TestModalState[]>;
  index: number;
}

const RecursivePlainNode: Component<RecursivePlainNodeProps> = (props) => {
  const modal = createMemo(() => props.stack()[props.index]);

  return (
    <Show when={modal()} keyed>
      {(currentModal) => (
        <PlainLayer agentId={currentModal.id}>
          <RecursivePlainNode stack={props.stack} index={props.index + 1} />
        </PlainLayer>
      )}
    </Show>
  );
};

const RecursiveComponentHarness: Component = () => {
  const [stack, setStack] = createSignal<TestModalState[]>([parentModal]);

  return (
    <>
      <button type="button" onClick={() => setStack([parentModal, childModal])}>
        Push child in recursive component
      </button>
      <RecursivePlainNode stack={stack} index={0} />
    </>
  );
};

const SiblingForHarness: Component = () => {
  const [stack, setStack] = createSignal<TestModalState[]>([parentModal]);

  return (
    <>
      <button type="button" onClick={() => setStack([parentModal, childModal])}>
        Push child in For
      </button>
      <For each={stack()}>{(modal) => <PlainLayer agentId={modal.id} />}</For>
    </>
  );
};

describe("AgentModal recursive rendering behavior", () => {
  afterEach(() => {
    cleanup();
    lifecycle.mounts.clear();
    lifecycle.unmounts.clear();
  });

  it("remounts the parent layer when recursion adds a child even with stable item references", () => {
    render(() => <RecursivePlainHarness />);

    expect(screen.getByTestId("plain-layer-agent-1")).toBeInTheDocument();
    expect(lifecycle.mounts.get("agent-1")).toBe(1);
    expect(lifecycle.unmounts.get("agent-1") ?? 0).toBe(0);

    fireEvent.click(screen.getByText("Push child in recursion"));

    expect(screen.getByTestId("plain-layer-agent-2")).toBeInTheDocument();
    expect(lifecycle.mounts.get("agent-1")).toBe(2);
    expect(lifecycle.unmounts.get("agent-1") ?? 0).toBe(1);
  });

  it("keeps the parent layer mounted when a keyed sibling For adds a child", () => {
    render(() => <SiblingForHarness />);

    expect(screen.getByTestId("plain-layer-agent-1")).toBeInTheDocument();
    expect(lifecycle.mounts.get("agent-1")).toBe(1);
    expect(lifecycle.unmounts.get("agent-1") ?? 0).toBe(0);

    fireEvent.click(screen.getByText("Push child in For"));

    expect(screen.getByTestId("plain-layer-agent-2")).toBeInTheDocument();
    expect(lifecycle.mounts.get("agent-1")).toBe(1);
    expect(lifecycle.unmounts.get("agent-1") ?? 0).toBe(0);
  });

  it("keeps the parent layer mounted when a recursive component adds a child", () => {
    render(() => <RecursiveComponentHarness />);

    expect(screen.getByTestId("plain-layer-agent-1")).toBeInTheDocument();
    expect(lifecycle.mounts.get("agent-1")).toBe(1);
    expect(lifecycle.unmounts.get("agent-1") ?? 0).toBe(0);

    fireEvent.click(screen.getByText("Push child in recursive component"));

    expect(screen.getByTestId("plain-layer-agent-2")).toBeInTheDocument();
    expect(lifecycle.mounts.get("agent-1")).toBe(1);
    expect(lifecycle.unmounts.get("agent-1") ?? 0).toBe(0);
  });
});
