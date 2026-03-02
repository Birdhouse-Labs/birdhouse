// ABOUTME: MenuItemButton component for dropdown menu items and menu actions
// ABOUTME: Provides consistent styling for menu items with optional icons and danger variant

import { type Component, type JSX, splitProps } from "solid-js";

export type MenuItemButtonProps = {
  /** Button content (text or elements) */
  children: JSX.Element | string;
  /** Optional leading icon */
  icon?: JSX.Element;
  /** Variant: normal (default), danger (red text, red hover), or gradient (theme gradient background) */
  variant?: "normal" | "danger" | "gradient";
  /** Click handler */
  onClick?: (event: MouseEvent) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Additional classes */
  class?: string;
  /** HTML button type */
  type?: "button" | "submit" | "reset";
};

const MenuItemButton: Component<MenuItemButtonProps> = (props) => {
  const [local, others] = splitProps(props, ["children", "icon", "variant", "disabled", "class"]);

  const variant = () => local.variant || "normal";

  // Cursor-following effect handlers (for gradient variant)
  const shouldEnableEffects = () => {
    if (typeof window === "undefined") return false;

    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    return !isTouchDevice && !prefersReducedMotion;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!shouldEnableEffects() || variant() !== "gradient") return;

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    target.style.setProperty("--x", `${x}px`);
    target.style.setProperty("--y", `${y}px`);
  };

  const handleMouseLeave = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.removeProperty("--x");
    target.style.removeProperty("--y");
  };

  // Base classes for menu item button
  const baseClasses = "w-full px-4 py-2 text-left text-sm flex items-center gap-2 rounded-lg transition-all";

  // Variant-specific classes
  const variantClasses = () => {
    const v = variant();

    switch (v) {
      case "danger":
        return "text-danger hover:bg-danger/10 cursor-pointer";
      case "gradient":
        return "cursor-follow-menu-item font-medium bg-gradient-to-r from-gradient-from to-gradient-to hover:brightness-110 hover:scale-[1.02] text-text-on-accent cursor-pointer select-none";
      default:
        return "text-text-primary hover:bg-surface-overlay cursor-pointer";
    }
  };

  // Disabled state classes
  const disabledClasses = () => {
    if (!local.disabled) return "";
    return "opacity-40 cursor-not-allowed";
  };

  // Build the full class list
  const buttonClasses = () => {
    const classes = [baseClasses, variantClasses(), disabledClasses(), local.class || ""];
    return classes.filter(Boolean).join(" ");
  };

  // Render icon with fixed 16px size
  const renderIcon = () => {
    if (!local.icon) return null;

    return (
      <span class="flex items-center justify-center flex-shrink-0" style={{ width: "16px", height: "16px" }}>
        {local.icon}
      </span>
    );
  };

  return (
    <>
      <style>{`
        /* Cursor-following gradient effect for menu items */
        .cursor-follow-menu-item {
          position: relative;
          overflow: hidden;
        }
        
        /* Ensure child elements (like icons) don't block mouse events */
        .cursor-follow-menu-item > * {
          pointer-events: none;
          position: relative;
          z-index: 1;
        }
        
        .cursor-follow-menu-item::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: radial-gradient(
            circle closest-side,
            rgba(255, 255, 255, 0.3),
            rgba(255, 255, 255, 0.1) 50%,
            transparent 100%
          );
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
          transform: translate(
            calc(var(--x, -9999px) - 100px),
            calc(var(--y, -9999px) - 100px)
          );
          will-change: transform;
          z-index: 0;
        }
        
        .cursor-follow-menu-item:hover::before {
          opacity: 1;
        }
        
        .cursor-follow-menu-item:disabled::before {
          display: none;
        }
        
        @media (prefers-reduced-motion: reduce) {
          .cursor-follow-menu-item::before {
            display: none;
          }
        }
      `}</style>
      <button
        class={buttonClasses()}
        disabled={local.disabled}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        {...others}
      >
        {renderIcon()}
        {local.children}
      </button>
    </>
  );
};

export default MenuItemButton;
