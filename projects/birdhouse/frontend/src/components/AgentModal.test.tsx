// ABOUTME: Tests agent modal dialog behavior for stacked modal keyboard dismissal.
// ABOUTME: Verifies only the top agent modal handles Escape-based dismissal.

import { cleanup, render } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import AgentModal from "./AgentModal";

const dialogMockState = vi.hoisted(() => ({
  closeOnEscapeKeyDown: undefined as boolean | undefined,
  initialFocusTarget: undefined as string | undefined,
  contentStyle: undefined as JSX.CSSProperties | undefined,
}));

vi.mock("./LiveMessages", () => ({
  default: (props: { initialFocusTarget?: string }) => {
    dialogMockState.initialFocusTarget = props.initialFocusTarget;
    return <div>Live messages</div>;
  },
}));

vi.mock("../contexts/ZIndexContext", () => ({
  ZIndexProvider: (props: { children: JSX.Element }) => <>{props.children}</>,
}));

vi.mock("corvu/dialog", () => {
  const Dialog = (props: { children: JSX.Element; closeOnEscapeKeyDown?: boolean }) => {
    dialogMockState.closeOnEscapeKeyDown = props.closeOnEscapeKeyDown;
    return <>{props.children}</>;
  };

  Dialog.Portal = (props: { children: JSX.Element }) => <>{props.children}</>;
  Dialog.Overlay = () => null;
  Dialog.Content = (props: { children: JSX.Element; class?: string; style?: JSX.CSSProperties }) => {
    dialogMockState.contentStyle = props.style;
    return <div class={props.class}>{props.children}</div>;
  };
  return { default: Dialog };
});

describe("AgentModal", () => {
  afterEach(() => {
    cleanup();
    dialogMockState.closeOnEscapeKeyDown = undefined;
    dialogMockState.initialFocusTarget = undefined;
    dialogMockState.contentStyle = undefined;
    vi.clearAllMocks();
  });

  it("only enables Escape dismissal for the top modal", () => {
    render(() => (
      <AgentModal agentId="agent-1" navigationDepth={0} isTop={true} onClose={() => {}} onOpenAgentModal={() => {}} />
    ));

    expect(dialogMockState.closeOnEscapeKeyDown).toBe(true);
    expect(dialogMockState.initialFocusTarget).toBe("messages");
    expect(dialogMockState.contentStyle?.["pointer-events"]).toBe("auto");

    cleanup();

    render(() => (
      <AgentModal agentId="agent-1" navigationDepth={1} isTop={false} onClose={() => {}} onOpenAgentModal={() => {}} />
    ));

    expect(dialogMockState.closeOnEscapeKeyDown).toBe(false);
  });
});
