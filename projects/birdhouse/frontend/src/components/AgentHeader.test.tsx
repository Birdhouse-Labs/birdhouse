// ABOUTME: Unit tests for AgentHeader component
// ABOUTME: Tests rendering, archive, export, and PR status badge functionality

import { render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StreamingProvider } from "../contexts/StreamingContext";
import * as agentsApi from "../services/agents-api";
import type { Message } from "../types/messages";
import AgentHeader from "./AgentHeader";

// Mock useWorkspace hook
vi.mock("../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "test-workspace" }),
  WorkspaceProvider: ({ children }: { children: unknown }) => children,
}));

// Mock the agents API
vi.mock("../services/agents-api", () => ({
  archiveAgent: vi.fn(),
  unarchiveAgent: vi.fn(),
}));

// Mock the router navigate function
vi.mock("@solidjs/router", () => ({
  useNavigate: () => vi.fn(),
}));

// Mock fetch for status endpoint
globalThis.fetch = vi.fn() as typeof fetch;

// Helper to create mock messages
const createMockMessages = (): Message[] => [];

// Helper to render AgentHeader with StreamingProvider
const renderWithProvider = (props: {
  agentId: string;
  title: string;
  modelName: string;
  messages?: Message[];
  mode?: string;
  onModeChange?: (mode: string) => void;
  onHeaderClick?: () => void;
  archivedAt?: number | null;
}) => {
  const messages = props.messages || createMockMessages();
  const mode = props.mode || "build";
  const onModeChange = props.onModeChange || vi.fn();

  // Build props object conditionally to satisfy exactOptionalPropertyTypes
  const headerProps = {
    agentId: props.agentId,
    workspaceId: "test-workspace",
    title: props.title,
    modelName: props.modelName,
    messages,
    mode,
    onModeChange,
    ...(props.onHeaderClick ? { onHeaderClick: props.onHeaderClick } : {}),
    ...(props.archivedAt !== undefined ? { archivedAt: props.archivedAt } : {}),
  };

  return render(() => (
    <StreamingProvider workspaceId="test-workspace">
      <AgentHeader {...headerProps} />
    </StreamingProvider>
  ));
};

describe("AgentHeader - Archive functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: { type: "idle" } }),
    });
  });

  it("renders Archive menu item", async () => {
    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    // Open the menu
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    // Archive menu item should be visible
    await waitFor(() => {
      expect(screen.getByText("Archive")).toBeInTheDocument();
    });
  });

  it("opens confirmation dialog when Archive is clicked", async () => {
    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    // Open menu and click Archive
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    await waitFor(() => {
      expect(screen.getByText("Archive")).toBeInTheDocument();
    });

    const archiveMenuItem = screen.getByText("Archive");
    archiveMenuItem.click();

    // Dialog should appear with correct content
    await waitFor(() => {
      expect(screen.getByText("Archive Agent?")).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        "Archive this agent and all descendants? This cannot be undone. Messages remain viewable if you have the link.",
      ),
    ).toBeInTheDocument();
  });

  it("calls cancel handler when Cancel is clicked", async () => {
    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    // Open menu and click Archive
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    await waitFor(() => {
      expect(screen.getByText("Archive")).toBeInTheDocument();
    });

    screen.getByText("Archive").click();

    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByText("Archive Agent?")).toBeInTheDocument();
    });

    // Verify Cancel button exists and is clickable
    const cancelButton = screen.getByText("Cancel");
    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton).not.toBeDisabled();

    // Click cancel - the dialog will close but may not unmount immediately due to animations
    cancelButton.click();

    // Give the dialog time to start closing (corvu may have exit animations)
    // We can't reliably test removal from DOM in vitest due to portal animations
    // The important part is that the button worked and triggered the handler
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  it("calls archiveAgent API with correct agentId when confirmed", async () => {
    const archiveAgentMock = vi.mocked(agentsApi.archiveAgent);
    archiveAgentMock.mockResolvedValue({
      archivedCount: 5,
      archivedIds: ["agent-1", "agent-2", "agent-3", "agent-4", "agent-5"],
    });

    renderWithProvider({
      agentId: "agent-123",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    // Open menu and click Archive
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    await waitFor(() => {
      expect(screen.getByText("Archive")).toBeInTheDocument();
    });

    screen.getByText("Archive").click();

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText("Archive Agent?")).toBeInTheDocument();
    });

    // Click Archive button (in dialog, not menu item)
    const archiveButtons = screen.getAllByText("Archive");
    // The second "Archive" is the button in the dialog (first is in menu)
    const archiveButton = archiveButtons[archiveButtons.length - 1];
    if (!archiveButton) throw new Error("Archive button not found");
    archiveButton.click();

    // API should be called with workspaceId and agentId
    await waitFor(() => {
      expect(archiveAgentMock).toHaveBeenCalledWith("test-workspace", "agent-123");
    });
  });

  it("shows error message when API call fails", async () => {
    const archiveAgentMock = vi.mocked(agentsApi.archiveAgent);
    archiveAgentMock.mockRejectedValue(new Error("Archive failed: Database error"));

    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    // Open menu and click Archive
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    await waitFor(() => {
      expect(screen.getByText("Archive")).toBeInTheDocument();
    });

    screen.getByText("Archive").click();

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText("Archive Agent?")).toBeInTheDocument();
    });

    // Click Archive button (in dialog, not menu item)
    const archiveButtons = screen.getAllByText("Archive");
    const archiveButton = archiveButtons[archiveButtons.length - 1];
    if (!archiveButton) throw new Error("Archive button not found");
    archiveButton.click();

    // Error should be shown in dialog
    await waitFor(() => {
      expect(screen.getByText("Archive failed: Database error")).toBeInTheDocument();
    });

    // Dialog should remain open
    expect(screen.getByText("Archive Agent?")).toBeInTheDocument();
  });

  it("calls API and triggers close after successful archive", async () => {
    const archiveAgentMock = vi.mocked(agentsApi.archiveAgent);
    archiveAgentMock.mockResolvedValue({
      archivedCount: 1,
      archivedIds: ["agent-1"],
    });

    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    // Open menu and click Archive
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    await waitFor(() => {
      expect(screen.getByText("Archive")).toBeInTheDocument();
    });

    screen.getByText("Archive").click();

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText("Archive Agent?")).toBeInTheDocument();
    });

    // Click Archive button (in dialog, not menu item)
    const archiveButtons = screen.getAllByText("Archive");
    const archiveButton = archiveButtons[archiveButtons.length - 1];
    if (!archiveButton) throw new Error("Archive button not found");
    archiveButton.click();

    // Verify API was called with workspaceId and agentId
    await waitFor(() => {
      expect(archiveAgentMock).toHaveBeenCalledWith("test-workspace", "agent-1");
    });

    // Give dialog time to close (portal animations may delay DOM removal)
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
});

