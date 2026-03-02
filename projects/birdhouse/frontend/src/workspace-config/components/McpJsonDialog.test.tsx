// ABOUTME: Unit tests for McpJsonDialog component
// ABOUTME: Tests JSON validation, error display, save/cancel flow, form reset, and disabled states

import { render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import McpJsonDialog from "./McpJsonDialog";

describe("McpJsonDialog", () => {
  const mockProps = {
    open: true,
    onOpenChange: vi.fn(),
    initialJson: "",
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Dialog Rendering", () => {
    it("renders dialog when open is true", () => {
      render(() => <McpJsonDialog {...mockProps} open={true} />);
      expect(screen.getByText("MCP Server Configuration")).toBeInTheDocument();
    });

    it("does not render dialog content when open is false", () => {
      render(() => <McpJsonDialog {...mockProps} open={false} />);
      expect(screen.queryByText("MCP Server Configuration")).not.toBeInTheDocument();
    });

    it("renders close button (X)", () => {
      render(() => <McpJsonDialog {...mockProps} />);
      const closeButton = screen.getByText("×");
      expect(closeButton).toBeInTheDocument();
    });

    it("renders Cancel button", () => {
      render(() => <McpJsonDialog {...mockProps} />);
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("renders Save button", () => {
      render(() => <McpJsonDialog {...mockProps} />);
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });
  });

  describe("Initial JSON Display", () => {
    it("displays initialJson in textarea when provided", () => {
      const initialJson = JSON.stringify(
        {
          filesystem: {
            type: "local",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem"],
          },
        },
        null,
        2,
      );

      render(() => <McpJsonDialog {...mockProps} initialJson={initialJson} />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toBe(initialJson);
    });

    it("displays empty textarea when initialJson is empty string", () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toBe("");
    });

    it("displays placeholder text in empty textarea", () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.placeholder).toContain("linear");
    });
  });

  describe("Form Reset", () => {
    it("resets form with initialJson when dialog opens", async () => {
      const initialJson = '{"filesystem": {"type": "local"}}';
      const { unmount } = render(() => <McpJsonDialog {...mockProps} open={false} initialJson="" />);

      unmount();

      render(() => <McpJsonDialog {...mockProps} open={true} initialJson={initialJson} />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toBe(initialJson);
    });

    it("clears error state when dialog opens", async () => {
      const validJson = '{"filesystem": {"type": "local"}}';

      const { unmount } = render(() => <McpJsonDialog {...mockProps} open={true} initialJson="" />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      // Enter invalid JSON and blur to trigger error
      textarea.value = "{invalid}";
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        expect(screen.getByText(/JSON Parse Error/i)).toBeInTheDocument();
      });

      unmount();

      // Reopen dialog with valid JSON
      render(() => <McpJsonDialog {...mockProps} open={true} initialJson={validJson} />);

      // Error should be cleared
      expect(screen.queryByText(/JSON Parse Error/i)).not.toBeInTheDocument();
    });
  });

  describe("JSON Validation on Blur", () => {
    it("shows error message when invalid JSON is entered and textarea is blurred", async () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      textarea.value = "{invalid json}";
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        expect(screen.getByText(/JSON Parse Error/i)).toBeInTheDocument();
      });
    });

    it("does not show error message before blur", () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      textarea.value = "{invalid json}";
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));

      expect(screen.queryByText(/JSON Parse Error/i)).not.toBeInTheDocument();
    });

    it("clears error message when valid JSON is entered and blurred", async () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      // Enter invalid JSON and blur
      textarea.value = "{invalid}";
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        expect(screen.getByText(/JSON Parse Error/i)).toBeInTheDocument();
      });

      // Enter valid JSON and blur
      textarea.value = '{"filesystem": {"type": "local"}}';
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        expect(screen.queryByText(/JSON Parse Error/i)).not.toBeInTheDocument();
      });
    });

    it("does not show error when empty JSON is blurred", async () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      textarea.value = "";
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        expect(screen.queryByText(/JSON Parse Error/i)).not.toBeInTheDocument();
      });
    });

    it("does not show error when whitespace-only JSON is blurred", async () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      textarea.value = "   \n  \t  ";
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        expect(screen.queryByText(/JSON Parse Error/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("JSON Validation on Save", () => {
    it("does not call onSave when invalid JSON and Save button is clicked", () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      textarea.value = "{invalid json}";
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));

      const saveButton = screen.getByRole("button", { name: "Save" });
      saveButton.click();

      expect(mockProps.onSave).not.toHaveBeenCalled();
    });

    it("calls onSave with empty object when empty JSON and Save button is clicked", () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const saveButton = screen.getByRole("button", { name: "Save" });
      saveButton.click();

      expect(mockProps.onSave).toHaveBeenCalledWith({});
    });

    it("shows error message when attempting to save invalid JSON", async () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      textarea.value = "{invalid}";
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));

      const saveButton = screen.getByRole("button", { name: "Save" });
      saveButton.click();

      await waitFor(() => {
        expect(screen.getByText(/JSON Parse Error/i)).toBeInTheDocument();
      });
    });
  });

  describe("Valid JSON Save", () => {
    it("calls onSave with parsed object when valid JSON is saved", () => {
      const validJson = JSON.stringify({
        filesystem: {
          type: "local",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
          enabled: true,
        },
      });

      render(() => <McpJsonDialog {...mockProps} initialJson={validJson} />);
      const saveButton = screen.getByRole("button", { name: "Save" });
      saveButton.click();

      expect(mockProps.onSave).toHaveBeenCalledOnce();
      expect(mockProps.onSave).toHaveBeenCalledWith({
        filesystem: {
          type: "local",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
          enabled: true,
        },
      });
    });

    it("calls onSave with parsed object for complex nested JSON", () => {
      const complexJson = JSON.stringify({
        filesystem: {
          type: "local",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
          env: {
            PATH: "/usr/local/bin",
          },
        },
        github: {
          type: "remote",
          url: "https://example.com",
          enabled: false,
        },
      });

      render(() => <McpJsonDialog {...mockProps} initialJson={complexJson} />);
      const saveButton = screen.getByRole("button", { name: "Save" });
      saveButton.click();

      expect(mockProps.onSave).toHaveBeenCalledWith({
        filesystem: {
          type: "local",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
          env: {
            PATH: "/usr/local/bin",
          },
        },
        github: {
          type: "remote",
          url: "https://example.com",
          enabled: false,
        },
      });
    });
  });

  describe("Error Display", () => {
    it("displays error icon with error message", async () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      textarea.value = "{invalid}";
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        expect(screen.getByText("⚠")).toBeInTheDocument();
        expect(screen.getByText(/JSON Parse Error/i)).toBeInTheDocument();
      });
    });

    it("does not display error when JSON is valid", async () => {
      const validJson = '{"filesystem": {"type": "local"}}';
      render(() => <McpJsonDialog {...mockProps} initialJson={validJson} />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        expect(screen.queryByText("⚠")).not.toBeInTheDocument();
        expect(screen.queryByText(/JSON Parse Error/i)).not.toBeInTheDocument();
      });
    });

    it("hides error when valid JSON replaces invalid JSON", async () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      // Invalid JSON
      textarea.value = "{invalid}";
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        expect(screen.getByText(/JSON Parse Error/i)).toBeInTheDocument();
      });

      // Valid JSON
      textarea.value = '{"filesystem": {"type": "local"}}';
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        expect(screen.queryByText(/JSON Parse Error/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("Cancel Behavior", () => {
    it("calls onOpenChange(false) when Cancel button is clicked", () => {
      render(() => <McpJsonDialog {...mockProps} />);
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      cancelButton.click();

      expect(mockProps.onOpenChange).toHaveBeenCalledOnce();
      expect(mockProps.onOpenChange).toHaveBeenCalledWith(false);
    });

    it("does not call onSave when Cancel button is clicked", () => {
      const validJson = '{"filesystem": {"type": "local"}}';
      render(() => <McpJsonDialog {...mockProps} initialJson={validJson} />);
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      cancelButton.click();

      expect(mockProps.onSave).not.toHaveBeenCalled();
    });

    it("calls onOpenChange(false) when close button (X) is clicked", () => {
      render(() => <McpJsonDialog {...mockProps} />);
      const closeButton = screen.getByText("×").closest("button") as HTMLButtonElement;
      closeButton.click();

      expect(mockProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Save Button Disabled State", () => {
    it("Save button is enabled when JSON is empty", () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const saveButton = screen.getByRole("button", { name: "Save" });
      expect(saveButton).not.toBeDisabled();
    });

    it("Save button is enabled when JSON is only whitespace", async () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      textarea.value = "   \n  ";
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));

      const saveButton = screen.getByRole("button", { name: "Save" });
      expect(saveButton).not.toBeDisabled();
    });

    it("Save button is disabled when JSON is invalid", async () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      textarea.value = "{invalid json}";
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        const saveButton = screen.getByRole("button", { name: "Save" });
        expect(saveButton).toBeDisabled();
      });
    });

    it("Save button is enabled when JSON is valid", async () => {
      const validJson = '{"filesystem": {"type": "local"}}';
      render(() => <McpJsonDialog {...mockProps} initialJson={validJson} />);

      const saveButton = screen.getByRole("button", { name: "Save" });
      expect(saveButton).not.toBeDisabled();
    });

    it("Save button becomes enabled after fixing invalid JSON", async () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      // Enter invalid JSON
      textarea.value = "{invalid}";
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        const saveButton = screen.getByRole("button", { name: "Save" });
        expect(saveButton).toBeDisabled();
      });

      // Fix JSON
      textarea.value = '{"filesystem": {"type": "local"}}';
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        const saveButton = screen.getByRole("button", { name: "Save" });
        expect(saveButton).not.toBeDisabled();
      });
    });

    it("Save button is enabled initially before user interacts", () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const saveButton = screen.getByRole("button", { name: "Save" });
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe("Empty JSON", () => {
    it("does not show error for empty JSON after blur", async () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        expect(screen.queryByText(/JSON Parse Error/i)).not.toBeInTheDocument();
      });
    });

    it("allows saving when JSON is empty", () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const saveButton = screen.getByRole("button", { name: "Save" });

      saveButton.click();

      expect(mockProps.onSave).toHaveBeenCalledWith({});
    });

    it("does not show error for empty textarea", async () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      textarea.value = "";
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        expect(screen.queryByText(/JSON Parse Error/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles JSON with special characters", () => {
      const jsonWithSpecialChars = JSON.stringify({
        "server-with-dashes": {
          type: "local",
          command: "npx",
        },
      });

      render(() => <McpJsonDialog {...mockProps} initialJson={jsonWithSpecialChars} />);
      const saveButton = screen.getByRole("button", { name: "Save" });
      saveButton.click();

      expect(mockProps.onSave).toHaveBeenCalledWith({
        "server-with-dashes": {
          type: "local",
          command: "npx",
        },
      });
    });

    it("handles JSON array values", () => {
      const jsonWithArrays = JSON.stringify({
        filesystem: {
          type: "local",
          args: ["arg1", "arg2", "arg3"],
        },
      });

      render(() => <McpJsonDialog {...mockProps} initialJson={jsonWithArrays} />);
      const saveButton = screen.getByRole("button", { name: "Save" });
      saveButton.click();

      expect(mockProps.onSave).toHaveBeenCalledWith({
        filesystem: {
          type: "local",
          args: ["arg1", "arg2", "arg3"],
        },
      });
    });

    it("handles JSON with boolean values", () => {
      const jsonWithBooleans = JSON.stringify({
        filesystem: {
          type: "local",
          enabled: true,
        },
        github: {
          type: "local",
          enabled: false,
        },
      });

      render(() => <McpJsonDialog {...mockProps} initialJson={jsonWithBooleans} />);
      const saveButton = screen.getByRole("button", { name: "Save" });
      saveButton.click();

      expect(mockProps.onSave).toHaveBeenCalledWith({
        filesystem: {
          type: "local",
          enabled: true,
        },
        github: {
          type: "local",
          enabled: false,
        },
      });
    });

    it("handles empty object as valid JSON", () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="{}" />);
      const saveButton = screen.getByRole("button", { name: "Save" });
      saveButton.click();

      expect(mockProps.onSave).toHaveBeenCalledWith({});
    });

    it("displays specific error message from JSON.parse", async () => {
      render(() => <McpJsonDialog {...mockProps} initialJson="" />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      textarea.value = '{"unclosed": "string}';
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("blur", { bubbles: true }));

      await waitFor(() => {
        const errorText = screen.getByText(/JSON Parse Error/i).textContent;
        expect(errorText).toBeTruthy();
        // Should show actual parse error from JSON.parse
      });
    });
  });
});
