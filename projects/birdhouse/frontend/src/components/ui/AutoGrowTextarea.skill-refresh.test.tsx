// ABOUTME: Tests composer skill completion after cache refresh events.
// ABOUTME: Verifies updated trigger phrases drive the inserted markdown link text.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SkillCacheProvider } from "../../contexts/SkillCacheContext";
import { StreamingProvider } from "../../contexts/StreamingContext";
import AutoGrowTextarea from "./AutoGrowTextarea";

const { fetchSkillLibraryMock } = vi.hoisted(() => ({
  fetchSkillLibraryMock: vi.fn(),
}));

vi.mock("../../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "ws_test" }),
}));

vi.mock("../../lib/routing", () => ({
  useWorkspaceAgentId: () => () => undefined,
}));

vi.mock("../../services/agents-api", () => ({
  fetchAgentsForTypeahead: async () => [],
}));

vi.mock("../../skills/services/skill-library-api", () => ({
  fetchSkillLibrary: fetchSkillLibraryMock,
}));

class MockEventSource {
  static latest: MockEventSource | null = null;

  readonly url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockEventSource.latest = this;
  }

  close() {}

  emitMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

describe("AutoGrowTextarea skill refresh", () => {
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    fetchSkillLibraryMock.mockReset();
    MockEventSource.latest = null;
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

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

  afterEach(() => {
    globalThis.EventSource = originalEventSource;
  });

  it("uses refreshed trigger phrases for the next accepted completion", async () => {
    fetchSkillLibraryMock
      .mockResolvedValueOnce({
        skills: [
          {
            id: "find-docs",
            title: "find-docs",
            trigger_phrases: ["old docs"],
          },
        ],
      })
      .mockResolvedValueOnce({
        skills: [
          {
            id: "find-docs",
            title: "find-docs",
            trigger_phrases: ["fresh docs"],
          },
        ],
      });

    const Wrapper = () => {
      const [value, setValue] = createSignal("");
      return (
        <StreamingProvider workspaceId="ws_test">
          <SkillCacheProvider>
            <AutoGrowTextarea value={value()} onInput={setValue} onSend={() => {}} />
          </SkillCacheProvider>
        </StreamingProvider>
      );
    };

    render(() => <Wrapper />);

    const textarea = screen.getByRole("textbox");

    await waitFor(() => {
      expect(fetchSkillLibraryMock).toHaveBeenCalledTimes(1);
    });

    MockEventSource.latest?.emitMessage({
      type: "birdhouse.skill.updated",
      properties: {
        skillName: "find-docs",
      },
    });

    await waitFor(() => {
      expect(fetchSkillLibraryMock).toHaveBeenCalledTimes(2);
    });

    fireEvent.input(textarea, { target: { value: "fresh do" } });

    await waitFor(() => {
      expect(screen.getByText("find-docs")).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "Enter" });

    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe("[fresh docs](birdhouse:skill/find-docs)");
    });
  });
});
