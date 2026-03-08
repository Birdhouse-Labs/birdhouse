// ABOUTME: Unit tests for ProviderDeleteDialog component
// ABOUTME: Tests rendering, close/cancel/remove actions, and dialog visibility

import { render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProviderDeleteDialog from "./ProviderDeleteDialog";

describe("ProviderDeleteDialog", () => {
  const mockProps = {
    open: true,
    onOpenChange: vi.fn(),
    providerName: "OpenAI",
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders with provider name in title", () => {
      render(() => <ProviderDeleteDialog {...mockProps} />);
      expect(screen.getByText("Remove OpenAI?")).toBeInTheDocument();
    });

    it("renders with provider name in description", () => {
      render(() => <ProviderDeleteDialog {...mockProps} />);
      expect(screen.getByText(/This will delete the API key for OpenAI/)).toBeInTheDocument();
    });

    it("renders with different provider name", () => {
      render(() => <ProviderDeleteDialog {...mockProps} providerName="Anthropic" />);
      expect(screen.getByText("Remove Anthropic?")).toBeInTheDocument();
      expect(screen.getByText(/This will delete the API key for Anthropic/)).toBeInTheDocument();
    });

    it("renders complete description text", () => {
      render(() => <ProviderDeleteDialog {...mockProps} />);
      expect(
        screen.getByText("This will delete the API key for OpenAI. You can add it again later if needed."),
      ).toBeInTheDocument();
    });

    it("renders Cancel button", () => {
      render(() => <ProviderDeleteDialog {...mockProps} />);
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("renders Remove button", () => {
      render(() => <ProviderDeleteDialog {...mockProps} />);
      expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    });

    it("renders close (X) button", () => {
      render(() => <ProviderDeleteDialog {...mockProps} />);
      const closeButton = screen.getByText("×");
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe("Close Button (X)", () => {
    it("calls onOpenChange(false) when close button is clicked", () => {
      render(() => <ProviderDeleteDialog {...mockProps} />);
      const closeButton = screen.getByText("×").closest("button");
      closeButton?.click();
      expect(mockProps.onOpenChange).toHaveBeenCalledWith(false);
      expect(mockProps.onOpenChange).toHaveBeenCalledTimes(1);
    });

    it("does not call onConfirm when close button is clicked", () => {
      render(() => <ProviderDeleteDialog {...mockProps} />);
      const closeButton = screen.getByText("×").closest("button");
      closeButton?.click();
      expect(mockProps.onConfirm).not.toHaveBeenCalled();
    });
  });

  describe("Cancel Button", () => {
    it("calls onOpenChange(false) when Cancel button is clicked", () => {
      render(() => <ProviderDeleteDialog {...mockProps} />);
      screen.getByRole("button", { name: "Cancel" }).click();
      expect(mockProps.onOpenChange).toHaveBeenCalledWith(false);
      expect(mockProps.onOpenChange).toHaveBeenCalledTimes(1);
    });

    it("does not call onConfirm when Cancel button is clicked", () => {
      render(() => <ProviderDeleteDialog {...mockProps} />);
      screen.getByRole("button", { name: "Cancel" }).click();
      expect(mockProps.onConfirm).not.toHaveBeenCalled();
    });

    it("Cancel button has secondary variant styling", () => {
      render(() => <ProviderDeleteDialog {...mockProps} />);
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      expect(cancelButton.className).toContain("bg-surface-raised");
      expect(cancelButton.className).toContain("border-border-muted");
    });
  });

  describe("Remove Button", () => {
    it("calls onConfirm when Remove button is clicked", () => {
      render(() => <ProviderDeleteDialog {...mockProps} />);
      screen.getByRole("button", { name: "Remove" }).click();
      expect(mockProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it("does not call onOpenChange when Remove button is clicked", () => {
      render(() => <ProviderDeleteDialog {...mockProps} />);
      screen.getByRole("button", { name: "Remove" }).click();
      expect(mockProps.onOpenChange).not.toHaveBeenCalled();
    });

    it("Remove button has danger variant styling", () => {
      render(() => <ProviderDeleteDialog {...mockProps} />);
      const removeButton = screen.getByRole("button", { name: "Remove" });
      expect(removeButton.className).toContain("border-danger");
    });
  });

  describe("Dialog State", () => {
    it("dialog is visible when open prop is true", () => {
      render(() => <ProviderDeleteDialog {...mockProps} open={true} />);
      expect(screen.getByText("Remove OpenAI?")).toBeInTheDocument();
    });

    it("dialog is not visible when open prop is false", () => {
      render(() => <ProviderDeleteDialog {...mockProps} open={false} />);
      expect(screen.queryByText("Remove OpenAI?")).not.toBeInTheDocument();
    });

    it("dialog visibility toggles with open prop", () => {
      const { unmount } = render(() => <ProviderDeleteDialog {...mockProps} open={true} />);
      expect(screen.getByText("Remove OpenAI?")).toBeInTheDocument();

      unmount();

      render(() => <ProviderDeleteDialog {...mockProps} open={false} />);
      expect(screen.queryByText("Remove OpenAI?")).not.toBeInTheDocument();
    });
  });

  describe("Button Layout", () => {
    it("buttons are displayed in correct order (Cancel, then Remove)", () => {
      render(() => <ProviderDeleteDialog {...mockProps} />);
      const buttons = screen.getAllByRole("button");
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      const removeButton = screen.getByRole("button", { name: "Remove" });

      const cancelIndex = buttons.indexOf(cancelButton);
      const removeIndex = buttons.indexOf(removeButton);

      expect(cancelIndex).toBeLessThan(removeIndex);
    });
  });
});
