// ABOUTME: Popover demo component showing floating content panels
// ABOUTME: Demonstrates corvu Popover with interactive settings controls

import Popover from "corvu/popover";
import type { Component } from "solid-js";
import { Button } from "../components/ui";
import { cardSurfaceFlat } from "../styles/containerStyles";
import { isDark, toggleTheme } from "../theme";

const PopoverDemo: Component = () => {
  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Popover</h2>
        <p class="text-sm text-text-secondary hidden md:block">Floating content panels</p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Interactive Example */}
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-heading">Interactive Example</h3>
          <div class={`rounded-xl ${cardSurfaceFlat} p-6`}>
            <Popover>
              <Popover.Trigger as={Button} variant="primary">
                Click for Popover
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content class={`z-50 w-72 rounded-xl p-4 ${cardSurfaceFlat} shadow-2xl`}>
                  <Popover.Label class="font-bold mb-2 block text-heading">Quick Settings</Popover.Label>
                  <Popover.Description class="text-sm mb-4 text-text-secondary">
                    Adjust your preferences here.
                  </Popover.Description>
                  <div class="space-y-3">
                    <label class="flex items-center justify-between">
                      <span class="text-sm text-text-secondary">Dark Mode</span>
                      <button
                        type="button"
                        onClick={toggleTheme}
                        class="w-10 h-6 rounded-full relative transition-colors"
                        aria-label={isDark() ? "Switch to light mode" : "Switch to dark mode"}
                        classList={{
                          "bg-accent": isDark(),
                          "bg-border-muted": !isDark(),
                        }}
                      >
                        <div
                          class="absolute top-1 w-4 h-4 bg-white rounded-full transition-all"
                          classList={{
                            "right-1": isDark(),
                            "left-1": !isDark(),
                          }}
                        />
                      </button>
                    </label>
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-text-secondary">Notifications</span>
                      <div class="w-10 h-6 rounded-full relative bg-border-muted" aria-hidden="true">
                        <div class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
                      </div>
                    </div>
                  </div>
                  <Popover.Close as={Button} variant="secondary" class="mt-4 w-full">
                    Done
                  </Popover.Close>
                  <Popover.Arrow class="fill-surface-raised" />
                </Popover.Content>
              </Popover.Portal>
            </Popover>
          </div>
        </div>

        {/* Features Section */}
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-heading">Features</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class={`rounded-lg ${cardSurfaceFlat} p-4 space-y-2`}>
              <h4 class="font-medium text-accent">Floating Positioning</h4>
              <p class="text-sm text-text-secondary">Automatically positions content to stay within viewport bounds</p>
            </div>
            <div class={`rounded-lg ${cardSurfaceFlat} p-4 space-y-2`}>
              <h4 class="font-medium text-accent">Keyboard Support</h4>
              <p class="text-sm text-text-secondary">ESC key closes popover, Tab manages focus within content</p>
            </div>
            <div class={`rounded-lg ${cardSurfaceFlat} p-4 space-y-2`}>
              <h4 class="font-medium text-accent">Accessibility</h4>
              <p class="text-sm text-text-secondary">Built with ARIA attributes and proper focus management</p>
            </div>
            <div class={`rounded-lg ${cardSurfaceFlat} p-4 space-y-2`}>
              <h4 class="font-medium text-accent">Portal Rendering</h4>
              <p class="text-sm text-text-secondary">Renders outside DOM hierarchy to avoid stacking context issues</p>
            </div>
          </div>
        </div>

        {/* Usage Examples */}
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-heading">Usage Examples</h3>
          <div class={`rounded-xl ${cardSurfaceFlat} p-6 space-y-4`}>
            <div>
              <h4 class="font-medium text-heading mb-2">Basic Usage</h4>
              <pre class="text-xs text-text-secondary overflow-x-auto">
                {`<Popover>
  <Popover.Trigger as={Button}>
    Open
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content>
      Content here
    </Popover.Content>
  </Popover.Portal>
</Popover>`}
              </pre>
            </div>
            <div>
              <h4 class="font-medium text-heading mb-2">With Label and Description</h4>
              <pre class="text-xs text-text-secondary overflow-x-auto">
                {`<Popover.Content>
  <Popover.Label>Title</Popover.Label>
  <Popover.Description>Description</Popover.Description>
  <div>Content</div>
  <Popover.Close as={Button}>Close</Popover.Close>
</Popover.Content>`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PopoverDemo;
