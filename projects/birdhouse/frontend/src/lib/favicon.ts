// ABOUTME: Favicon management utility - dynamically updates favicon based on theme and color mode
// ABOUTME: Swaps between theme-specific favicon SVGs to match the active theme

import type { BaseThemeName } from "../theme/themes";
import type { ColorMode } from "./types";

/**
 * Update the page favicon to match the current theme and color mode
 */
export function updateFavicon(baseTheme: BaseThemeName, colorMode: ColorMode): void {
  // Resolve actual color mode (handle "system" preference)
  const isDark =
    colorMode === "dark" || (colorMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const mode = isDark ? "dark" : "light";
  const faviconPath = `/favicons/${baseTheme}-${mode}.svg`;

  // Find or create the favicon link element
  let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;

  if (!faviconLink) {
    faviconLink = document.createElement("link");
    faviconLink.rel = "icon";
    faviconLink.type = "image/svg+xml";
    document.head.appendChild(faviconLink);
  }

  // Update the href
  faviconLink.href = faviconPath;
}
