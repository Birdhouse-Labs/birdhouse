// ABOUTME: Clamped message bubble with overflow fade used in agent finder previews.
// ABOUTME: Supports start, center, and end alignment plus theme-driven bubble styling.

import { type Component, createEffect, createMemo, createSignal, Show } from "solid-js";
import { uiSize } from "../../theme";

export interface MessageBubbleProps {
  message: string;
  justify: "start" | "center" | "end";
  background: string;
  boxShadow: string;
  maxWidth: string;
  gradientBackground?: string | undefined;
}

const MessageBubble: Component<MessageBubbleProps> = (props) => {
  const [isOverflowing, setIsOverflowing] = createSignal(false);
  let ref: HTMLDivElement | undefined;

  createEffect(() => {
    if (ref) {
      setIsOverflowing(ref.scrollHeight > ref.clientHeight);
    }
  });

  const justifyClass = () => {
    switch (props.justify) {
      case "start":
        return "justify-start";
      case "center":
        return "justify-center";
      case "end":
        return "justify-end";
    }
  };

  const messageClass = createMemo(() => {
    const size = uiSize();
    return size === "sm" ? "text-xs" : size === "md" ? "text-xs" : "text-sm";
  });

  return (
    <div class={`flex ${justifyClass()}`}>
      <div
        ref={ref}
        class={`${messageClass()} ${props.maxWidth} relative rounded-xl px-2.5 py-1.5 text-text-primary`}
        style={{
          background: props.background,
          "box-shadow": props.boxShadow,
          "line-height": "1.35",
          "max-height": "4em",
          overflow: "hidden",
        }}
        title={props.message}
      >
        {props.message}
        <Show when={isOverflowing()}>
          <div
            class="pointer-events-none absolute right-0 bottom-0 left-0 h-5"
            style={{
              background: props.gradientBackground || `linear-gradient(to bottom, transparent, ${props.background})`,
            }}
          />
        </Show>
      </div>
    </div>
  );
};

export default MessageBubble;
