// ABOUTME: Initializes PostHog analytics with Birdhouse defaults
// ABOUTME: Provides helpers for user identification and toolbar controls

import posthog from "posthog-js";
import "posthog-js/dist/recorder";
import "posthog-js/dist/external-scripts-loader";
import { log } from "./logger";

const posthogKey = "phc_LwyUqyfUjlP28aI98eE2K7jA6mdTboPZYRuKotWsoYI";
let initialized = false;

const toolbarParamsKey = "_postHogToolbarParams";
const maskedTextSelector = ".ph-mask-text";

export function initPosthog() {
  if (initialized) return;

  if (!posthogKey) {
    log.ui.warn("PostHog disabled: key is missing");
    return;
  }

  const toolbarParams = localStorage.getItem(toolbarParamsKey);
  const hasToolbar = Boolean(toolbarParams && toolbarParams !== "{}");

  window.posthog = posthog;
  window.enablePostHogToolbar = () => {
    posthog.config.disable_external_dependency_loading = false;
  };

  posthog.init(posthogKey, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2025-11-30",
    __preview_disable_xhr_credentials: true,
    disable_external_dependency_loading: !hasToolbar,
    // Disable pageview capture when toolbar is active to avoid URL interference with hash routing
    capture_pageview: hasToolbar ? false : "history_change",
    capture_pageleave: true,
    autocapture: true,
    capture_exceptions: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: maskedTextSelector,
      recordCrossOriginIframes: false,
    },
    loaded: (ph) => {
      ph.register({
        environment: import.meta.env.PROD ? "production" : "development",
        product: "birdhouse-app",
      });
    },
  });

  initialized = true;
}

export function identifyPosthogUser(installId: string, name: string) {
  if (!initialized || !posthogKey) return;

  posthog.identify(installId, { name });
}

export function resetPosthogUser() {
  if (!initialized || !posthogKey) return;
  posthog.reset();
}
