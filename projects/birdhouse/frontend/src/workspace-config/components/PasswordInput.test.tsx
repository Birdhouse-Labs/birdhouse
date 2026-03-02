// ABOUTME: Unit tests for PasswordInput component
// ABOUTME: Tests rendering, toggle functionality, input changes, disabled state, accessibility, and styling

import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import PasswordInput from "./PasswordInput";

describe("PasswordInput", () => {
  describe("Rendering", () => {
    it("renders with placeholder", () => {
      render(() => <PasswordInput value="" onInput={() => {}} placeholder="Enter password" />);
      const input = screen.getByPlaceholderText("Enter password");
      expect(input).toBeInTheDocument();
    });

    it("initial state shows password type (hidden)", () => {
      const { container } = render(() => <PasswordInput value="" onInput={() => {}} />);
      const input = container.querySelector('input[type="password"]') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.type).toBe("password");
    });

    it("initial state shows Eye icon", () => {
      render(() => <PasswordInput value="" onInput={() => {}} />);
      const toggleButton = screen.getByRole("button", { name: "Show password" });
      expect(toggleButton).toBeInTheDocument();
    });
  });

  describe("Toggle Functionality", () => {
    it("clicking toggle button switches to text type (visible)", () => {
      render(() => <PasswordInput value="" onInput={() => {}} />);
      const toggleButton = screen.getByRole("button", { name: "Show password" });
      toggleButton.click();

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.type).toBe("text");
    });

    it("icon changes from Eye to EyeOff when visible", () => {
      render(() => <PasswordInput value="" onInput={() => {}} />);
      const toggleButton = screen.getByRole("button", { name: "Show password" });
      toggleButton.click();

      const hideButton = screen.getByRole("button", { name: "Hide password" });
      expect(hideButton).toBeInTheDocument();
    });

    it("clicking toggle again switches back to password type", () => {
      const { container } = render(() => <PasswordInput value="" onInput={() => {}} />);
      const toggleButton = screen.getByRole("button", { name: "Show password" });

      // Toggle to visible
      toggleButton.click();
      const hideButton = screen.getByRole("button", { name: "Hide password" });

      // Toggle back to hidden
      hideButton.click();
      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.type).toBe("password");
    });

    it("icon changes back to Eye when hidden", () => {
      render(() => <PasswordInput value="" onInput={() => {}} />);
      const toggleButton = screen.getByRole("button", { name: "Show password" });

      // Toggle to visible
      toggleButton.click();
      const hideButton = screen.getByRole("button", { name: "Hide password" });

      // Toggle back to hidden
      hideButton.click();
      const showButton = screen.getByRole("button", { name: "Show password" });
      expect(showButton).toBeInTheDocument();
    });
  });

  describe("Input Changes", () => {
    it("onInput callback fires with correct value when typing", () => {
      const handleInput = vi.fn();
      const { container } = render(() => <PasswordInput value="" onInput={handleInput} />);

      const input = container.querySelector("input") as HTMLInputElement;
      input.value = "secret123";
      input.dispatchEvent(new InputEvent("input", { bubbles: true }));

      expect(handleInput).toHaveBeenCalledWith("secret123");
    });

    it("value prop is reflected in the input", () => {
      const { container } = render(() => <PasswordInput value="mypassword" onInput={() => {}} />);

      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.value).toBe("mypassword");
    });
  });

  describe("Disabled State", () => {
    it("input is disabled when disabled prop is true", () => {
      const { container } = render(() => <PasswordInput value="" onInput={() => {}} disabled={true} />);

      const input = container.querySelector("input") as HTMLInputElement;
      expect(input).toBeDisabled();
    });

    it("toggle button is disabled when disabled prop is true", () => {
      render(() => <PasswordInput value="" onInput={() => {}} disabled={true} />);

      const toggleButton = screen.getByRole("button", { name: "Show password" });
      expect(toggleButton).toBeDisabled();
    });

    it("toggle button does not change visibility when disabled", () => {
      const { container } = render(() => <PasswordInput value="" onInput={() => {}} disabled={true} />);

      const toggleButton = screen.getByRole("button", { name: "Show password" });
      toggleButton.click();

      // Should still be password type (not toggled)
      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.type).toBe("password");
    });

    it("proper disabled styling applied to input", () => {
      const { container } = render(() => <PasswordInput value="" onInput={() => {}} disabled={true} />);

      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.className).toContain("disabled:opacity-50");
      expect(input.className).toContain("disabled:cursor-not-allowed");
    });

    it("proper disabled styling applied to toggle button", () => {
      render(() => <PasswordInput value="" onInput={() => {}} disabled={true} />);

      const toggleButton = screen.getByRole("button", { name: "Show password" });
      expect(toggleButton.className).toContain("disabled:opacity-50");
      expect(toggleButton.className).toContain("disabled:cursor-not-allowed");
    });
  });

  describe("Accessibility", () => {
    it("toggle button has proper aria-label when password is hidden", () => {
      render(() => <PasswordInput value="" onInput={() => {}} />);

      const toggleButton = screen.getByRole("button", { name: "Show password" });
      expect(toggleButton).toHaveAttribute("aria-label", "Show password");
    });

    it("toggle button aria-label changes to Hide password when visible", () => {
      render(() => <PasswordInput value="" onInput={() => {}} />);

      const toggleButton = screen.getByRole("button", { name: "Show password" });
      toggleButton.click();

      const hideButton = screen.getByRole("button", { name: "Hide password" });
      expect(hideButton).toHaveAttribute("aria-label", "Hide password");
    });

    it("toggle button is a proper button element with type button", () => {
      render(() => <PasswordInput value="" onInput={() => {}} />);

      const toggleButton = screen.getByRole("button", { name: "Show password" });
      expect(toggleButton.tagName).toBe("BUTTON");
      expect(toggleButton).toHaveAttribute("type", "button");
    });

    it("input has proper type attribute when hidden", () => {
      const { container } = render(() => <PasswordInput value="" onInput={() => {}} />);

      const input = container.querySelector("input") as HTMLInputElement;
      expect(input).toHaveAttribute("type", "password");
    });

    it("input has proper type attribute when visible", () => {
      render(() => <PasswordInput value="" onInput={() => {}} />);

      const toggleButton = screen.getByRole("button", { name: "Show password" });
      toggleButton.click();

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input).toHaveAttribute("type", "text");
    });
  });

  describe("Styling", () => {
    it("custom class prop is applied to container", () => {
      const { container } = render(() => <PasswordInput value="" onInput={() => {}} class="custom-class" />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("custom-class");
    });

    it("input has monospace font class", () => {
      const { container } = render(() => <PasswordInput value="" onInput={() => {}} />);

      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.className).toContain("font-mono");
    });

    it("container has relative positioning for button placement", () => {
      const { container } = render(() => <PasswordInput value="" onInput={() => {}} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("relative");
    });

    it("toggle button has absolute positioning", () => {
      render(() => <PasswordInput value="" onInput={() => {}} />);

      const toggleButton = screen.getByRole("button", { name: "Show password" });
      expect(toggleButton.className).toContain("absolute");
    });
  });
});
