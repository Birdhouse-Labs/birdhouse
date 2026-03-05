// ABOUTME: IconButton component for icon-only buttons with variant and shape support
// ABOUTME: Reads uiSize from theme context and supports theme-controlled gradient colors

import { type Component, type JSX, splitProps } from "solid-js";
import { uiSize } from "../../theme";

export type IconButtonVariant =
  | "secondary" // Neutral solid background (default)
  | "ghost" // Transparent, hover reveals background
  | "ghost-danger" // Transparent, red on hover
  | "primary"; // Theme-controlled gradient

export type IconButtonShape = "square" | "circular";

export type IconButtonProps = {
  /** The icon to display (required) */
  icon: JSX.Element;
  /** Visual style variant */
  variant?: IconButtonVariant;
  /** Shape of the button */
  shape?: IconButtonShape;
  /** Accessible label (required for screen readers) */
  "aria-label": string;
  /** Optional tooltip (defaults to aria-label if not provided) */
  title?: string;
  /** Disable automatic size responsiveness (uses fixed small size) */
  fixedSize?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional classes */
  class?: string;
  classList?: Record<string, boolean>;
};

const IconButton: Component<IconButtonProps> = (props) => {
  const [local, others] = splitProps(props, [
    "icon",
    "variant",
    "shape",
    "aria-label",
    "title",
    "fixedSize",
    "disabled",
    "class",
  ]);

  const variant = () => local.variant || "secondary";
  const shape = () => local.shape || "square";

  // Size classes based on global uiSize or fixed
  const sizeClasses = () => {
    if (local.fixedSize) return "w-7 h-7";

    const size = uiSize();
    switch (size) {
      case "sm":
        return "w-8 h-8";
      case "lg":
        return "w-10 h-10";
      default:
        return "w-9 h-9";
    }
  };

  // Icon size based on global uiSize or fixed
  const iconSize = () => {
    if (local.fixedSize) return 16;

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

  // Shape classes
  const shapeClasses = () => {
    return shape() === "circular" ? "rounded-full" : "rounded-lg";
  };

  // Variant-specific classes
  const variantClasses = () => {
    const v = variant();

    switch (v) {
      case "secondary":
        return "bg-surface-overlay hover:brightness-110 text-text-primary";

      case "ghost":
        return "hover:bg-surface-hover text-text-muted hover:text-text-primary";

      case "ghost-danger":
        return "hover:bg-danger/10 text-text-muted hover:text-danger";

      case "primary":
        return "bg-gradient-to-r from-gradient-from to-gradient-to hover:brightness-110 shadow-lg shadow-glow/25 text-text-on-accent";

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
    const classes = [
      "flex items-center justify-center transition-all active:scale-85 md:active:scale-90 select-none",
      sizeClasses(),
      shapeClasses(),
      variantClasses(),
      disabledClasses(),
      local.class || "",
    ];
    return classes.filter(Boolean).join(" ");
  };

  // Clone icon with proper size
  const renderIcon = () => {
    const icon = local.icon;
    const size = iconSize();

    // If it's a Lucide icon (or similar), it accepts a size prop
    // We wrap in a container that centers it
    return (
      <span class="flex items-center justify-center" style={{ width: `${size}px`, height: `${size}px` }}>
        {icon}
      </span>
    );
  };

  return (
    <button
      class={buttonClasses()}
      aria-label={local["aria-label"]}
      title={local.title ?? local["aria-label"]}
      disabled={local.disabled}
      {...others}
    >
      {renderIcon()}
    </button>
  );
};

export default IconButton;
