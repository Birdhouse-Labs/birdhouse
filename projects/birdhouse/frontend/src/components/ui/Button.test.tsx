// ABOUTME: Unit tests for Button component
// ABOUTME: Tests rendering, variants, and disabled state

import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import Button from "./Button";

describe("Button", () => {
  it("renders children", () => {
    render(() => <Button>Click me</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("applies primary variant by default", () => {
    render(() => <Button>Primary</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-gradient-to-r");
  });

  it("applies secondary variant classes", () => {
    render(() => <Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-surface-raised");
    expect(button.className).toContain("border-border-muted");
  });

  it("disables button when disabled prop is true", () => {
    render(() => <Button disabled>Disabled</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button.className).toContain("cursor-not-allowed");
  });

  it("calls onClick when clicked", async () => {
    const handleClick = vi.fn();
    render(() => <Button onClick={handleClick}>Click</Button>);
    screen.getByRole("button").click();
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick when disabled", () => {
    const handleClick = vi.fn();
    render(() => (
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    ));
    screen.getByRole("button").click();
    expect(handleClick).not.toHaveBeenCalled();
  });
});
