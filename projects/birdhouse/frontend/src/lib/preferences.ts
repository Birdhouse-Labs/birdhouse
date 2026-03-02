// ABOUTME: Centralized user preferences management with localStorage persistence
// ABOUTME: Handles all app-wide user settings (UI, theme, behavior preferences)

import { createSignal } from "solid-js";
import { CODE_THEME_FAMILIES, DEFAULT_CODE_THEME } from "../theme/codeThemes";
import { BASE_THEMES, type BaseThemeName, THEMES, type ThemeName } from "../theme/themes";
import type { ColorMode, UiSize } from "./types";

// ============================================================================
// UI Size Preference
// ============================================================================

const [uiSize, setUiSize] = createSignal<UiSize>("md");

/**
 * Sets the UI size preference and persists it to localStorage.
 * Affects text scale and component sizing throughout the application.
 *
 * @param size - The UI size: "sm" (small), "md" (medium), or "lg" (large)
 */
export const setUiSizePreference = (size: UiSize) => {
  setUiSize(size);
  localStorage.setItem("uiSize", size);
};

// ============================================================================
// Color Mode Preference
// ============================================================================

const [colorMode, setColorMode] = createSignal<ColorMode>("dark");

/**
 * Sets the color mode preference and persists it to localStorage.
 * Controls whether the app uses light mode, dark mode, or follows system preference.
 *
 * @param mode - The color mode: "light", "dark", or "system"
 */
export const setColorModePreference = (mode: ColorMode) => {
  setColorMode(mode);
  localStorage.setItem("colorMode", mode);
};

// ============================================================================
// Code Theme Preference
// ============================================================================

const [codeTheme, setCodeTheme] = createSignal<string>(DEFAULT_CODE_THEME);

/**
 * Sets the code syntax highlighting theme and persists it to localStorage.
 * The theme automatically adapts to light/dark mode variants.
 *
 * @param theme - The code theme family ID (e.g., "github", "dracula")
 */
export const setCodeThemePreference = (theme: string) => {
  setCodeTheme(theme);
  localStorage.setItem("codeTheme", theme);
};

// ============================================================================
// Active Theme Preference
// ============================================================================

const [activeTheme, setActiveTheme] = createSignal<ThemeName>("purple-dream-dark");

/**
 * Sets the active theme and persists it to localStorage.
 * Expects a full theme name including the light/dark suffix (e.g., "purple-dream-dark").
 *
 * @param theme - The full theme name (e.g., "purple-dream-dark", "ocean-blue-light")
 */
export const setTheme = (theme: ThemeName) => {
  setActiveTheme(theme);
  localStorage.setItem("theme", theme);
};

// ============================================================================
// Keep Agent in View Preference
// ============================================================================

const [keepAgentInView, setKeepAgentInView] = createSignal(true);

/**
 * Sets whether to keep the selected agent in view when the tree refreshes.
 * When enabled, the tree automatically scrolls to show the selected agent.
 *
 * @param value - Whether to keep agent in view (true) or not (false)
 */
export const setKeepAgentInViewPreference = (value: boolean) => {
  setKeepAgentInView(value);
  localStorage.setItem("keepAgentInView", value.toString());
};

// ============================================================================
// System Detection Helper
// ============================================================================

/**
 * Detects if the system is in dark mode.
 * Used during initialization for "system" color mode preference.
 *
 * @returns true if system prefers dark mode, false otherwise
 */
const getSystemDarkMode = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

// ============================================================================
// Initialize from localStorage
// ============================================================================

if (typeof window !== "undefined") {
  // Color Mode
  const savedMode = localStorage.getItem("colorMode") as ColorMode | null;
  if (savedMode && ["light", "dark", "system"].includes(savedMode)) {
    setColorMode(savedMode);
  }

  // Theme (with legacy migration support)
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    if (THEMES.includes(savedTheme as ThemeName)) {
      // Valid full theme name (e.g., "purple-dream-dark")
      setActiveTheme(savedTheme as ThemeName);
    } else if (BASE_THEMES.includes(savedTheme as BaseThemeName)) {
      // Legacy migration: convert base theme to full theme based on color mode
      const effectiveColorMode = savedMode || "dark";
      const dark = effectiveColorMode === "dark" || (effectiveColorMode === "system" && getSystemDarkMode());
      const variant = dark ? "-dark" : "-light";
      const fullTheme = `${savedTheme}${variant}` as ThemeName;
      setActiveTheme(fullTheme);
    }
  }

  // UI Size
  const savedUiSize = localStorage.getItem("uiSize") as UiSize | null;
  if (savedUiSize && ["sm", "md", "lg"].includes(savedUiSize)) {
    setUiSize(savedUiSize);
  }

  // Code Theme
  const savedCodeTheme = localStorage.getItem("codeTheme");
  if (savedCodeTheme && CODE_THEME_FAMILIES[savedCodeTheme]) {
    setCodeTheme(savedCodeTheme);
  }

  // Keep Agent in View
  const savedKeepAgentInView = localStorage.getItem("keepAgentInView");
  if (savedKeepAgentInView !== null) {
    setKeepAgentInView(savedKeepAgentInView === "true");
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  // UI Size
  uiSize,
  setUiSize,
  // Color Mode
  colorMode,
  setColorMode,
  // Code Theme
  codeTheme,
  setCodeTheme,
  // Active Theme
  activeTheme,
  setActiveTheme,
  // Keep Agent in View
  keepAgentInView,
};
