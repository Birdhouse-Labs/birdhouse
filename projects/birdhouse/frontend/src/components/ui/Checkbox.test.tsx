// ABOUTME: Unit tests for Checkbox component
// ABOUTME: Tests rendering, interaction, keyboard support, disabled state, and accessibility

import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import Checkbox from "./Checkbox";

describe("Checkbox", () => {
  it("renders with label", () => {
    render(() => <Checkbox checked={false} onChange={() => {}} label="Accept terms" />);
    expect(screen.getByText("Accept terms")).toBeInTheDocument();
  });

  it("renders unchecked state", () => {
    render(() => <Checkbox checked={false} onChange={() => {}} label="Accept terms" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
  });

  it("renders checked state", () => {
    render(() => <Checkbox checked={true} onChange={() => {}} label="Accept terms" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("calls onChange with true when clicked while unchecked", () => {
    const handleChange = vi.fn();
    render(() => <Checkbox checked={false} onChange={handleChange} label="Accept terms" />);
    screen.getByRole("checkbox").click();
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when clicked while checked", () => {
    const handleChange = vi.fn();
    render(() => <Checkbox checked={true} onChange={handleChange} label="Accept terms" />);
    screen.getByRole("checkbox").click();
    expect(handleChange).toHaveBeenCalledWith(false);
  });

  it("responds to Space key press", () => {
    const handleChange = vi.fn();
    render(() => <Checkbox checked={false} onChange={handleChange} label="Accept terms" />);
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    checkbox.focus();
    checkbox.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
        cancelable: true,
      }),
    );
    checkbox.click();
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("responds to Enter key press when focused", () => {
    const handleChange = vi.fn();
    render(() => <Checkbox checked={false} onChange={handleChange} label="Accept terms" />);
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    checkbox.focus();
    checkbox.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    checkbox.click();
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("does not respond to other keys", () => {
    const handleChange = vi.fn();
    render(() => <Checkbox checked={false} onChange={handleChange} label="Accept terms" />);
    const checkbox = screen.getByRole("checkbox");
    checkbox.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("renders disabled state", () => {
    render(() => <Checkbox checked={false} onChange={() => {}} label="Accept terms" disabled={true} />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();
  });

  it("does not call onChange when disabled and clicked", () => {
    const handleChange = vi.fn();
    render(() => <Checkbox checked={false} onChange={handleChange} label="Accept terms" disabled={true} />);
    screen.getByRole("checkbox").click();
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("does not call onChange when disabled and Space pressed", () => {
    const handleChange = vi.fn();
    render(() => <Checkbox checked={false} onChange={handleChange} label="Accept terms" disabled={true} />);
    const checkbox = screen.getByRole("checkbox");
    checkbox.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("has proper accessibility attributes", () => {
    render(() => <Checkbox checked={false} onChange={() => {}} label="Accept terms" id="terms-checkbox" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("id", "terms-checkbox");
    expect(checkbox).toHaveAttribute("type", "checkbox");
  });

  it("associates label with checkbox via htmlFor", () => {
    render(() => <Checkbox checked={false} onChange={() => {}} label="Accept terms" id="terms-checkbox" />);
    const label = screen.getByText("Accept terms").closest("label");
    expect(label).toHaveAttribute("for", "terms-checkbox");
  });

  it("generates id automatically if not provided", () => {
    render(() => <Checkbox checked={false} onChange={() => {}} label="Accept terms" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("id");
    expect(checkbox.getAttribute("id")).toBeTruthy();
  });

  it("applies reduced opacity when disabled", () => {
    render(() => <Checkbox checked={false} onChange={() => {}} label="Accept terms" disabled={true} />);
    const label = screen.getByText("Accept terms").closest("label");
    expect(label?.className).toContain("opacity-");
  });
});
