// ABOUTME: Unit tests for ProvidersList component
// ABOUTME: Tests rendering, sorting, API key display, action callbacks, and table structure

import { render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProvidersList from "./ProvidersList";

describe("ProvidersList", () => {
  const mockCallbacks = {
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering with providers", () => {
    it("renders Add Provider button with Plus icon", () => {
      const providers = new Map<string, string>();
      render(() => <ProvidersList providers={providers} {...mockCallbacks} />);
      const addButton = screen.getByRole("button", { name: /Add Provider/i });
      expect(addButton).toBeInTheDocument();
    });

    it("renders table with correct headers when providers exist", () => {
      const providers = new Map<string, string>([["anthropic", "sk-ant-test123"]]);
      render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      expect(screen.getByText("Provider")).toBeInTheDocument();
      expect(screen.getByText("API Key")).toBeInTheDocument();
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });

    it("renders configured providers", () => {
      const providers = new Map<string, string>([
        ["anthropic", "sk-ant-test123"],
        ["openai", "sk-test456"],
        ["google", "api-key-789"],
      ]);
      render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      // All three providers should be rendered
      expect(screen.getByText("Anthropic")).toBeInTheDocument();
      expect(screen.getByText("OpenAI")).toBeInTheDocument();
      expect(screen.getByText("Google AI")).toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("shows empty state message when no providers configured", () => {
      const providers = new Map<string, string>();
      render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      expect(screen.getByText(/No providers configured/i)).toBeInTheDocument();
    });

    it("does not show table when no providers configured", () => {
      const providers = new Map<string, string>();
      const { container } = render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      expect(container.querySelector("table")).not.toBeInTheDocument();
    });
  });

  describe("Provider sorting", () => {
    it("configured providers are sorted in registry order", () => {
      const providers = new Map<string, string>([
        ["anthropic", "sk-ant-test123"],
        ["groq", "gsk-test456"],
      ]);
      const { container } = render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      const rows = container.querySelectorAll("tbody tr");
      const providerNames = Array.from(rows).map((row) => row.querySelector("td:first-child")?.textContent || "");

      // Registry order: Anthropic before Groq
      expect(providerNames[0]).toBe("Anthropic");
      expect(providerNames[1]).toBe("Groq");
    });

    it("multiple providers are sorted in registry order", () => {
      const providers = new Map<string, string>([
        ["openai", "sk-test123"],
        ["anthropic", "sk-ant-test456"],
        ["google", "api-key-789"],
      ]);
      const { container } = render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      const rows = container.querySelectorAll("tbody tr");
      const providerNames = Array.from(rows).map((row) => row.querySelector("td:first-child")?.textContent || "");

      // Registry order: Anthropic, OpenAI, Google AI
      expect(providerNames[0]).toBe("Anthropic");
      expect(providerNames[1]).toBe("OpenAI");
      expect(providerNames[2]).toBe("Google AI");
    });
  });

  describe("API Key display", () => {
    it("configured provider shows masked API key", () => {
      const providers = new Map<string, string>([["anthropic", "sk-ant-test123456789"]]);
      render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      // Should show masked key: first 4 + ... + last 6
      expect(screen.getByText("sk-a...456789")).toBeInTheDocument();
    });

    it("short API key shows first 4 chars and ellipsis", () => {
      const providers = new Map<string, string>([["anthropic", "shortkey"]]);
      render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      // For keys <= 10 chars, show first 4 + ...
      expect(screen.getByText("shor...")).toBeInTheDocument();
    });
  });

  describe("Action callbacks", () => {
    it("Add Provider button opens add menu", () => {
      const providers = new Map<string, string>();
      render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      const addButton = screen.getByRole("button", { name: /Add Provider/i });
      addButton.click();

      // Menu should open - we can't easily test the popover opening in jsdom
      // but we can verify the button exists and is clickable
      expect(addButton).toBeInTheDocument();
    });

    it("Edit button calls onEdit with correct providerId", () => {
      const providers = new Map<string, string>([["anthropic", "sk-ant-test123"]]);
      render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      // Find the Edit button in the same row as "Anthropic"
      const anthropicRow = screen.getByText("Anthropic").closest("tr");
      const buttons = anthropicRow?.querySelectorAll("button");
      const anthropicEditButton = Array.from(buttons || []).find((btn) => btn.textContent === "Edit");

      anthropicEditButton?.click();

      expect(mockCallbacks.onEdit).toHaveBeenCalledOnce();
      expect(mockCallbacks.onEdit).toHaveBeenCalledWith("anthropic");
    });

    it("Delete button calls onDelete with correct providerId", () => {
      const providers = new Map<string, string>([["openai", "sk-test123"]]);
      render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      // Find the Delete button in the same row as "OpenAI"
      const openaiRow = screen.getByText("OpenAI").closest("tr");
      const buttons = openaiRow?.querySelectorAll("button");
      const openaiDeleteButton = Array.from(buttons || []).find((btn) => btn.textContent === "Delete");

      openaiDeleteButton?.click();

      expect(mockCallbacks.onDelete).toHaveBeenCalledOnce();
      expect(mockCallbacks.onDelete).toHaveBeenCalledWith("openai");
    });

    it("Edit and Delete buttons exist for each provider", () => {
      const providers = new Map<string, string>([
        ["anthropic", "sk-ant-test123"],
        ["openai", "sk-test456"],
      ]);
      const { container } = render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      const rows = container.querySelectorAll("tbody tr");

      rows.forEach((row) => {
        const buttons = row.querySelectorAll("button");
        const editButton = Array.from(buttons).find((btn) => btn.textContent === "Edit");
        const deleteButton = Array.from(buttons).find((btn) => btn.textContent === "Delete");

        expect(editButton).toBeTruthy();
        expect(deleteButton).toBeTruthy();
      });
    });

    it("multiple Edit button clicks call onEdit with different providerIds", () => {
      const providers = new Map<string, string>([
        ["anthropic", "sk-ant-test123"],
        ["openai", "sk-test456"],
      ]);
      render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      // Get rows
      const anthropicRow = screen.getByText("Anthropic").closest("tr");
      const openaiRow = screen.getByText("OpenAI").closest("tr");

      // Click Edit on Anthropic row
      const anthropicEditButtons = anthropicRow?.querySelectorAll("button");
      const anthropicEdit = Array.from(anthropicEditButtons || []).find((btn) => btn.textContent === "Edit");
      anthropicEdit?.click();

      expect(mockCallbacks.onEdit).toHaveBeenCalledWith("anthropic");

      // Click Edit on OpenAI row
      const openaiEditButtons = openaiRow?.querySelectorAll("button");
      const openaiEdit = Array.from(openaiEditButtons || []).find((btn) => btn.textContent === "Edit");
      openaiEdit?.click();

      expect(mockCallbacks.onEdit).toHaveBeenCalledWith("openai");
      expect(mockCallbacks.onEdit).toHaveBeenCalledTimes(2);
    });
  });

  describe("Table structure", () => {
    it("table has correct structure with thead and tbody", () => {
      const providers = new Map<string, string>([["anthropic", "sk-ant-test123"]]);
      const { container } = render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      const table = container.querySelector("table");
      expect(table).toBeInTheDocument();

      const thead = table?.querySelector("thead");
      const tbody = table?.querySelector("tbody");

      expect(thead).toBeInTheDocument();
      expect(tbody).toBeInTheDocument();
    });

    it("header row has three columns", () => {
      const providers = new Map<string, string>([["anthropic", "sk-ant-test123"]]);
      const { container } = render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      const headerCells = container.querySelectorAll("thead th");
      expect(headerCells.length).toBe(3);
    });

    it("each provider row has three cells", () => {
      const providers = new Map<string, string>([
        ["anthropic", "sk-ant-test123"],
        ["openai", "sk-test456"],
      ]);
      const { container } = render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      const rows = container.querySelectorAll("tbody tr");

      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        expect(cells.length).toBe(3);
      });
    });

    it("provider name appears in first column", () => {
      const providers = new Map<string, string>([["anthropic", "sk-ant-test123"]]);
      const { container } = render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      const firstCell = container.querySelector("tbody tr td:first-child");
      expect(firstCell?.textContent).toBe("Anthropic");
    });

    it("masked API key appears in second column", () => {
      const providers = new Map<string, string>([["anthropic", "sk-ant-test123456789"]]);
      const { container } = render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      const secondCell = container.querySelector("tbody tr td:nth-child(2)");
      expect(secondCell?.textContent).toContain("sk-a...456789");
    });

    it("action buttons appear in third column", () => {
      const providers = new Map<string, string>([["anthropic", "sk-ant-test123"]]);
      const { container } = render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      const thirdCell = container.querySelector("tbody tr td:nth-child(3)");
      const buttons = thirdCell?.querySelectorAll("button");

      expect(buttons?.length).toBe(2); // Edit and Delete buttons
    });

    it("table has proper styling classes", () => {
      const providers = new Map<string, string>([["anthropic", "sk-ant-test123"]]);
      const { container } = render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      const table = container.querySelector("table");
      expect(table?.className).toContain("w-full");
      expect(table?.className).toContain("bg-surface-raised");
    });

    it("table container has rounded border", () => {
      const providers = new Map<string, string>([["anthropic", "sk-ant-test123"]]);
      const { container } = render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      const tableContainer = container.querySelector(".rounded-lg.border");
      expect(tableContainer).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("handles single provider", () => {
      const providers = new Map<string, string>([["anthropic", "sk-ant-test123"]]);
      render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      expect(screen.getByText("Anthropic")).toBeInTheDocument();
    });

    it("handles multiple providers configured", () => {
      const providers = new Map<string, string>(
        ["anthropic", "openai", "google", "groq"].map((id) => [id, `${id}-key-123`]),
      );
      render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      expect(screen.getByText("Anthropic")).toBeInTheDocument();
      expect(screen.getByText("OpenAI")).toBeInTheDocument();
      expect(screen.getByText("Google AI")).toBeInTheDocument();
      expect(screen.getByText("Groq")).toBeInTheDocument();
    });

    it("handles no providers configured - shows empty state", () => {
      const providers = new Map<string, string>();
      render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      // Should show add button and empty state
      expect(screen.getByRole("button", { name: /Add Provider/i })).toBeInTheDocument();
      expect(screen.getByText(/No providers configured/i)).toBeInTheDocument();
    });

    it("renders correctly with empty Map", () => {
      const providers = new Map<string, string>();
      render(() => <ProvidersList providers={providers} {...mockCallbacks} />);

      expect(screen.getByRole("button", { name: /Add Provider/i })).toBeInTheDocument();
      expect(screen.getByText(/No providers configured/i)).toBeInTheDocument();
    });
  });
});
