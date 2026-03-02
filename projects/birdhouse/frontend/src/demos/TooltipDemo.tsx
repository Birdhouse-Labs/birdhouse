// ABOUTME: Tooltip demo component showing contextual information on hover
// ABOUTME: Demonstrates corvu Tooltip with arrow and customizable delay

import Tooltip from "corvu/tooltip";
import type { Component } from "solid-js";
import { Button } from "../components/ui";

const TooltipDemo: Component = () => {
  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Tooltip</h2>
        <p class="text-sm text-text-secondary hidden md:block">Contextual information on hover</p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-8 space-y-8">
        <div class="flex gap-4">
          <Tooltip>
            <Tooltip.Trigger as={Button} variant="primary">
              Hover me
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content class="z-50 px-3 py-2 text-sm rounded-lg shadow-xl border bg-surface-overlay text-text-primary border-border">
                This is a tooltip!
                <Tooltip.Arrow class="fill-surface-overlay" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip>

          <Tooltip openDelay={0}>
            <Tooltip.Trigger as={Button} variant="primary">
              Instant tooltip
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content class="z-50 px-3 py-2 text-sm rounded-lg shadow-xl border bg-surface-overlay text-text-primary border-border">
                No delay on this one!
                <Tooltip.Arrow class="fill-surface-overlay" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default TooltipDemo;
