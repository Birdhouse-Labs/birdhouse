// ABOUTME: Reusable ButtonGroup component for segmented controls and button groups
// ABOUTME: Supports text and icon buttons with active state and global theme integration

import { type Component, For, type JSX } from "solid-js";
import { uiSize } from "../../theme";

export type ButtonGroupItem = {
  value: string;
  label?: string;
  icon?: JSX.Element;
  title?: string;
};

export type ButtonGroupProps = {
  items: ButtonGroupItem[];
  value: string;
  onChange: (value: string) => void;
  class?: string;
  "data-ph-capture-attribute-element-type"?: string;
  [key: `data-ph-capture-attribute-${string}`]: string | undefined;
};

const ButtonGroup: Component<ButtonGroupProps> = (props) => {
  // Extract PostHog data attributes
  const dataAttributes = () => {
    const attrs: Record<string, string> = {};
    for (const key in props) {
      if (key.startsWith("data-ph-capture-attribute-")) {
        attrs[key] = props[key as keyof ButtonGroupProps] as string;
      }
    }
    return attrs;
  };

  // Cursor-following effect handlers
  const shouldEnableEffects = () => {
    if (typeof window === "undefined") return false;

    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    return !isTouchDevice && !prefersReducedMotion;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!shouldEnableEffects()) return;

    const target = e.currentTarget as HTMLButtonElement;
    const rect = target.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    target.style.setProperty("--x", `${x}px`);
    target.style.setProperty("--y", `${y}px`);
  };

  const handleMouseLeave = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLButtonElement;
    target.style.removeProperty("--x");
    target.style.removeProperty("--y");
  };

  // Size classes based on global uiSize
  const sizeClasses = () => {
    const size = uiSize();
    switch (size) {
      case "sm":
        return "px-3 py-1.5 text-sm";
      case "lg":
        return "px-5 py-2.5 text-sm"; // Changed from text-base to match Button component
      default:
        return "px-4 py-2 text-sm";
    }
  };

  const isActive = (itemValue: string) => props.value === itemValue;

  // Check if this button group should be full width (buttons need flex-1)
  const isFullWidth = () => props.class?.includes("w-full");

  const getButtonClasses = (itemValue: string, index: number) => {
    const isLast = index === props.items.length - 1;
    const active = isActive(itemValue);

    const baseClasses = `font-medium transition-all active:brightness-90 active:scale-95 md:active:scale-98 select-none ${
      isFullWidth() ? "flex-1" : ""
    } ${!isLast ? "border-r border-border-muted" : ""}`;

    if (active) {
      return `${baseClasses} cursor-follow-button-group-active bg-gradient-to text-text-on-accent`;
    }

    return `${baseClasses} cursor-follow-button-group bg-surface-raised text-text-primary`;
  };

  return (
    <>
      <style>{`
        /* Cursor-following gradient effect for button group */
        .cursor-follow-button-group,
        .cursor-follow-button-group-active {
          position: relative;
          overflow: hidden;
        }
        
        /* Ensure child elements (like icons) don't block mouse events */
        .cursor-follow-button-group > *,
        .cursor-follow-button-group-active > * {
          pointer-events: none;
          position: relative;
          z-index: 1;
        }
        
        .cursor-follow-button-group::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: radial-gradient(
            circle closest-side,
            color-mix(in srgb, var(--theme-gradient-to) 35%, transparent),
            color-mix(in srgb, var(--theme-gradient-to) 15%, transparent) 50%,
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

        .cursor-follow-button-group-active::before {
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
        
        .cursor-follow-button-group:hover::before,
        .cursor-follow-button-group-active:hover::before {
          opacity: 1;
        }
        
        @media (prefers-reduced-motion: reduce) {
          .cursor-follow-button-group::before,
          .cursor-follow-button-group-active::before {
            display: none;
          }
        }
      `}</style>
      <div class={`inline-flex rounded-lg overflow-hidden border border-border-muted ${props.class || ""}`}>
        <For each={props.items}>
          {(item, index) => (
            <button
              type="button"
              class={`${sizeClasses()} ${getButtonClasses(item.value, index())}`}
              onClick={() => props.onChange(item.value)}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              title={item.title}
              {...dataAttributes()}
              data-ph-capture-attribute-button-value={item.value}
              data-ph-capture-attribute-is-active={isActive(item.value) ? "true" : "false"}
            >
              {item.icon ? item.icon : item.label}
            </button>
          )}
        </For>
      </div>
    </>
  );
};

export default ButtonGroup;
