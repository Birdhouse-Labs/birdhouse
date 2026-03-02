// ABOUTME: Banner component showing SSE connection status (disconnected/reconnecting)
// ABOUTME: Only visible when connection is not healthy, positioned at top of viewport

import { type Component, Show } from "solid-js";
import { Transition } from "solid-transition-group";
import type { ConnectionStatus } from "../contexts/StreamingContext";

interface ConnectionStatusBannerProps {
  status: ConnectionStatus;
}

const ConnectionStatusBanner: Component<ConnectionStatusBannerProps> = (props) => {
  return (
    <Transition name="connection-banner">
      <Show when={props.status !== "connected"}>
        <div
          class="fixed top-2 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg border flex items-center gap-2 text-sm bg-surface-raised"
          classList={{
            "border-warning text-warning": props.status === "connecting",
            "border-danger text-danger": props.status === "disconnected",
          }}
        >
          <Show when={props.status === "connecting"}>
            <div class="animate-spin rounded-full h-3 w-3 border-b-2 border-warning" />
            <span>Reconnecting to server...</span>
          </Show>
          <Show when={props.status === "disconnected"}>
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Disconnected icon">
              <title>Disconnected</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
              />
            </svg>
            <span>Disconnected from server</span>
          </Show>
        </div>
      </Show>
    </Transition>
  );
};

export default ConnectionStatusBanner;