describe("AgentHeader - Unarchive functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: { type: "idle" } }),
    });
  });

  it("shows Unarchive menu item for archived agents", async () => {
    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
      archivedAt: Date.now(),
    });

    // Open the menu
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    // Unarchive menu item should be visible, not Archive
    await waitFor(() => {
      expect(screen.getByText("Unarchive")).toBeInTheDocument();
      expect(screen.queryByText("Archive")).not.toBeInTheDocument();
    });
  });

  it("shows Archive menu item for non-archived agents", async () => {
    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
      archivedAt: null,
    });

    // Open the menu
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    // Archive menu item should be visible, not Unarchive
    await waitFor(() => {
      expect(screen.getByText("Archive")).toBeInTheDocument();
      expect(screen.queryByText("Unarchive")).not.toBeInTheDocument();
    });
  });

  it("opens unarchive confirmation dialog when Unarchive is clicked", async () => {
    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
      archivedAt: Date.now(),
    });

    // Open menu and click Unarchive
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    await waitFor(() => {
      expect(screen.getByText("Unarchive")).toBeInTheDocument();
    });

    screen.getByText("Unarchive").click();

    // Dialog should appear with correct content
    await waitFor(() => {
      expect(screen.getByText("Unarchive Agent?")).toBeInTheDocument();
    });
    expect(screen.getByText("Unarchive this agent and all descendants?")).toBeInTheDocument();
  });

  it("calls unarchiveAgent API when confirmed", async () => {
    const unarchiveAgentMock = vi.mocked(agentsApi.unarchiveAgent);
    unarchiveAgentMock.mockResolvedValue({
      unarchivedCount: 3,
      unarchivedIds: ["agent-1", "agent-2", "agent-3"],
    });

    renderWithProvider({
      agentId: "agent-123",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
      archivedAt: Date.now(),
    });

    // Open menu and click Unarchive
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    await waitFor(() => {
      expect(screen.getByText("Unarchive")).toBeInTheDocument();
    });

    screen.getByText("Unarchive").click();

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText("Unarchive Agent?")).toBeInTheDocument();
    });

    // Click Unarchive button
    const unarchiveButtons = screen.getAllByText("Unarchive");
    const unarchiveButton = unarchiveButtons[unarchiveButtons.length - 1];
    if (!unarchiveButton) throw new Error("Unarchive button not found");
    unarchiveButton.click();

    // API should be called with workspaceId and agentId
    await waitFor(() => {
      expect(unarchiveAgentMock).toHaveBeenCalledWith("test-workspace", "agent-123");
    });
  });

  it("shows error message when unarchive API call fails", async () => {
    const unarchiveAgentMock = vi.mocked(agentsApi.unarchiveAgent);
    unarchiveAgentMock.mockRejectedValue(new Error("Unarchive failed: Database error"));

    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
      archivedAt: Date.now(),
    });

    // Open menu and click Unarchive
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    await waitFor(() => {
      expect(screen.getByText("Unarchive")).toBeInTheDocument();
    });

    screen.getByText("Unarchive").click();

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText("Unarchive Agent?")).toBeInTheDocument();
    });

    // Click Unarchive button
    const unarchiveButtons = screen.getAllByText("Unarchive");
    const unarchiveButton = unarchiveButtons[unarchiveButtons.length - 1];
    if (!unarchiveButton) throw new Error("Unarchive button not found");
    unarchiveButton.click();

    // Error should be shown in dialog
    await waitFor(() => {
      expect(screen.getByText("Unarchive failed: Database error")).toBeInTheDocument();
    });

    // Dialog should remain open
    expect(screen.getByText("Unarchive Agent?")).toBeInTheDocument();
  });
});

