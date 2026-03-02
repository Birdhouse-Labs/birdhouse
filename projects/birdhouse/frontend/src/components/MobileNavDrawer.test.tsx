// ABOUTME: Unit tests for MobileNavDrawer component
// ABOUTME: Tests drawer behavior and auto-close on component selection

import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import MobileNavDrawer from "./MobileNavDrawer";

describe("MobileNavDrawer", () => {
  it("closes drawer after selecting a component", () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    const components = [
      {
        id: "test-component",
        name: "Test Component",
        component: () => <div>Test</div>,
        description: "A test component",
      },
      {
        id: "another-component",
        name: "Another Component",
        component: () => <div>Another</div>,
        description: "Another test component",
      },
    ];

    render(() => (
      <MobileNavDrawer
        components={components}
        selectedComponent=""
        onSelect={onSelect}
        open={true}
        onOpenChange={onOpenChange}
        trigger={<div />}
      />
    ));

    const button = screen.getByText("Test Component");
    button.click();

    // Verify component selection was called with correct ID
    expect(onSelect).toHaveBeenCalledWith("test-component");
    expect(onSelect).toHaveBeenCalledOnce();

    // Verify drawer was closed (this is the critical behavior)
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onOpenChange).toHaveBeenCalledOnce();
  });

  it("calls onSelect for each component independently", () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    const components = [
      {
        id: "first",
        name: "First",
        component: () => <div>First</div>,
        description: "First component",
      },
      {
        id: "second",
        name: "Second",
        component: () => <div>Second</div>,
        description: "Second component",
      },
    ];

    render(() => (
      <MobileNavDrawer
        components={components}
        selectedComponent="first"
        onSelect={onSelect}
        open={true}
        onOpenChange={onOpenChange}
        trigger={<div />}
      />
    ));

    const secondButton = screen.getByText("Second");
    secondButton.click();

    expect(onSelect).toHaveBeenCalledWith("second");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
