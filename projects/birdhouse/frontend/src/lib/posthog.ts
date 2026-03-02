// ABOUTME: Initializes PostHog analytics with Birdhouse defaults
// ABOUTME: Provides helpers for user identification and toolbar controls

import posthog from "posthog-js";
import "posthog-js/dist/recorder";
import "posthog-js/dist/external-scripts-loader";
import { log } from "./logger";

/**
 * Minimal user shape needed for PostHog identification.
 * Compatible with Supabase User and other auth providers.
 */
export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

const posthogKey = "phc_LwyUqyfUjlP28aI98eE2K7jA6mdTboPZYRuKotWsoYI";
let initialized = false;

const toolbarParamsKey = "_postHogToolbarParams";
const maskedTextSelector = ".ph-mask-text";

export type PosthogIdentity = {
  distinctId: string;
  properties: Record<string, string | boolean | number | null | undefined>;
};

export function buildPosthogIdentity(user: AuthUser): PosthogIdentity {
  const displayName = (user.user_metadata?.["full_name"] ??
    user.user_metadata?.["name"] ??
    user.email ??
    user.id) as string;

  return {
    distinctId: user.id,
    properties: {
      email: user.email,
      name: displayName,
      username: displayName,
    },
  };
}

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

export function identifyPosthogUser(user: AuthUser) {
  if (!initialized || !posthogKey) return;

  const { distinctId, properties } = buildPosthogIdentity(user);
  posthog.identify(distinctId, properties);
}

export function resetPosthogUser() {
  if (!initialized || !posthogKey) return;
  posthog.reset();
}
