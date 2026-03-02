// ABOUTME: Disclosure demo component showing show/hide content toggle
// ABOUTME: Demonstrates corvu Disclosure for progressive disclosure patterns

import Disclosure from "corvu/disclosure";
import type { Component } from "solid-js";

const DisclosureDemo: Component = () => {
  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Disclosure</h2>
        <p class="text-sm text-text-secondary hidden md:block">Show/hide content toggle</p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-8 space-y-8">
        <div class="w-full max-w-md min-w-[28rem]">
          <Disclosure>
            {(props) => (
              <div class="w-full rounded-xl overflow-hidden border bg-surface-raised/30 border-border/50">
                <Disclosure.Trigger class="w-full px-4 py-3 flex justify-between items-center text-left transition-colors hover:bg-surface-overlay/50">
                  <span class="font-medium">{props.expanded ? "Hide" : "Show"} Additional Info</span>
                  <svg
                    aria-hidden="true"
                    class="w-5 h-5 transition-transform duration-200 text-text-muted"
                    classList={{
                      "rotate-180": props.expanded,
                    }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </Disclosure.Trigger>
                <Disclosure.Content class="overflow-hidden">
                  <div class="px-4 pb-4 text-sm text-text-secondary">
                    <p class="mb-2">
                      The Disclosure component is perfect for progressive disclosure patterns. It helps reduce cognitive
                      load by hiding secondary information until needed.
                    </p>
                    <p>
                      Unlike an Accordion, a Disclosure is a standalone toggle—perfect for FAQs, expandable sections, or
                      any show/hide interaction.
                    </p>
                  </div>
                </Disclosure.Content>
              </div>
            )}
          </Disclosure>
        </div>
      </div>
    </div>
  );
};

export default DisclosureDemo;
