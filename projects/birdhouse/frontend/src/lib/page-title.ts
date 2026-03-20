// ABOUTME: Utility for setting the browser tab title reactively
// ABOUTME: Resets to "Birdhouse" on cleanup when component unmounts

import type { Accessor } from "solid-js";
import { createEffect, onCleanup } from "solid-js";

/**
 * Sets document.title reactively from an accessor or static string.
 * Resets to "Birdhouse" when the calling component unmounts.
 */
export function usePageTitle(title: string | Accessor<string>): void {
  createEffect(() => {
    document.title = typeof title === "function" ? title() : title;
  });

  onCleanup(() => {
    document.title = "Birdhouse";
  });
}