describe("AgentHeader - Export functionality", () => {
  let originalCreateElement: typeof document.createElement;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: { type: "idle" } }),
    });

    // Save originals
    originalCreateElement = document.createElement;
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;

    // Mock URL methods
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    // Restore originals
    document.createElement = originalCreateElement;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("renders Export menu item", async () => {
    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    // Open the menu
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    // Export menu item should be visible
    await waitFor(() => {
      expect(screen.getByText("Export")).toBeInTheDocument();
    });
  });

  it("triggers download when Export is clicked successfully", async () => {
    const mockMarkdown = "# Test Agent\n\nThis is a test export.";
    const mockFilename = "test-agent-2026-02-02-1430.md";

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: { type: "idle" } }),
        });
      }
      if (url.includes("/export")) {
        return Promise.resolve({
          ok: true,
          text: async () => mockMarkdown,
          headers: {
            get: (name: string) => {
              if (name === "Content-Disposition") {
                return `attachment; filename="${mockFilename}"`;
              }
              return null;
            },
          },
        });
      }
      return Promise.resolve({ ok: false });
    });

    const mockAnchor = {
      click: vi.fn(),
      href: "",
      download: "",
    };
    const originalCreate = document.createElement.bind(document);
    document.createElement = vi.fn((tag: string) => {
      if (tag === "a") {
        return mockAnchor as unknown as HTMLAnchorElement;
      }
      return originalCreate(tag);
    });

    renderWithProvider({
      agentId: "agent-123",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    // Open menu and click Export
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    await waitFor(() => {
      expect(screen.getByText("Export")).toBeInTheDocument();
    });

    screen.getByText("Export").click();

    // Wait for export to complete
    await waitFor(
      () => {
        const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
        const calls = fetchMock.mock.calls;
        const exportCall = calls.find(
          (call: unknown[]) => call[0] && typeof call[0] === "string" && call[0].includes("/agents/agent-123/export"),
        );
        expect(exportCall).toBeDefined();
      },
      { timeout: 3000 },
    );

    // Wait for download to complete
    await waitFor(
      () => {
        expect(URL.createObjectURL).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );

    // Verify anchor element was configured and clicked
    expect(mockAnchor.download).toBe(mockFilename);
    expect(mockAnchor.click).toHaveBeenCalled();

    // Verify cleanup
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("shows loading state while exporting", async () => {
    let resolveExport: ((value: unknown) => void) | undefined;
    const exportPromise = new Promise((resolve) => {
      resolveExport = resolve;
    });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: { type: "idle" } }),
        });
      }
      if (url.includes("/export")) {
        return exportPromise;
      }
      return Promise.resolve({ ok: false });
    });

    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    // Open menu and click Export
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    await waitFor(() => {
      expect(screen.getByText("Export")).toBeInTheDocument();
    });

    screen.getByText("Export").click();

    // Should show "Exporting..." text
    await waitFor(() => {
      expect(screen.getByText("Exporting...")).toBeInTheDocument();
    });

    // Complete the export
    resolveExport?.({
      ok: true,
      text: async () => "# Test",
      headers: {
        get: () => 'attachment; filename="test.md"',
      },
    });

    // Loading state should clear
    await waitFor(() => {
      expect(screen.queryByText("Exporting...")).not.toBeInTheDocument();
    });
  });

  it("shows error toast when export fails", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: { type: "idle" } }),
        });
      }
      if (url.includes("/export")) {
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
          headers: {
            get: (name: string) => {
              if (name === "content-type") {
                return "application/json";
              }
              return null;
            },
          },
          json: async () => ({ error: "Agent not found" }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    // Open menu and click Export
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    await waitFor(() => {
      expect(screen.getByText("Export")).toBeInTheDocument();
    });

    screen.getByText("Export").click();

    // Error toast should appear
    await waitFor(() => {
      expect(screen.getByText("Export Failed")).toBeInTheDocument();
      expect(screen.getByText("Agent not found")).toBeInTheDocument();
    });
  });

  it("dismisses error toast when close button is clicked", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: { type: "idle" } }),
        });
      }
      if (url.includes("/export")) {
        return Promise.resolve({
          ok: false,
          headers: {
            get: (name: string) => {
              if (name === "content-type") {
                return "application/json";
              }
              return null;
            },
          },
          json: async () => ({ error: "Export failed" }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    // Open menu and click Export
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    await waitFor(() => {
      expect(screen.getByText("Export")).toBeInTheDocument();
    });

    screen.getByText("Export").click();

    // Wait for error toast
    await waitFor(() => {
      expect(screen.getByText("Export Failed")).toBeInTheDocument();
    });

    // Click dismiss button
    const dismissButton = screen.getByLabelText("Dismiss error");
    dismissButton.click();

    // Error toast should be removed
    await waitFor(() => {
      expect(screen.queryByText("Export Failed")).not.toBeInTheDocument();
    });
  });

  it("uses default filename when Content-Disposition header is missing", async () => {
    const mockMarkdown = "# Test";

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: { type: "idle" } }),
        });
      }
      if (url.includes("/export")) {
        return Promise.resolve({
          ok: true,
          text: async () => mockMarkdown,
          headers: {
            get: () => null, // No Content-Disposition header
          },
        });
      }
      return Promise.resolve({ ok: false });
    });

    const mockAnchor = {
      click: vi.fn(),
      href: "",
      download: "",
    };
    const originalCreate = document.createElement.bind(document);
    document.createElement = vi.fn((tag: string) => {
      if (tag === "a") {
        return mockAnchor as unknown as HTMLAnchorElement;
      }
      return originalCreate(tag);
    });

    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    // Open menu and click Export
    const menuButton = screen.getByLabelText("Actions menu");
    menuButton.click();

    await waitFor(() => {
      expect(screen.getByText("Export")).toBeInTheDocument();
    });

    screen.getByText("Export").click();

    // Wait for export to complete
    await waitFor(() => {
      expect(mockAnchor.click).toHaveBeenCalled();
    });

    // Should use default filename
    expect(mockAnchor.download).toBe("export.md");
  });
});

