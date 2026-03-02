// ABOUTME: ConnectionStatusBanner demo with single banner and state controls
// ABOUTME: Shows banner in realistic fixed-top position with sample content below

import { type Component, createSignal } from "solid-js";
import ConnectionStatusBanner from "../components/ConnectionStatusBanner";
import type { ConnectionStatus } from "../contexts/StreamingContext";
import { cardSurfaceFlat } from "../styles/containerStyles";

const ConnectionStatusBannerDemo: Component = () => {
  const [status, setStatus] = createSignal<ConnectionStatus>("connecting");

  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Connection Status Banner</h2>
        <p class="text-sm text-text-secondary hidden md:block">Test connection banner in all states and themes</p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto">
        {/* The banner itself - fixed to top of this container */}
        <div class="relative">
          <ConnectionStatusBanner status={status()} />
        </div>

        {/* Demo content */}
        <div class="p-8 space-y-6 max-w-4xl mx-auto">
          {/* State Controls */}
          <div class={`p-6 ${cardSurfaceFlat} rounded-lg space-y-4`}>
            <h2 class="text-lg font-semibold">Connection State</h2>
            <div class="space-y-3">
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={status() === "connecting"}
                  onChange={() => setStatus("connecting")}
                  class="w-4 h-4 cursor-pointer"
                />
                <div class="flex-1">
                  <div class="font-medium">Connecting</div>
                  <div class="text-sm text-text-muted">Yellow/orange warning with spinning loader</div>
                </div>
              </label>

              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={status() === "disconnected"}
                  onChange={() => setStatus("disconnected")}
                  class="w-4 h-4 cursor-pointer"
                />
                <div class="flex-1">
                  <div class="font-medium">Disconnected</div>
                  <div class="text-sm text-text-muted">Red danger banner with disconnect icon</div>
                </div>
              </label>

              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={status() === "connected"}
                  onChange={() => setStatus("connected")}
                  class="w-4 h-4 cursor-pointer"
                />
                <div class="flex-1">
                  <div class="font-medium">Connected</div>
                  <div class="text-sm text-text-muted">Banner hidden (normal operation)</div>
                </div>
              </label>
            </div>
          </div>

          {/* Info Section */}
          <div class={`p-6 ${cardSurfaceFlat} rounded-lg space-y-3`}>
            <h3 class="font-semibold">Current State</h3>
            <div class="text-sm">
              <strong>Status:</strong> <code class="px-2 py-1 bg-surface rounded text-xs">{status()}</code>
            </div>
            <div class="text-sm text-text-secondary">
              {status() === "connected"
                ? "Banner is hidden. This is the normal state when the connection is healthy."
                : "Look at the top of the page to see the banner."}
            </div>
          </div>

          {/* Theme Testing Note */}
          <div class={`p-6 ${cardSurfaceFlat} rounded-lg`}>
            <h3 class="font-semibold mb-3">Theme Testing</h3>
            <p class="text-sm text-text-secondary">
              Use the theme switcher in the app header to see how the banner adapts to different themes. The banner uses
              semantic color tokens (warning and danger) that automatically adjust for each theme.
            </p>
          </div>

          {/* Sample Content to show banner overlay */}
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">Sample Content</h3>
            <p class="text-text-secondary">
              This content demonstrates how the banner appears above your normal page content. The banner is positioned
              fixed at the top with high z-index (z-50) to ensure it's always visible.
            </p>
            <div class="grid grid-cols-2 gap-4">
              <div class={`p-4 ${cardSurfaceFlat} rounded-lg`}>
                <h4 class="font-medium mb-2">Feature 2</h4>
                <p class="text-sm text-text-muted">Sample card content</p>
              </div>
              <div class={`p-4 ${cardSurfaceFlat} rounded-lg`}>
                <h4 class="font-medium mb-2">Feature 3</h4>
                <p class="text-sm text-text-muted">Sample card content</p>
              </div>
              <div class={`p-4 ${cardSurfaceFlat} rounded-lg`}>
                <h4 class="font-medium mb-2">Feature 4</h4>
                <p class="text-sm text-text-muted">Sample card content</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionStatusBannerDemo;
