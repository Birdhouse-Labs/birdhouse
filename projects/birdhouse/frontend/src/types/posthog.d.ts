// ABOUTME: Declares window helpers for PostHog debugging
// ABOUTME: Declares window helpers for PostHog debugging
// ABOUTME: Adds global PostHog toolbar hook for console usage

declare global {
  interface Window {
    posthog?: typeof import("posthog-js").default;
    enablePostHogToolbar?: () => void;
  }
}

export {};
