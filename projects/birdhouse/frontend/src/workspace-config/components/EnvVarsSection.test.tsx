// ABOUTME: Unit tests for EnvVarsSection component
// ABOUTME: Tests table rendering, empty state, add, and delete interactions

import { render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EnvVarsSection from "./EnvVarsSection";

describe("EnvVarsSection", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Set input value and fire the SolidJS-compatible input event
  const typeInto = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  };

  // Trigger add by pressing Enter on the key input (avoids disabled-button click issues)
  const pressEnterOnKeyInput = () => {
    const keyInput = screen.getByPlaceholderText("VARIABLE_NAME") as HTMLInputElement;
    keyInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  };

  describe("empty state", () => {
    it("renders add row with no table when envVars is empty", () => {
      render(() => <EnvVarsSection envVars={new Map()} onChange={mockOnChange} />);

      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText("VARIABLE_NAME")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("value")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    });
  });

  describe("existing variables", () => {
    it("renders existing env vars in a table", () => {
      const envVars = new Map([
        ["TAVILY_API_KEY", "tvly-abc123"],
        ["MY_VAR", "hello"],
      ]);

      render(() => <EnvVarsSection envVars={envVars} onChange={mockOnChange} />);

      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.getByText("TAVILY_API_KEY")).toBeInTheDocument();
      expect(screen.getByText("tvly-abc123")).toBeInTheDocument();
      expect(screen.getByText("MY_VAR")).toBeInTheDocument();
      expect(screen.getByText("hello")).toBeInTheDocument();
    });

    it("renders a Delete button for each existing var", () => {
      const envVars = new Map([
        ["VAR_ONE", "value1"],
        ["VAR_TWO", "value2"],
      ]);

      render(() => <EnvVarsSection envVars={envVars} onChange={mockOnChange} />);

      const deleteButtons = screen.getAllByRole("button", { name: /Delete/ });
      expect(deleteButtons).toHaveLength(2);
    });

    it("sorts entries alphabetically", () => {
      const envVars = new Map([
        ["ZEBRA", "z"],
        ["ALPHA", "a"],
        ["MIDDLE", "m"],
      ]);

      render(() => <EnvVarsSection envVars={envVars} onChange={mockOnChange} />);

      const rows = screen.getAllByRole("row").slice(1); // skip header
      expect(rows[0]).toHaveTextContent("ALPHA");
      expect(rows[1]).toHaveTextContent("MIDDLE");
      expect(rows[2]).toHaveTextContent("ZEBRA");
    });
  });

  describe("add interaction", () => {
    it("calls onChange with new var when Enter is pressed on key input", () => {
      render(() => <EnvVarsSection envVars={new Map()} onChange={mockOnChange} />);

      typeInto(screen.getByPlaceholderText("VARIABLE_NAME") as HTMLInputElement, "NEW_KEY");
      typeInto(screen.getByPlaceholderText("value") as HTMLInputElement, "new-value");
      pressEnterOnKeyInput();

      expect(mockOnChange).toHaveBeenCalledOnce();
      const result: Map<string, string> = mockOnChange.mock.calls[0]![0];
      expect(result.get("NEW_KEY")).toBe("new-value");
    });

    it("calls onChange via Enter key on value input", () => {
      render(() => <EnvVarsSection envVars={new Map()} onChange={mockOnChange} />);

      typeInto(screen.getByPlaceholderText("VARIABLE_NAME") as HTMLInputElement, "KEY_ENTER");
      const valInput = screen.getByPlaceholderText("value") as HTMLInputElement;
      typeInto(valInput, "my-val");
      valInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

      expect(mockOnChange).toHaveBeenCalledOnce();
      const result: Map<string, string> = mockOnChange.mock.calls[0]![0];
      expect(result.get("KEY_ENTER")).toBe("my-val");
    });

    it("does not call onChange when adding a duplicate key", () => {
      const envVars = new Map([["EXISTING", "value"]]);
      render(() => <EnvVarsSection envVars={envVars} onChange={mockOnChange} />);

      typeInto(screen.getByPlaceholderText("VARIABLE_NAME") as HTMLInputElement, "EXISTING");
      pressEnterOnKeyInput();

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("does not call onChange when key is empty and Enter is pressed", () => {
      render(() => <EnvVarsSection envVars={new Map()} onChange={mockOnChange} />);

      pressEnterOnKeyInput();

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("Add button is disabled when key input is empty", () => {
      render(() => <EnvVarsSection envVars={new Map()} onChange={mockOnChange} />);

      expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    });

    it("allows empty value string", () => {
      render(() => <EnvVarsSection envVars={new Map()} onChange={mockOnChange} />);

      typeInto(screen.getByPlaceholderText("VARIABLE_NAME") as HTMLInputElement, "EMPTY_VAL");
      pressEnterOnKeyInput();

      expect(mockOnChange).toHaveBeenCalledOnce();
      const result: Map<string, string> = mockOnChange.mock.calls[0]![0];
      expect(result.get("EMPTY_VAL")).toBe("");
    });
  });

  describe("delete interaction", () => {
    it("calls onChange with var removed when Delete is clicked", () => {
      const envVars = new Map([
        ["KEEP", "keep-val"],
        ["REMOVE", "remove-val"],
      ]);

      render(() => <EnvVarsSection envVars={envVars} onChange={mockOnChange} />);

      screen.getByRole("button", { name: "Delete REMOVE" }).click();

      expect(mockOnChange).toHaveBeenCalledOnce();
      const result: Map<string, string> = mockOnChange.mock.calls[0]![0];
      expect(result.has("REMOVE")).toBe(false);
      expect(result.get("KEEP")).toBe("keep-val");
    });
  });
});
