// ABOUTME: Tests new-agent draft behavior around successful launches.
// ABOUTME: Verifies pending saves do not resurrect launched text during unmount cleanup.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  clearDraftMock,
  getDraftMock,
  saveDraftMock,
  createAgentMock,
  fetchModelsMock,
  navigateMock,
  saveControllers,
  setSearchParamsMock,
} = vi.hoisted(() => ({
  clearDraftMock: vi.fn(),
  getDraftMock: vi.fn(),
  saveDraftMock: vi.fn(),
  createAgentMock: vi.fn(),
  fetchModelsMock: vi.fn(),
  navigateMock: vi.fn(),
  saveControllers: [] as Array<{ pending: boolean }>,
  setSearchParamsMock: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({
  useNavigate: () => navigateMock,
  useSearchParams: () => [{}, setSearchParamsMock],
}));

vi.mock("../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "ws_test" }),
}));

vi.mock("../services/drafts-api", () => ({
  clearDraft: clearDraftMock,
  getDraft: getDraftMock,
  saveDraft: saveDraftMock,
}));

vi.mock("../services/messages-api", () => ({
  createAgent: createAgentMock,
  fetchModels: fetchModelsMock,
}));

vi.mock("../services/skill-attachments-api", () => ({
  previewSkillAttachments: vi.fn(async () => []),
}));

vi.mock("../utils/draft-persistence", () => ({
  createDebouncedSave: (callback: () => void) => {
    const controller = { pending: false };
    saveControllers.push(controller);

    return {
      schedule: () => {
        controller.pending = true;
      },
      cancel: () => {
        controller.pending = false;
      },
      flush: () => {
        if (!controller.pending) {
          return;
        }
        controller.pending = false;
        callback();
      },
    };
  },
}));

vi.mock("./ui/AutoGrowTextarea", () => ({
  default: (props: { value: string; onInput: (value: string) => void; disabled?: boolean; placeholder?: string }) => (
    <textarea
      aria-label={props.placeholder ?? "message"}
      value={props.value}
      disabled={props.disabled}
      onInput={(event) => props.onInput(event.currentTarget.value)}
    />
  ),
}));

vi.mock("./ui/Button", () => ({
  default: (props: { children: JSX.Element; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" disabled={props.disabled} onClick={props.onClick}>
      {props.children}
    </button>
  ),
}));

vi.mock("./ui/Combobox", () => ({
  Combobox: () => <div data-testid="model-combobox" />,
}));

vi.mock("./ui/ComposerAttachmentDropZone", () => ({
  default: (props: { children: unknown }) => <>{props.children}</>,
}));

vi.mock("./ui/ComposerImageAttachments", () => ({
  default: () => null,
}));

vi.mock("./ui/SkillAttachmentsDialog", () => ({
  default: () => null,
}));

import NewAgent from "./NewAgent";

describe("NewAgent draft persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveControllers.length = 0;

    getDraftMock.mockResolvedValue({ text: "", attachments: [] });
    saveDraftMock.mockResolvedValue(undefined);
    clearDraftMock.mockResolvedValue(undefined);
    fetchModelsMock.mockResolvedValue([
      {
        id: "anthropic/claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        provider: "Anthropic",
        contextLimit: 200000,
      },
    ]);
    createAgentMock.mockResolvedValue({ id: "agent_created" });
    localStorage.clear();
  });

  it("does not save launched text again during unmount cleanup", async () => {
    const rendered = render(() => <NewAgent />);

    await waitFor(() => {
      expect(getDraftMock).toHaveBeenCalledWith("ws_test", "new-agent");
      expect(fetchModelsMock).toHaveBeenCalledWith("ws_test");
    });

    await Promise.resolve();
    await Promise.resolve();

    const textbox = screen.getByRole("textbox", { name: "What would you like help with?" });

    fireEvent.input(textbox, {
      currentTarget: { value: "Investigate launch draft race" },
      target: { value: "Investigate launch draft race" },
    });

    const controller = saveControllers[0];
    if (!controller) {
      throw new Error("Expected debounced save controller");
    }

    await waitFor(() => {
      expect(controller.pending).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "Launch Agent" }));

    await waitFor(() => {
      expect(createAgentMock).toHaveBeenCalledWith(
        "ws_test",
        undefined,
        "anthropic/claude-sonnet-4-6",
        "Investigate launch draft race",
        undefined,
        [],
      );
      expect(clearDraftMock).toHaveBeenCalledWith("ws_test", "new-agent");
      expect(navigateMock).toHaveBeenCalledWith("/workspace/ws_test/agent/agent_created");
    });

    expect(controller.pending).toBe(false);

    rendered.unmount();

    expect(saveDraftMock).not.toHaveBeenCalled();
  });
});
