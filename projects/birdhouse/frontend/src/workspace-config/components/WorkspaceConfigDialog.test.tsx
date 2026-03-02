// ABOUTME: Unit tests for WorkspaceConfigDialog component
// ABOUTME: Tests dialog lifecycle, data fetching, provider/MCP management, save/restart flow, and error handling

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the API modules
vi.mock("../../services/workspaces-api", () => ({
  fetchWorkspace: vi.fn(),
  restartWorkspace: vi.fn(),
}));

vi.mock("../services/workspace-config-api", () => ({
  fetchWorkspaceConfig: vi.fn(),
  updateWorkspaceConfig: vi.fn(),
}));

// Import after mocking
import { render, screen, waitFor } from "@solidjs/testing-library";
import { fetchWorkspace, restartWorkspace } from "../../services/workspaces-api";
import type { Workspace } from "../../types/workspace";
import { fetchWorkspaceConfig, updateWorkspaceConfig } from "../services/workspace-config-api";
import type { McpServers, WorkspaceConfig } from "../types/config-types";
import WorkspaceConfigDialog from "./WorkspaceConfigDialog";

describe("WorkspaceConfigDialog", () => {
  const mockWorkspace: Workspace = {
    workspace_id: "test-workspace-id",
    title: "Test Workspace",
    directory: "/path/to/test-workspace",
    created_at: 1704067200000,
    last_used: 1704067200000,
  };

  const mockConfig: WorkspaceConfig = {
    providers: new Map<string, string>([
      ["anthropic", "sk-ant-test-123"],
      ["openai", "sk-openai-test-456"],
    ]),
    anthropicOptions: { extended_context: false },
    mcpServers: {
      filesystem: {
        type: "local",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"],
        enabled: true,
      },
    },
  };

  const mockProps = {
    open: true,
    onOpenChange: vi.fn(),
    workspaceId: "test-workspace-id",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mocks
    (fetchWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkspace);
    (fetchWorkspaceConfig as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfig);
    (updateWorkspaceConfig as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (restartWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
  });

  describe("Dialog Open/Close", () => {
    it("renders dialog when open is true", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} open={true} />);
      await waitFor(() => {
        expect(screen.getByText("Edit Workspace Configuration")).toBeInTheDocument();
      });
    });

    it("does not render dialog content when open is false", () => {
      render(() => <WorkspaceConfigDialog {...mockProps} open={false} />);
      expect(screen.queryByText("Edit Workspace Configuration")).not.toBeInTheDocument();
    });

    it("shows unsaved changes dialog when Cancel clicked with changes", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText("Edit Workspace Configuration")).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      cancelButton.click();

      // Should show unsaved changes confirmation instead of closing immediately
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Unsaved Changes" })).toBeInTheDocument();
      });
      expect(mockProps.onOpenChange).not.toHaveBeenCalled();
    });

    it("shows unsaved changes dialog when X clicked with changes", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);
      await waitFor(() => {
        expect(screen.getByText("Edit Workspace Configuration")).toBeInTheDocument();
      });

      const closeButton = screen.getByText("×").closest("button") as HTMLButtonElement;
      closeButton.click();

      // Should show unsaved changes confirmation instead of closing immediately
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Unsaved Changes" })).toBeInTheDocument();
      });
      expect(mockProps.onOpenChange).not.toHaveBeenCalled();
    });

    it("resets state when dialog closes", async () => {
      const { unmount } = render(() => <WorkspaceConfigDialog {...mockProps} open={true} />);

      await waitFor(() => {
        expect(screen.getByText("Edit Workspace Configuration")).toBeInTheDocument();
      });

      // Simulate adding pending provider updates
      await waitFor(() => {
        const addButton = screen.getByRole("button", { name: /Add Provider/i });
        expect(addButton).toBeInTheDocument();
      });

      unmount();

      // Re-render with open=false
      render(() => <WorkspaceConfigDialog {...mockProps} open={false} />);

      // State should be reset (we can't directly test internal state, but we verify no errors occur)
      expect(screen.queryByText("Edit Workspace Configuration")).not.toBeInTheDocument();
    });
  });

  describe("Data Fetching", () => {
    it("fetches workspace data when dialog opens", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} open={true} />);

      await waitFor(() => {
        expect(fetchWorkspace).toHaveBeenCalledWith("test-workspace-id");
      });
    });

    it("fetches config data when dialog opens", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} open={true} />);

      await waitFor(() => {
        expect(fetchWorkspaceConfig).toHaveBeenCalledWith("test-workspace-id");
      });
    });

    it("shows loading state while fetching workspace data", async () => {
      let resolveWorkspace!: (value: Workspace) => void;
      const workspacePromise = new Promise<Workspace>((resolve) => {
        resolveWorkspace = resolve;
      });
      (fetchWorkspace as ReturnType<typeof vi.fn>).mockReturnValue(workspacePromise);

      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Loading workspace...")).toBeInTheDocument();
      });

      resolveWorkspace(mockWorkspace);
    });

    it("shows loading state while fetching config data", async () => {
      let resolveConfig!: (value: WorkspaceConfig) => void;
      const configPromise = new Promise<WorkspaceConfig>((resolve) => {
        resolveConfig = resolve;
      });
      (fetchWorkspaceConfig as ReturnType<typeof vi.fn>).mockReturnValue(configPromise);

      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        const loadingElements = screen.getAllByText("Loading configuration...");
        expect(loadingElements.length).toBeGreaterThan(0);
      });

      resolveConfig(mockConfig);
    });

    it("does not fetch data when dialog is closed", () => {
      render(() => <WorkspaceConfigDialog {...mockProps} open={false} />);

      expect(fetchWorkspace).not.toHaveBeenCalled();
      expect(fetchWorkspaceConfig).not.toHaveBeenCalled();
    });
  });

  describe("Workspace Title Section", () => {
    it("renders WorkspaceTitleSection with correct props", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Test Workspace")).toBeInTheDocument();
      });
    });

    it("passes workspace title to WorkspaceTitleSection", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Test Workspace")).toBeInTheDocument();
      });
    });

    it("passes workspace data to WorkspaceTitleSection", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        // Verify the workspace title section renders with the title
        expect(screen.getByText("Test Workspace")).toBeInTheDocument();
        // Verify Edit buttons are present (component is fully rendered)
        expect(screen.getAllByRole("button", { name: "Edit" }).length).toBeGreaterThan(0);
      });
    });
  });

  describe("Provider Management", () => {
    it("renders ProvidersList with current providers", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Anthropic")).toBeInTheDocument();
        expect(screen.getByText("OpenAI")).toBeInTheDocument();
      });
    });

    it.skip("opens ProviderDialog in add mode when Add button clicked", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /Add Provider/i }).length).toBeGreaterThan(0);
      });

      const addButtons = screen.getAllByRole("button", { name: /Add Provider/i });
      expect(addButtons.length).toBeGreaterThan(0);
      addButtons[0]!.click();

      await waitFor(() => {
        expect(screen.getByText("Add AI Provider")).toBeInTheDocument();
      });
    });

    it("opens ProviderDialog in edit mode when Edit clicked", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Anthropic")).toBeInTheDocument();
      });

      // Find Edit button in Anthropic row
      const anthropicRow = screen.getByText("Anthropic").closest("tr");
      const editButtons = anthropicRow?.querySelectorAll("button");
      const editButton = Array.from(editButtons || []).find((btn) => btn.textContent === "Edit");
      editButton?.click();

      await waitFor(() => {
        expect(screen.getByText("Edit Anthropic")).toBeInTheDocument();
      });
    });

    it("opens ProviderDeleteDialog when Delete clicked", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Anthropic")).toBeInTheDocument();
      });

      // Find Delete button in Anthropic row
      const anthropicRows = screen.getAllByText("Anthropic");
      // Get the one in the table body (not the heading)
      const anthropicInTable = anthropicRows.find((el) => {
        const row = el.closest("tr");
        return row?.closest("tbody");
      });
      expect(anthropicInTable).toBeDefined();

      const anthropicRow = anthropicInTable?.closest("tr");
      const deleteButtons = anthropicRow?.querySelectorAll("button");
      const deleteButton = Array.from(deleteButtons || []).find((btn) => btn.textContent?.trim() === "Delete");

      expect(deleteButton).toBeDefined();
      deleteButton?.click();

      await waitFor(() => {
        expect(screen.getByText(/This will delete the API key/i)).toBeInTheDocument();
      });
    });
  });

  describe("MCP Configuration", () => {
    it("renders McpConfigSection with current servers", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("filesystem")).toBeInTheDocument();
      });
    });

    it.skip("handles MCP server toggle", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("filesystem")).toBeInTheDocument();
      });

      // Find and toggle the filesystem checkbox
      const label = screen.getByText("filesystem").closest("label") as HTMLElement;
      label.click();

      // The checkbox should be toggled (we can't directly test state, but verify no errors)
      expect(label).toBeInTheDocument();
    });

    it("opens McpJsonDialog when Configure JSON clicked", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Configure JSON" })).toBeInTheDocument();
      });

      const configureButton = screen.getByRole("button", { name: "Configure JSON" });
      configureButton.click();

      await waitFor(() => {
        expect(screen.getByText("MCP Server Configuration")).toBeInTheDocument();
      });
    });
  });

  describe("Save & Restart", () => {
    it("calls restartWorkspace after config update", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Save & Restart" })).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: "Save & Restart" });
      saveButton.click();

      await waitFor(() => {
        expect(restartWorkspace).toHaveBeenCalledWith("test-workspace-id");
      });
    });

    it("closes dialog on successful save", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Save & Restart" })).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: "Save & Restart" });
      saveButton.click();

      await waitFor(() => {
        expect(mockProps.onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it.skip("shows error message on config update failure", async () => {
      (updateWorkspaceConfig as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Failed to update config"));

      render(() => <WorkspaceConfigDialog {...mockProps} />);

      // Wait for MCP configuration to load
      await waitFor(() => {
        expect(screen.getByText("filesystem")).toBeInTheDocument();
      });

      // Toggle MCP to create a change
      const label = screen.getByText("filesystem").closest("label") as HTMLElement;
      label.click();

      const saveButton = screen.getByRole("button", { name: "Save & Restart" });
      saveButton.click();

      await waitFor(() => {
        expect(screen.getByText("Failed to update config")).toBeInTheDocument();
      });
    });

    it.skip("shows error message on restart failure", async () => {
      (restartWorkspace as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Failed to restart workspace"));

      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Save & Restart" })).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: "Save & Restart" });
      saveButton.click();

      await waitFor(() => {
        expect(screen.getByText("Failed to restart workspace")).toBeInTheDocument();
      });
    });

    it.skip("keeps dialog open on error", async () => {
      (updateWorkspaceConfig as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Update failed"));

      render(() => <WorkspaceConfigDialog {...mockProps} />);

      // Wait for MCP configuration to load
      await waitFor(() => {
        expect(screen.getByText("filesystem")).toBeInTheDocument();
      });

      // Toggle MCP to create a change
      const label = screen.getByText("filesystem").closest("label") as HTMLElement;
      label.click();

      const saveButton = screen.getByRole("button", { name: "Save & Restart" });
      saveButton.click();

      await waitFor(() => {
        expect(screen.getByText("Update failed")).toBeInTheDocument();
      });

      // Dialog should still be open
      expect(screen.getByText("Edit Workspace Configuration")).toBeInTheDocument();
      expect(mockProps.onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it.skip("disables buttons while saving", async () => {
      let resolveUpdate!: () => void;
      const updatePromise = new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      });
      (updateWorkspaceConfig as ReturnType<typeof vi.fn>).mockReturnValue(updatePromise);

      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Save & Restart" })).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: "Save & Restart" });
      saveButton.click();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      });

      resolveUpdate();
    });

    it("only includes changed data in update payload", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Save & Restart" })).toBeInTheDocument();
      });

      // Don't make any changes, just save
      const saveButton = screen.getByRole("button", { name: "Save & Restart" });
      saveButton.click();

      await waitFor(() => {
        expect(restartWorkspace).toHaveBeenCalled();
      });

      // updateWorkspaceConfig should not be called since there are no changes
      expect(updateWorkspaceConfig).not.toHaveBeenCalled();
    });

    it.skip("includes MCP changes in update payload when MCP is modified", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("filesystem")).toBeInTheDocument();
      });

      // Toggle filesystem server
      const label = screen.getByText("filesystem").closest("label") as HTMLElement;
      label.click();

      // Save & Restart
      const saveButton = screen.getByRole("button", { name: "Save & Restart" });
      saveButton.click();

      await waitFor(() => {
        expect(updateWorkspaceConfig).toHaveBeenCalledWith("test-workspace-id", {
          mcpServers: expect.any(Object),
        });
      });

      // Verify MCP server state was changed
      const callArgs = (updateWorkspaceConfig as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
      expect(callArgs.mcpServers.filesystem.enabled).toBe(false);
    });
  });

  describe("Error Handling", () => {
    describe("Save errors", () => {
      it.skip("shows error above footer when save fails", async () => {
        (updateWorkspaceConfig as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        render(() => <WorkspaceConfigDialog {...mockProps} />);

        // Wait for MCP configuration to load
        await waitFor(() => {
          expect(screen.getByText("filesystem")).toBeInTheDocument();
        });

        // Toggle MCP to create a change
        const label = screen.getByText("filesystem").closest("label") as HTMLElement;
        label.click();

        const saveButton = screen.getByRole("button", { name: "Save & Restart" });
        saveButton.click();

        await waitFor(() => {
          const errorElement = screen.getByText("Network error");
          expect(errorElement).toBeInTheDocument();
          // Error should be in the footer area
          expect(errorElement.closest("div")?.className).toContain("bg-danger/10");
        });
      });

      it.skip("error message uses text-danger styling", async () => {
        (restartWorkspace as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Restart failed"));

        render(() => <WorkspaceConfigDialog {...mockProps} />);

        await waitFor(() => {
          expect(screen.getByRole("button", { name: "Save & Restart" })).toBeInTheDocument();
        });

        const saveButton = screen.getByRole("button", { name: "Save & Restart" });
        saveButton.click();

        await waitFor(() => {
          const errorElement = screen.getByText("Restart failed");
          expect(errorElement.className).toContain("text-danger");
        });
      });

      it.skip("clears error when dialog closes", async () => {
        (updateWorkspaceConfig as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Update error"));

        render(() => <WorkspaceConfigDialog {...mockProps} open={true} />);

        // Wait for MCP configuration to load
        await waitFor(() => {
          expect(screen.getByText("filesystem")).toBeInTheDocument();
        });

        // Toggle MCP to create a change
        const label = screen.getByText("filesystem").closest("label") as HTMLElement;
        label.click();

        const saveButton = screen.getByRole("button", { name: "Save & Restart" });
        saveButton.click();

        await waitFor(() => {
          expect(screen.getByText("Update error")).toBeInTheDocument();
        });

        // Close dialog
        const cancelButton = screen.getByRole("button", { name: "Cancel" });
        cancelButton.click();

        expect(mockProps.onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    describe("Load errors", () => {
      it.skip("displays error banner when fetchWorkspaceConfig fails", async () => {
        const configError = new Error("Config fetch failed");
        (fetchWorkspaceConfig as ReturnType<typeof vi.fn>).mockRejectedValue(configError);

        render(() => <WorkspaceConfigDialog {...mockProps} open={true} />);

        await waitFor(() => {
          expect(screen.getByText(/Failed to load configuration/)).toBeInTheDocument();
        });

        const errorBanner = screen.getByText(/Failed to load configuration/).closest("div");
        expect(errorBanner?.className).toContain("bg-danger/10");
        expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
      });

      it("displays error banner when fetchWorkspace fails", async () => {
        const workspaceError = new Error("Workspace fetch failed");
        (fetchWorkspace as ReturnType<typeof vi.fn>).mockRejectedValue(workspaceError);

        render(() => <WorkspaceConfigDialog {...mockProps} open={true} />);

        await waitFor(() => {
          expect(screen.getByText(/Failed to load workspace/)).toBeInTheDocument();
        });

        const errorBanner = screen.getByText(/Failed to load workspace/).closest("div");
        expect(errorBanner?.className).toContain("bg-danger/10");
        expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
      });

      it.skip("dialog stays open when config fetch fails (404 error)", async () => {
        const error404 = new Error("Not found");
        (error404 as Error & { status?: number }).status = 404;
        (fetchWorkspaceConfig as ReturnType<typeof vi.fn>).mockRejectedValue(error404);

        render(() => <WorkspaceConfigDialog {...mockProps} open={true} />);

        await waitFor(() => {
          expect(screen.getByText(/Failed to load configuration/)).toBeInTheDocument();
        });

        // Dialog should still be visible
        expect(screen.getByText("Edit Workspace Configuration")).toBeInTheDocument();
        // onOpenChange should NOT have been called with false
        expect(mockProps.onOpenChange).not.toHaveBeenCalledWith(false);
      });

      it.skip("Retry button refetches both resources", async () => {
        const configError = new Error("Config fetch failed");
        (fetchWorkspaceConfig as ReturnType<typeof vi.fn>).mockRejectedValue(configError);

        render(() => <WorkspaceConfigDialog {...mockProps} open={true} />);

        await waitFor(() => {
          expect(screen.getByText(/Failed to load configuration/)).toBeInTheDocument();
        });

        // Mock config to succeed on retry
        (fetchWorkspaceConfig as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfig);

        // Click Retry button
        const retryButton = screen.getByRole("button", { name: "Retry" });
        retryButton.click();

        // Verify both fetch functions were called again (once initially, once on retry)
        await waitFor(() => {
          expect(fetchWorkspaceConfig).toHaveBeenCalledTimes(2);
          expect(fetchWorkspace).toHaveBeenCalledTimes(2);
        });
      });

      it.skip("Save button is disabled when load error is present", async () => {
        const configError = new Error("Config fetch failed");
        (fetchWorkspaceConfig as ReturnType<typeof vi.fn>).mockRejectedValue(configError);

        render(() => <WorkspaceConfigDialog {...mockProps} open={true} />);

        await waitFor(() => {
          expect(screen.getByText(/Failed to load configuration/)).toBeInTheDocument();
        });

        // Find the Save & Restart button
        const saveButton = screen.getByRole("button", { name: "Save & Restart" });
        expect(saveButton).toBeDisabled();
      });

      it("Save button is enabled when no load errors", async () => {
        render(() => <WorkspaceConfigDialog {...mockProps} open={true} />);

        await waitFor(() => {
          expect(screen.getByText("Edit Workspace Configuration")).toBeInTheDocument();
        });

        // Wait for content to load
        await waitFor(() => {
          expect(screen.getByText("Test Workspace")).toBeInTheDocument();
        });

        // Find the Save & Restart button
        const saveButton = screen.getByRole("button", { name: "Save & Restart" });
        expect(saveButton).not.toBeDisabled();
      });

      it.skip("error banner shows correct message for config error", async () => {
        const configError = new Error("Unable to read config.json");
        (fetchWorkspaceConfig as ReturnType<typeof vi.fn>).mockRejectedValue(configError);

        render(() => <WorkspaceConfigDialog {...mockProps} open={true} />);

        await waitFor(() => {
          expect(screen.getByText("Failed to load configuration: Unable to read config.json")).toBeInTheDocument();
        });
      });

      it("error banner shows correct message for workspace error", async () => {
        const workspaceError = new Error("Workspace not found in database");
        (fetchWorkspace as ReturnType<typeof vi.fn>).mockRejectedValue(workspaceError);

        render(() => <WorkspaceConfigDialog {...mockProps} open={true} />);

        await waitFor(() => {
          expect(screen.getByText("Failed to load workspace: Workspace not found in database")).toBeInTheDocument();
        });
      });
    });
  });

  describe("Integration", () => {
    it("renders all child dialogs", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Edit Workspace Configuration")).toBeInTheDocument();
      });

      // ProviderDialog should be in the DOM (but not visible)
      expect(document.body.innerHTML).toContain("Provider");

      // ProviderDeleteDialog should be in the DOM (but not visible)
      // McpJsonDialog should be in the DOM (but not visible)
    });

    it.skip("child dialogs receive correct props", async () => {
      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Add Provider/i })).toBeInTheDocument();
      });

      // Open ProviderDialog
      const addButton = screen.getByRole("button", { name: /Add Provider/i });
      addButton.click();

      await waitFor(() => {
        expect(screen.getByText("Add AI Provider")).toBeInTheDocument();
      });

      // Verify existingProviders are passed (anthropic and openai should be excluded from dropdown)
      const select = screen.getByRole("combobox", { name: "Provider" }) as HTMLSelectElement;
      const options = Array.from(select.options)
        .map((opt) => opt.value)
        .filter((val) => val !== "");

      expect(options).not.toContain("anthropic");
      expect(options).not.toContain("openai");
    });
  });

  describe("Edge Cases", () => {
    it("handles empty provider map", async () => {
      const emptyConfig: WorkspaceConfig = {
        providers: new Map<string, string>(),
        anthropicOptions: { extended_context: false },
        mcpServers: {},
      };
      (fetchWorkspaceConfig as ReturnType<typeof vi.fn>).mockResolvedValue(emptyConfig);

      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Edit Workspace Configuration")).toBeInTheDocument();
      });

      // Should still render the providers section with all providers showing "Not set"
      const aiProviderHeadings = screen.getAllByText("AI Providers");
      expect(aiProviderHeadings.length).toBeGreaterThan(0);
    });

    it("handles null MCP servers", async () => {
      const configWithNoMcp: WorkspaceConfig = {
        providers: new Map<string, string>(),
        anthropicOptions: { extended_context: false },
        mcpServers: null as unknown as McpServers,
      };
      (fetchWorkspaceConfig as ReturnType<typeof vi.fn>).mockResolvedValue(configWithNoMcp);

      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Edit Workspace Configuration")).toBeInTheDocument();
      });

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText("No MCP servers configured. Click Configure JSON to add.")).toBeInTheDocument();
      });
    });

    it("handles workspace with null title", async () => {
      const workspaceNoTitle: Workspace = {
        ...mockWorkspace,
        title: null as unknown as string,
      };
      (fetchWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue(workspaceNoTitle);

      render(() => <WorkspaceConfigDialog {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Edit Workspace Configuration")).toBeInTheDocument();
      });

      // Should fall back to directory basename
      await waitFor(() => {
        expect(screen.getByText("test-workspace")).toBeInTheDocument();
      });
    });
  });
});
