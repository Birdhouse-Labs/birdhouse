// ABOUTME: Tests composer interaction with the shared @@ agent finder flow.
// ABOUTME: Verifies Cmd+Enter confirms agent selection instead of sending while typeahead is open.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AutoGrowTextarea from "./AutoGrowTextarea";

vi.mock("../../contexts/SkillCacheContext", () => ({
  useSkillCache: () => ({
    skills: () => [],
    loading: () => false,
    error: () => null,
    refetch: async () => {},
    getSkill: () => undefined,
  }),
}));

vi.mock("../../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "ws_test" }),
}));

vi.mock("../../lib/routing", () => ({
  useWorkspaceAgentId: () => () => undefined,
  useModalRoute: () => ({ modalStack: () => [] }),
}));

vi.mock("../../services/messages-api", () => ({
  fetchModels: async () => [],
}));

vi.mock("./AgentTypeahead", () => ({
  default: (props: {
    visible: boolean;
    onSelect: (agent: { id: string; title: string }, matchedText: string, matchStartIndex: number) => void;
  }) => {
    createEffect(() => {
      if (!props.visible) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          props.onSelect({ id: "agent_1", title: "Agent One" }, "alpha", 0);
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
    });

    return (
      <Show when={props.visible}>
        <div data-testid="mock-agent-typeahead" />
      </Show>
    );
  },
}));

describe("AutoGrowTextarea agent typeahead", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.execCommand = vi.fn((command: string, _ui: boolean, value?: string) => {
      if (command !== "insertText") return false;

      const textarea = document.activeElement;
      if (!(textarea instanceof HTMLTextAreaElement) || typeof value !== "string") {
        return false;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextValue = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
      textarea.value = nextValue;
      textarea.setSelectionRange(start + value.length, start + value.length);
      fireEvent.input(textarea, { target: { value: nextValue } });
      return true;
    }) as typeof document.execCommand;
  });

  it("sends on Cmd+Enter when the agent typeahead is closed", () => {
    const onSend = vi.fn();

    render(() => <AutoGrowTextarea value="hello" onInput={() => {}} onSend={onSend} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("confirms the agent mention on Cmd+Enter instead of sending", async () => {
    const onSend = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = createSignal("");
      return <AutoGrowTextarea value={value()} onInput={setValue} onSend={onSend} />;
    };

    render(() => <Wrapper />);

    const textarea = screen.getByRole("textbox");
    fireEvent.input(textarea, { target: { value: "@@alpha" } });

    await waitFor(() => {
      expect(screen.getByTestId("mock-agent-typeahead")).toBeInTheDocument();
    });

    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe("[Agent One](birdhouse:agent/agent_1)");
    });

    expect(onSend).not.toHaveBeenCalled();
  });
});
