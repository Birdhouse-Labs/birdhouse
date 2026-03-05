// ABOUTME: Reusable Button component with variant support and global theme integration
// ABOUTME: Reads uiSize from theme context and supports primary, secondary, tertiary, success, danger variants

import { type Component, type JSX, splitProps } from "solid-js";
import { uiSize } from "../../theme";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "success" | "danger";

export type ButtonProps = {
  variant?: ButtonVariant;
  disabled?: boolean;
  children: JSX.Element;
  onClick?: () => void;
  class?: string;
  leftIcon?: JSX.Element;
  rightIcon?: JSX.Element;
  href?: string; // When provided, renders as <a> for navigation
};

const Button: Component<ButtonProps> = (props) => {
  const [local, others] = splitProps(props, [
    "variant",
    "disabled",
    "children",
    "class",
    "leftIcon",
    "rightIcon",
    "href",
  ]);

  const variant = () => local.variant || "primary";

  // Cursor-following effect handlers
  const shouldEnableEffects = () => {
    if (typeof window === "undefined") return false;

    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    return !isTouchDevice && !prefersReducedMotion;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!shouldEnableEffects()) return;

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

  // Padding classes based on global uiSize
  // Note: Text size is set to text-sm and scales globally via --global-text-scale CSS variable
  const sizeClasses = () => {
    const size = uiSize();
    switch (size) {
      case "sm":
        return "px-3 py-1.5";
      case "lg":
        return "px-5 py-2.5";
      default:
        return "px-4 py-2";
    }
  };

  // Icon size based on global uiSize
  const _iconSize = () => {
    const size = uiSize();
    switch (size) {
      case "sm":
        return 16;
      case "lg":
        return 20;
      default:
        return 18;
    }
  };

  // Variant-specific classes
  const variantClasses = () => {
    const v = variant();

    switch (v) {
      case "primary":
        return "font-medium bg-gradient-to-r from-gradient-from to-gradient-to rounded-lg hover:brightness-110 active:scale-90 md:active:scale-95 transition-all duration-200 shadow-lg shadow-glow hover:scale-[1.02] text-text-on-accent select-none";

      case "secondary":
        return "rounded-lg font-medium transition-all active:scale-90 md:active:scale-95 bg-surface-raised border border-border-muted text-text-primary select-none";

      case "tertiary":
        return "rounded-lg font-medium transition-all active:scale-90 md:active:scale-95 hover:bg-accent/20 text-accent select-none";

      case "success":
        return "rounded-lg font-medium border-2 transition-all active:scale-90 md:active:scale-95 border-success text-success hover:bg-success/10 select-none";

      case "danger":
        return "rounded-lg font-medium border-2 transition-all active:scale-90 md:active:scale-95 border-danger text-danger hover:bg-danger/10 select-none";

      default:
        return "";
    }
  };

  // Disabled state classes
  const disabledClasses = () => {
    if (!local.disabled) return "";
    return "opacity-40 cursor-not-allowed";
  };

  // Build the full class list
  const buttonClasses = () => {
    const classes = [sizeClasses(), variantClasses(), disabledClasses(), local.class || ""];
    return classes.filter(Boolean).join(" ");
  };

  // Reactive class computation - must be reactive to update when disabled changes
  const buttonClass = () =>
    `cursor-follow-button text-sm ${buttonClasses()} ${local.leftIcon || local.rightIcon ? "flex items-center gap-2" : ""}`;

  const content = (
    <>
      {local.leftIcon}
      {local.children}
      {local.rightIcon}
    </>
  );

  return (
    <>
      <style>{`
        /* Cursor-following gradient effect */
        .cursor-follow-button {
          position: relative;
          overflow: hidden;
          transform: translateZ(0);
        }
        
        /* Ensure child elements (like icons) don't block mouse events */
        .cursor-follow-button > * {
          pointer-events: none;
          z-index: 1;
        }
        
        .cursor-follow-button::before {
          content: '';
          position: absolute;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background: radial-gradient(
            circle closest-side,
            color-mix(in srgb, var(--theme-gradient-from) 35%, transparent),
            color-mix(in srgb, var(--theme-gradient-from) 15%, transparent) 50%,
            transparent 100%
          );
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
          transform: translate(
            calc(var(--x, -9999px) - 75px),
            calc(var(--y, -9999px) - 75px)
          );
          will-change: transform;
          z-index: 0;
        }
        
        .cursor-follow-button:hover::before {
          opacity: 1;
        }
        
        .cursor-follow-button:disabled::before {
          display: none;
        }
        
        @media (prefers-reduced-motion: reduce) {
          .cursor-follow-button::before {
            display: none;
          }
        }
      `}</style>
      {local.href ? (
        <a
          href={local.href}
          class={buttonClass()}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          {...others}
        >
          {content}
        </a>
      ) : (
        <button
          type="button"
          class={buttonClass()}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          disabled={local.disabled}
          {...others}
        >
          {content}
        </button>
      )}
    </>
  );
};

export default Button;
