// ABOUTME: Unit tests for ProviderDialog component
// ABOUTME: Tests add/edit modes, API key validation, save/cancel flow, and Get API Key links

import { render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProviderDialog from "./ProviderDialog";

describe("ProviderDialog", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Add Mode - Rendering", () => {
    const addModeProps = {
      open: true,
      onOpenChange: mockOnOpenChange,
      providerId: "google",
      hasExistingKey: false,
      onSave: mockOnSave,
    };

    it('displays title "Add [ProviderName]"', () => {
      render(() => <ProviderDialog {...addModeProps} />);
      expect(screen.getByText("Add Google AI")).toBeInTheDocument();
    });

    it("shows API key input field", () => {
      render(() => <ProviderDialog {...addModeProps} />);
      expect(screen.getByPlaceholderText("Enter API key")).toBeInTheDocument();
    });

    it('shows "Add Provider" button', () => {
      render(() => <ProviderDialog {...addModeProps} />);
      expect(screen.getByRole("button", { name: "Add Provider" })).toBeInTheDocument();
    });

    it('shows "Cancel" button', () => {
      render(() => <ProviderDialog {...addModeProps} />);
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("shows close button (X)", () => {
      render(() => <ProviderDialog {...addModeProps} />);
      const closeButton = screen.getByText("×");
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe("Add Mode - Validation", () => {
    const addModeProps = {
      open: true,
      onOpenChange: mockOnOpenChange,
      providerId: "google",
      hasExistingKey: false,
      onSave: mockOnSave,
    };

    it("Save button disabled when API key empty", () => {
      render(() => <ProviderDialog {...addModeProps} />);
      const saveButton = screen.getByRole("button", { name: "Add Provider" });
      expect(saveButton).toBeDisabled();
    });

    it("Save button enabled when API key is provided", () => {
      render(() => <ProviderDialog {...addModeProps} />);
      const apiKeyInput = screen.getByPlaceholderText("Enter API key") as HTMLInputElement;

      apiKeyInput.value = "test-api-key";
      apiKeyInput.dispatchEvent(new InputEvent("input", { bubbles: true }));

      const saveButton = screen.getByRole("button", { name: "Add Provider" });
      expect(saveButton).not.toBeDisabled();
    });

    it("Save button disabled when API key is only whitespace", () => {
      render(() => <ProviderDialog {...addModeProps} />);
      const apiKeyInput = screen.getByPlaceholderText("Enter API key") as HTMLInputElement;

      apiKeyInput.value = "   ";
      apiKeyInput.dispatchEvent(new InputEvent("input", { bubbles: true }));

      const saveButton = screen.getByRole("button", { name: "Add Provider" });
      expect(saveButton).toBeDisabled();
    });
  });

  describe("Add Mode - Save Callback", () => {
    const addModeProps = {
      open: true,
      onOpenChange: mockOnOpenChange,
      providerId: "google",
      hasExistingKey: false,
      onSave: mockOnSave,
    };

    it("calls onSave with correct providerId and apiKey", () => {
      render(() => <ProviderDialog {...addModeProps} />);
      const apiKeyInput = screen.getByPlaceholderText("Enter API key") as HTMLInputElement;

      apiKeyInput.value = "my-google-api-key";
      apiKeyInput.dispatchEvent(new InputEvent("input", { bubbles: true }));

      const saveButton = screen.getByRole("button", { name: "Add Provider" });
      saveButton.click();

      expect(mockOnSave).toHaveBeenCalledWith("google", "my-google-api-key");
    });
  });

  describe("Add Mode - Get API Key Link", () => {
    it("shows Get API Key link when provider has docUrl", () => {
      const addModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "google",
        hasExistingKey: false,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...addModeProps} />);
      const link = screen.getByRole("link", { name: /Get API Key/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "https://makersuite.google.com/app/apikey");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("does not show Get API Key link when provider is invalid", () => {
      const addModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "invalid-provider-no-docurl",
        hasExistingKey: false,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...addModeProps} />);
      expect(screen.queryByRole("link", { name: /Get API Key/i })).not.toBeInTheDocument();
    });
  });

  describe("Edit Mode - Rendering", () => {
    const editModeProps = {
      open: true,
      onOpenChange: mockOnOpenChange,
      providerId: "anthropic",
      hasExistingKey: true,
      onSave: mockOnSave,
    };

    it('displays title "Edit [ProviderName]"', () => {
      render(() => <ProviderDialog {...editModeProps} />);
      expect(screen.getByText("Edit Anthropic")).toBeInTheDocument();
    });

    it("shows API key input field", () => {
      render(() => <ProviderDialog {...editModeProps} />);
      expect(screen.getByPlaceholderText("Enter API key")).toBeInTheDocument();
    });

    it('shows "Save" button', () => {
      render(() => <ProviderDialog {...editModeProps} />);
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });

    it('shows "Cancel" button', () => {
      render(() => <ProviderDialog {...editModeProps} />);
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });
  });

  describe("Edit Mode - Validation", () => {
    it("Save button enabled if API key empty AND hasExistingKey is true", () => {
      const editModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "anthropic",
        hasExistingKey: true,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...editModeProps} />);
      const saveButton = screen.getByRole("button", { name: "Save" });
      expect(saveButton).not.toBeDisabled();
    });

    it("Save button disabled if API key empty AND hasExistingKey is false", () => {
      const editModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "anthropic",
        hasExistingKey: false,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...editModeProps} />);
      const saveButton = screen.getByRole("button", { name: "Add Provider" });
      expect(saveButton).toBeDisabled();
    });

    it("Save button enabled if API key has value", () => {
      const editModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "anthropic",
        hasExistingKey: false,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...editModeProps} />);
      const apiKeyInput = screen.getByPlaceholderText("Enter API key") as HTMLInputElement;

      apiKeyInput.value = "new-api-key";
      apiKeyInput.dispatchEvent(new InputEvent("input", { bubbles: true }));

      const saveButton = screen.getByRole("button", { name: "Add Provider" });
      expect(saveButton).not.toBeDisabled();
    });

    it("Save button disabled if API key is only whitespace", () => {
      const editModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "anthropic",
        hasExistingKey: false,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...editModeProps} />);
      const apiKeyInput = screen.getByPlaceholderText("Enter API key") as HTMLInputElement;

      apiKeyInput.value = "   ";
      apiKeyInput.dispatchEvent(new InputEvent("input", { bubbles: true }));

      const saveButton = screen.getByRole("button", { name: "Add Provider" });
      expect(saveButton).toBeDisabled();
    });
  });

  describe("Edit Mode - Pre-populating currentKey", () => {
    it("populates API key input with currentKey when provided", () => {
      const editModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "anthropic",
        hasExistingKey: true,
        currentKey: "existing-api-key-123",
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...editModeProps} />);
      const apiKeyInput = screen.getByPlaceholderText("Enter API key") as HTMLInputElement;
      expect(apiKeyInput.value).toBe("existing-api-key-123");
    });

    it("leaves API key input empty when currentKey is undefined", () => {
      const editModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "anthropic",
        hasExistingKey: true,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...editModeProps} />);
      const apiKeyInput = screen.getByPlaceholderText("Enter API key") as HTMLInputElement;
      expect(apiKeyInput.value).toBe("");
    });

    it("leaves API key input empty when currentKey is empty string", () => {
      const editModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "anthropic",
        hasExistingKey: true,
        currentKey: "",
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...editModeProps} />);
      const apiKeyInput = screen.getByPlaceholderText("Enter API key") as HTMLInputElement;
      expect(apiKeyInput.value).toBe("");
    });
  });

  describe("Edit Mode - Save Callback", () => {
    it("calls onSave with providerId and new apiKey", () => {
      const editModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "anthropic",
        hasExistingKey: true,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...editModeProps} />);
      const apiKeyInput = screen.getByPlaceholderText("Enter API key") as HTMLInputElement;

      apiKeyInput.value = "new-anthropic-key";
      apiKeyInput.dispatchEvent(new InputEvent("input", { bubbles: true }));

      const saveButton = screen.getByRole("button", { name: "Save" });
      saveButton.click();

      expect(mockOnSave).toHaveBeenCalledWith("anthropic", "new-anthropic-key", false);
    });

    it("calls onSave with providerId and empty string when keeping existing key", () => {
      const editModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "anthropic",
        hasExistingKey: true,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...editModeProps} />);
      const saveButton = screen.getByRole("button", { name: "Save" });
      saveButton.click();

      expect(mockOnSave).toHaveBeenCalledWith("anthropic", "", false);
    });
  });

  describe("Edit Mode - Get API Key Link", () => {
    it("shows Get API Key link when provider has docUrl", () => {
      const editModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "anthropic",
        hasExistingKey: true,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...editModeProps} />);
      const link = screen.getByRole("link", { name: /Get API Key/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "https://console.anthropic.com/");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("Both Modes - Cancel Button", () => {
    it("Cancel button calls onOpenChange(false) in add mode", () => {
      const addModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "google",
        hasExistingKey: false,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...addModeProps} />);
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      cancelButton.click();

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it("Cancel button calls onOpenChange(false) in edit mode", () => {
      const editModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "anthropic",
        hasExistingKey: true,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...editModeProps} />);
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      cancelButton.click();

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Both Modes - Close Button (X)", () => {
    it("Close button calls onOpenChange(false) in add mode", () => {
      const addModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "google",
        hasExistingKey: false,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...addModeProps} />);
      const closeButton = screen.getByText("×").closest("button") as HTMLButtonElement;
      closeButton.click();

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it("Close button calls onOpenChange(false) in edit mode", () => {
      const editModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "anthropic",
        hasExistingKey: true,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...editModeProps} />);
      const closeButton = screen.getByText("×").closest("button") as HTMLButtonElement;
      closeButton.click();

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Both Modes - PasswordInput Integration", () => {
    it("uses PasswordInput component with correct props in add mode", () => {
      const addModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "google",
        hasExistingKey: false,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...addModeProps} />);
      const passwordInput = screen.getByPlaceholderText("Enter API key");
      expect(passwordInput).toBeInTheDocument();
      expect(passwordInput).toHaveAttribute("type", "password");
    });

    it("uses PasswordInput component with correct props in edit mode", () => {
      const editModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "anthropic",
        hasExistingKey: true,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...editModeProps} />);
      const passwordInput = screen.getByPlaceholderText("Enter API key");
      expect(passwordInput).toBeInTheDocument();
      expect(passwordInput).toHaveAttribute("type", "password");
    });

    it("PasswordInput toggle button works in add mode", () => {
      const addModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "google",
        hasExistingKey: false,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...addModeProps} />);
      const toggleButton = screen.getByRole("button", { name: "Show password" });
      toggleButton.click();

      const input = screen.getByPlaceholderText("Enter API key") as HTMLInputElement;
      expect(input.type).toBe("text");
    });
  });

  describe("Edge Cases", () => {
    it("edit mode with invalid providerId shows generic title", () => {
      const editModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "invalid-provider-id",
        hasExistingKey: true,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...editModeProps} />);
      expect(screen.getByText("Edit Provider")).toBeInTheDocument();
    });

    it("add mode with invalid providerId shows generic title", () => {
      const addModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "invalid-provider-id",
        hasExistingKey: false,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...addModeProps} />);
      expect(screen.getByRole("heading", { name: "Add Provider" })).toBeInTheDocument();
    });

    it("form populates when dialog is opened with currentKey", () => {
      const addModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "google",
        hasExistingKey: true,
        currentKey: "some-key",
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...addModeProps} />);

      const apiKeyInput = screen.getByPlaceholderText("Enter API key") as HTMLInputElement;
      expect(apiKeyInput.value).toBe("some-key");
    });

    it("shows Add mode title and button when hasExistingKey is false", () => {
      const addModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "google",
        hasExistingKey: false,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...addModeProps} />);
      expect(screen.getByText("Add Google AI")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add Provider" })).toBeInTheDocument();
    });

    it("shows Edit mode title and button when hasExistingKey is true", () => {
      const editModeProps = {
        open: true,
        onOpenChange: mockOnOpenChange,
        providerId: "google",
        hasExistingKey: true,
        onSave: mockOnSave,
      };

      render(() => <ProviderDialog {...editModeProps} />);
      expect(screen.getByText("Edit Google AI")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });
  });
});
