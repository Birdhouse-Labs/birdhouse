// ABOUTME: Unit tests for WorkspaceTitleSection component
// ABOUTME: Tests view/edit modes, save/cancel flow, error handling, keyboard shortcuts, and validation

import { render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceTitleSection from "./WorkspaceTitleSection";

// Mock the API module
vi.mock("../services/workspace-config-api", () => ({
  updateWorkspaceTitle: vi.fn(),
}));

// Import after mocking
import { updateWorkspaceTitle } from "../services/workspace-config-api";

describe("WorkspaceTitleSection", () => {
  const mockProps = {
    workspaceId: "test-workspace-id",
    currentTitle: "Test Workspace",
    directory: "/path/to/test-workspace",
    onTitleUpdated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("View Mode Display", () => {
    it("displays currentTitle when provided", () => {
      render(() => <WorkspaceTitleSection {...mockProps} />);
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Test Workspace");
    });

    it("falls back to directory basename when currentTitle is null", () => {
      render(() => <WorkspaceTitleSection {...mockProps} currentTitle={null} />);
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("test-workspace");
    });

    it("falls back to directory basename when currentTitle is empty string", () => {
      render(() => <WorkspaceTitleSection {...mockProps} currentTitle="" />);
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("test-workspace");
    });

    it('shows "Edit" button in view mode', () => {
      render(() => <WorkspaceTitleSection {...mockProps} />);
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    });
  });

  describe("Edit Mode Transition", () => {
    it("clicking Edit button enters edit mode", () => {
      render(() => <WorkspaceTitleSection {...mockProps} />);
      screen.getByRole("button", { name: "Edit" }).click();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("input field appears in edit mode", () => {
      render(() => <WorkspaceTitleSection {...mockProps} />);
      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.placeholder).toBe("Enter workspace title");
    });

    it("Save and Cancel buttons appear in edit mode", () => {
      render(() => <WorkspaceTitleSection {...mockProps} />);
      screen.getByRole("button", { name: "Edit" }).click();
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("input is auto-focused when entering edit mode", async () => {
      render(() => <WorkspaceTitleSection {...mockProps} />);
      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      await waitFor(() => {
        expect(document.activeElement).toBe(input);
      });
    });

    it("input is pre-filled with currentTitle", () => {
      render(() => <WorkspaceTitleSection {...mockProps} />);
      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("Test Workspace");
    });

    it("input is empty when currentTitle is null", () => {
      render(() => <WorkspaceTitleSection {...mockProps} currentTitle={null} />);
      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("");
    });
  });

  describe("Save Success Flow", () => {
    it("clicking Save calls updateWorkspaceTitle API with correct arguments", async () => {
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      screen.getByRole("button", { name: "Save" }).click();

      await waitFor(() => {
        expect(updateWorkspaceTitle).toHaveBeenCalledWith("test-workspace-id", "New Title");
      });
    });

    it("on success: exits edit mode", async () => {
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      screen.getByRole("button", { name: "Save" }).click();

      await waitFor(() => {
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      });
    });

    it("on success: calls onTitleUpdated callback if provided", async () => {
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const onTitleUpdated = vi.fn();
      render(() => <WorkspaceTitleSection {...mockProps} onTitleUpdated={onTitleUpdated} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      screen.getByRole("button", { name: "Save" }).click();

      await waitFor(() => {
        expect(onTitleUpdated).toHaveBeenCalledOnce();
      });
    });

    it('Save button shows "Saving..." text during save', async () => {
      let resolvePromise!: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockReturnValue(promise);

      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      screen.getByRole("button", { name: "Save" }).click();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Saving..." })).toBeInTheDocument();
      });

      resolvePromise();
    });

    it("buttons are disabled during save", async () => {
      let resolvePromise!: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockReturnValue(promise);

      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      screen.getByRole("button", { name: "Save" }).click();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      });

      resolvePromise();
    });
  });

  describe("Save Error Handling", () => {
    it("on API error: shows error message below input", async () => {
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Failed to update title"));
      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      screen.getByRole("button", { name: "Save" }).click();

      await waitFor(() => {
        expect(screen.getByText("Failed to update title")).toBeInTheDocument();
      });
    });

    it("on API error: stays in edit mode", async () => {
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API error"));
      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      screen.getByRole("button", { name: "Save" }).click();

      await waitFor(() => {
        expect(screen.getByText("API error")).toBeInTheDocument();
      });

      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("error clears when user starts typing", async () => {
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API error"));
      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      screen.getByRole("button", { name: "Save" }).click();

      await waitFor(() => {
        expect(screen.getByText("API error")).toBeInTheDocument();
      });

      // User starts typing
      input.value = "New Title Updated";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      await waitFor(() => {
        expect(screen.queryByText("API error")).not.toBeInTheDocument();
      });
    });

    it("error has proper styling (text-danger, border-danger)", async () => {
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API error"));
      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      screen.getByRole("button", { name: "Save" }).click();

      await waitFor(() => {
        const errorElement = screen.getByText("API error").closest("div");
        expect(errorElement?.className).toContain("text-danger");
        expect(errorElement?.className).toContain("border-danger");
      });
    });
  });

  describe("Cancel Functionality", () => {
    it("clicking Cancel exits edit mode", () => {
      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      expect(screen.getByRole("textbox")).toBeInTheDocument();

      screen.getByRole("button", { name: "Cancel" }).click();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("clicking Cancel clears local state and errors", async () => {
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API error"));
      render(() => <WorkspaceTitleSection {...mockProps} />);

      // Enter edit mode, cause error
      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      screen.getByRole("button", { name: "Save" }).click();

      await waitFor(() => {
        expect(screen.getByText("API error")).toBeInTheDocument();
      });

      // Cancel
      screen.getByRole("button", { name: "Cancel" }).click();

      // Re-enter edit mode - error should be cleared
      screen.getByRole("button", { name: "Edit" }).click();
      expect(screen.queryByText("API error")).not.toBeInTheDocument();
    });

    it("Cancel button is disabled during save", async () => {
      let resolvePromise!: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockReturnValue(promise);

      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      screen.getByRole("button", { name: "Save" }).click();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      });

      resolvePromise();
    });
  });

  describe("Keyboard Shortcuts", () => {
    it("Enter key triggers save when input is not empty", async () => {
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );

      await waitFor(() => {
        expect(updateWorkspaceTitle).toHaveBeenCalledWith("test-workspace-id", "New Title");
      });
    });

    it("Enter key does nothing when input is empty", async () => {
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );

      await waitFor(() => {
        expect(updateWorkspaceTitle).not.toHaveBeenCalled();
      });
    });

    it("Enter key does nothing when input contains only whitespace", async () => {
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "   ";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );

      await waitFor(() => {
        expect(updateWorkspaceTitle).not.toHaveBeenCalled();
      });
    });

    it("Escape key triggers cancel", () => {
      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      expect(screen.getByRole("textbox")).toBeInTheDocument();

      const input = screen.getByRole("textbox");
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("Escape key clears error state", async () => {
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API error"));
      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      screen.getByRole("button", { name: "Save" }).click();

      await waitFor(() => {
        expect(screen.getByText("API error")).toBeInTheDocument();
      });

      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );

      expect(screen.queryByText("API error")).not.toBeInTheDocument();
    });
  });

  describe("Input Validation", () => {
    it("Save button is disabled when input is empty", () => {
      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("Save button is disabled when input contains only whitespace", () => {
      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "   ";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("Save button is enabled when input has valid content", () => {
      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "Valid Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
    });
  });

  describe("Loading States", () => {
    it("input is disabled during save", async () => {
      let resolvePromise!: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockReturnValue(promise);

      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      screen.getByRole("button", { name: "Save" }).click();

      await waitFor(() => {
        expect(input).toBeDisabled();
      });

      resolvePromise();
    });

    it("Save button is disabled during save", async () => {
      let resolvePromise!: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockReturnValue(promise);

      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      screen.getByRole("button", { name: "Save" }).click();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
      });

      resolvePromise();
    });

    it("Cancel button is disabled during save", async () => {
      let resolvePromise!: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      (updateWorkspaceTitle as ReturnType<typeof vi.fn>).mockReturnValue(promise);

      render(() => <WorkspaceTitleSection {...mockProps} />);

      screen.getByRole("button", { name: "Edit" }).click();
      const input = screen.getByRole("textbox") as HTMLInputElement;
      input.value = "New Title";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      screen.getByRole("button", { name: "Save" }).click();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
      });

      resolvePromise();
    });
  });
});
