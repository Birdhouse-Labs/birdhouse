// ABOUTME: Reactive media query hook for responsive breakpoint detection
// ABOUTME: Returns boolean signal that updates when window matches/unmatchs query

import { createSignal, onCleanup } from "solid-js";

/**
 * Creates a reactive signal that tracks whether a media query matches.
 * @param query - CSS media query string (e.g., "(min-width: 768px)")
 * @returns Accessor<boolean> - true when query matches, false otherwise
 */
export function createMediaQuery(query: string) {
  if (typeof window === "undefined") {
    // SSR fallback - assume mobile
    return () => false;
  }

  const mediaQuery = window.matchMedia(query);
  const [matches, setMatches] = createSignal(mediaQuery.matches);

  const handleChange = (e: MediaQueryListEvent) => {
    setMatches(e.matches);
  };

  mediaQuery.addEventListener("change", handleChange);
  onCleanup(() => mediaQuery.removeEventListener("change", handleChange));

  return matches;
}