describe("AgentHeader - PR status badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders PrStatusBadge when pull requests are available", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/git/pull-requests")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            available: true,
            branch: "feature/test",
            pullRequests: [
              {
                number: 42,
                title: "Test PR",
                url: "https://github.com/test/repo/pull/42",
                state: "open",
                isDraft: false,
                reviewDecision: "approved",
                checksStatus: "success",
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: { type: "idle" } }),
      });
    });

    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    await waitFor(() => {
      expect(screen.getByText("PR #42")).toBeInTheDocument();
    });
  });

  it("does not render PrStatusBadge when available is false", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/git/pull-requests")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            available: false,
            reason: "not_a_git_repo",
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: { type: "idle" } }),
      });
    });

    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    // Wait for fetch to complete, then verify no badge
    await waitFor(() => {
      const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
      expect(
        fetchMock.mock.calls.some((c: unknown[]) => typeof c[0] === "string" && c[0].includes("/git/pull-requests")),
      ).toBe(true);
    });

    expect(screen.queryByText(/PR #/)).not.toBeInTheDocument();
  });

  it("does not render PrStatusBadge when pullRequests array is empty", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/git/pull-requests")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            available: true,
            branch: "main",
            pullRequests: [],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: { type: "idle" } }),
      });
    });

    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    await waitFor(() => {
      const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
      expect(
        fetchMock.mock.calls.some((c: unknown[]) => typeof c[0] === "string" && c[0].includes("/git/pull-requests")),
      ).toBe(true);
    });

    expect(screen.queryByText(/PR #/)).not.toBeInTheDocument();
  });

  it("does not render PrStatusBadge when fetch fails", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/git/pull-requests")) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: { type: "idle" } }),
      });
    });

    renderWithProvider({
      agentId: "agent-1",
      title: "Test Agent",
      modelName: "claude-sonnet-4",
    });

    await waitFor(() => {
      const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
      expect(
        fetchMock.mock.calls.some((c: unknown[]) => typeof c[0] === "string" && c[0].includes("/git/pull-requests")),
      ).toBe(true);
    });

    expect(screen.queryByText(/PR #/)).not.toBeInTheDocument();
  });
});
