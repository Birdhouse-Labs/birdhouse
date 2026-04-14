// ABOUTME: Tests for EditAgentDialog — self-loading messages, form behaviour, and title generation
// ABOUTME: Verifies the dialog loads messages on open and disables Generate while loading

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import EditAgentDialog from "./EditAgentDialog";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "ws-1" }),
}));

vi.mock("../contexts/ZIndexContext", () => ({
  useZIndex: () => 50,
}));

const mockFetchMessages = vi.fn();
const mockUpdateAgentTitle = vi.fn();
const mockGenerateTitle = vi.fn();

vi.mock("../services/messages-api", () => ({
  fetchMessages: (...args: unknown[]) => mockFetchMessages(...args),
  updateAgentTitle: (...args: unknown[]) => mockUpdateAgentTitle(...args),
  generateTitle: (...args: unknown[]) => mockGenerateTitle(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMsg(role: "user" | "assistant", content: string) {
  return { role, content, id: crypto.randomUUID(), parts: [] };
}

function renderDialog(overrides: Partial<Parameters<typeof EditAgentDialog>[0]> = {}) {
  const defaults = {
    agentId: "agent-1",
    currentTitle: "Old Title",
    open: true,
    onOpenChange: vi.fn(),
    onSuccess: vi.fn(),
  };
  return render(() => <EditAgentDialog {...{ ...defaults, ...overrides }} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EditAgentDialog", () => {
  it("renders with the current title pre-filled", async () => {
    mockFetchMessages.mockResolvedValue([]);
    renderDialog();
    const input = await screen.findByRole("textbox", { name: /title/i });
    expect((input as HTMLInputElement).value).toBe("Old Title");
  });

  it("fetches messages when opened and enables Generate once loaded", async () => {
    const msgs = [makeMsg("user", "hello"), makeMsg("assistant", "hi")];
    mockFetchMessages.mockResolvedValue(msgs);

    renderDialog();

    // Generate button should be disabled while loading
    const generateBtn = screen.getByRole("button", { name: /generate/i });
    expect(generateBtn).toBeDisabled();

    // After messages load, Generate should be enabled
    await waitFor(() => expect(generateBtn).not.toBeDisabled());
    expect(mockFetchMessages).toHaveBeenCalledWith("ws-1", "agent-1");
  });

  it("keeps Generate disabled when there are no messages after loading", async () => {
    mockFetchMessages.mockResolvedValue([]);
    renderDialog();
    const generateBtn = screen.getByRole("button", { name: /generate/i });
    await waitFor(() => expect(mockFetchMessages).toHaveBeenCalled());
    // Still disabled because messages list is empty
    expect(generateBtn).toBeDisabled();
  });

  it("Save button is disabled when title is unchanged", async () => {
    mockFetchMessages.mockResolvedValue([]);
    renderDialog();
    const saveBtn = screen.getByRole("button", { name: /^save$/i });
    expect(saveBtn).toBeDisabled();
  });

  it("Save button is enabled after user changes the title", async () => {
    mockFetchMessages.mockResolvedValue([]);
    renderDialog();
    const input = await screen.findByRole("textbox", { name: /title/i });
    fireEvent.input(input, { target: { value: "New Title" } });
    const saveBtn = screen.getByRole("button", { name: /^save$/i });
    expect(saveBtn).not.toBeDisabled();
  });

  it("calls onSuccess with the new title after successful save", async () => {
    mockFetchMessages.mockResolvedValue([]);
    mockUpdateAgentTitle.mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ onSuccess, onOpenChange });

    const input = await screen.findByRole("textbox", { name: /title/i });
    fireEvent.input(input, { target: { value: "New Title" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("New Title"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("refetches messages when agentId changes while dialog remains open", async () => {
    mockFetchMessages.mockResolvedValue([makeMsg("user", "hello")]);
    const [agentId, setAgentId] = createSignal("agent-1");

    render(() => <EditAgentDialog agentId={agentId()} currentTitle="Title" open={true} onOpenChange={() => {}} />);

    await waitFor(() => expect(mockFetchMessages).toHaveBeenCalledWith("ws-1", "agent-1"));

    setAgentId("agent-2");
    await waitFor(() => expect(mockFetchMessages).toHaveBeenCalledWith("ws-1", "agent-2"));
  });
});
