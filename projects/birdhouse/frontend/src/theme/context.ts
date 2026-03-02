// ABOUTME: Theme context managing theme selection and dark/light mode
// ABOUTME: Handles localStorage persistence and applies data-theme attribute

import { createEffect, createMemo, createRoot, onCleanup } from "solid-js";
import { updateFavicon } from "../lib/favicon";
import { activeTheme, codeTheme, colorMode, setActiveTheme, setColorMode, uiSize } from "../lib/preferences";
import type { UiSize } from "../lib/types";
import { resolveCodeTheme } from "./codeThemes";
import type { BaseThemeName, ThemeName } from "./themes";

// Helper to extract base theme name (strip -light/-dark suffix)
const getBaseTheme = (theme: ThemeName): BaseThemeName => {
  return theme.replace(/-light$/, "").replace(/-dark$/, "") as BaseThemeName;
};

// Helper to construct full theme name from base and dark/light preference
const getThemeForColorMode = (base: BaseThemeName, dark: boolean): ThemeName => {
  const variant = dark ? "-dark" : "-light";
  return `${base}${variant}` as ThemeName;
};

// Preferences are now imported from ../lib/preferences
// Types are imported from ../lib/types

// isDark is derived from the theme name
const isDark = () => activeTheme().endsWith("-dark");

// System dark mode detection
const getSystemDarkMode = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

// Single createRoot for all global reactive computations
let resolvedCodeTheme: ReturnType<typeof createMemo<string>>;

export const disposeThemeSystem = createRoot((dispose) => {
  // Resolved syntax theme based on codeTheme family and dark/light mode
  resolvedCodeTheme = createMemo(() => resolveCodeTheme(codeTheme(), isDark()));

  // Apply theme to document
  createEffect(() => {
    document.documentElement.setAttribute("data-theme", activeTheme());
  });

  // Update favicon when theme or color mode changes
  createEffect(() => {
    const base = getBaseTheme(activeTheme());
    const mode = colorMode();
    updateFavicon(base, mode);
  });

  // Update activeTheme based on colorMode changes
  createEffect(() => {
    const mode = colorMode();
    const base = getBaseTheme(activeTheme());
    if (mode === "system") {
      setActiveTheme(getThemeForColorMode(base, getSystemDarkMode()));
    } else {
      setActiveTheme(getThemeForColorMode(base, mode === "dark"));
    }
  });

  // Listen for system theme changes with proper cleanup
  if (typeof window !== "undefined") {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (colorMode() === "system") {
        const base = getBaseTheme(activeTheme());
        setActiveTheme(getThemeForColorMode(base, e.matches));
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    onCleanup(() => mediaQuery.removeEventListener("change", handleChange));
  }

  // Apply uiSize to global text scaling via CSS variable
  createEffect(() => {
    const size = uiSize();
    const scaleFactors: Record<UiSize, number> = {
      sm: 0.875,
      md: 1,
      lg: 1.125,
    };
    const scale = scaleFactors[size];
    document.documentElement.style.setProperty("--global-text-scale", scale.toString());
  });

  return dispose;
});

// Toggle dark/light and persist
const toggleTheme = () => {
  const base = getBaseTheme(activeTheme());
  const newDark = !isDark();
  const newMode = newDark ? "dark" : "light";
  const newTheme = getThemeForColorMode(base, newDark);

  setColorMode(newMode);
  setActiveTheme(newTheme);
  localStorage.setItem("colorMode", newMode);
  localStorage.setItem("theme", newTheme);
};

// Set base theme while preserving current light/dark mode
const setBaseTheme = (base: BaseThemeName) => {
  const newTheme = getThemeForColorMode(base, isDark());
  setActiveTheme(newTheme);
  localStorage.setItem("theme", newTheme);
};

// localStorage initialization is now handled in ../lib/preferences

// Move uiSize effect into the main createRoot above
// (This was previously a separate createRoot - now consolidated)

// Get the base theme name from the active theme (for UI display)
const activeBaseTheme = () => getBaseTheme(activeTheme());

export {
  // Theme computations and derived state
  isDark,
  activeBaseTheme,
  resolvedCodeTheme,
  // Theme manipulation functions
  toggleTheme,
  setBaseTheme,
};
