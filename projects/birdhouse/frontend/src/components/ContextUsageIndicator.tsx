// ABOUTME: Context usage donut indicator with clickable popover showing token count and model limit
// ABOUTME: Shows gradient colors normally, white when agent is working

import Popover from "corvu/popover";
import type { Component } from "solid-js";
import { useZIndex } from "../contexts/ZIndexContext";
import { formatNumber } from "../utils/number-format";
import { MarkdownRenderer } from "./MarkdownRenderer";

export interface ContextUsageIndicatorProps {
  percentage: number; // 0-100
  model: string;
  limit: number;
  used: number;
}

export const ContextUsageIndicator: Component<ContextUsageIndicatorProps> = (props) => {
  const baseZIndex = useZIndex();

  return (
    <Popover>
      <Popover.Trigger
        as="button"
        class="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-surface-overlay active:scale-85 md:active:scale-90 cursor-pointer relative group/donut"
        aria-label="View context usage"
      >
        <svg width="18" height="18" viewBox="0 0 18 18">
          <title>Context usage indicator</title>
          {/* Background ring - muted normally, white when working */}
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke="var(--theme-text-muted)"
            class="donut-bg-ring"
            stroke-width="2"
            opacity="0.3"
          />

          {/* Filled ring - gradient normally, white when working */}
          <circle
            cx="9"
            cy="9"
            r="7"
            fill="none"
            stroke="url(#contextGradient)"
            class="donut-filled-ring"
            stroke-width="2"
            stroke-dasharray={`${(props.percentage / 100) * 44} 44`}
            stroke-linecap="round"
            transform="rotate(-90 9 9)"
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="contextGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ "stop-color": "var(--theme-gradient-from)" }} />
              <stop offset="100%" style={{ "stop-color": "var(--theme-gradient-to)" }} />
            </linearGradient>
          </defs>
        </svg>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          class="w-fit min-w-72 max-w-96 rounded-xl px-4 py-0 border shadow-2xl bg-surface-raised border-border"
          style={{ "z-index": baseZIndex }}
        >
          <MarkdownRenderer
            content={`**${formatNumber(props.used)} (${props.percentage.toFixed(1)}%)**

\`${props.model}\` with \`${formatNumber(props.limit)}\` limit`}
            class="text-xs"
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
};

export default ContextUsageIndicator;
