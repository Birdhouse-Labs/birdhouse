// ABOUTME: Reusable styled container for message bubble content
// ABOUTME: Provides visual treatment (background, border, glow) for different message variants

import type { Component, JSX } from "solid-js";
import { cardSurface } from "../../styles/containerStyles";

export interface MessageBubbleContentProps {
  variant: "assistant" | "user" | "agent-sent";
  children: JSX.Element;
  class?: string;
  classList?: Record<string, boolean>;
}

export const MessageBubbleContent: Component<MessageBubbleContentProps> = (props) => {
  // Base classes shared across all variants
  const baseClasses = "rounded-2xl relative group min-w-[70px]";

  // Variant-specific styling
  const variantStyle = () => {
    switch (props.variant) {
      case "user":
        return {
          class: "",
          style: {
            background: "color-mix(in srgb, var(--theme-accent) 12%, var(--theme-surface-raised))",
            "box-shadow": `0 0 0 1px color-mix(in srgb, var(--theme-accent) 30%, transparent),
                           0 8px 24px -4px var(--theme-glow),
                           0 4px 12px -2px color-mix(in srgb, var(--theme-accent-muted) 50%, transparent),
                           0 0 0 1px color-mix(in srgb, var(--theme-accent) 8%, transparent) inset`,
          },
        };
      case "agent-sent":
        return {
          class: "",
          style: {
            background: `linear-gradient(to right,
              color-mix(in srgb, var(--theme-gradient-from) 15%, var(--theme-surface-raised)),
              color-mix(in srgb, var(--theme-gradient-via) 15%, var(--theme-surface-raised)),
              color-mix(in srgb, var(--theme-gradient-to) 15%, var(--theme-surface-raised))
            )`,
            "box-shadow": `0 0 0 1px color-mix(in srgb, var(--theme-gradient-via) 35%, transparent),
                           0 4px 16px -2px color-mix(in srgb, var(--theme-gradient-via) 20%, transparent),
                           0 0 0 1px color-mix(in srgb, var(--theme-gradient-via) 10%, transparent) inset`,
          },
        };
      case "assistant":
        return {
          class: cardSurface,
          style: {},
        };
    }
  };

  return (
    <div
      class={`${baseClasses} ${variantStyle().class} ${props.class || ""}`}
      classList={props.classList}
      style={variantStyle().style}
    >
      {props.children}
    </div>
  );
};

export default MessageBubbleContent;
