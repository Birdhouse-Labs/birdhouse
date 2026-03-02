// ABOUTME: Barrel export for theme context
// ABOUTME: Re-exports theme signals, functions, and code theme utilities

// Preference signals and setters from lib/preferences
export {
  activeTheme,
  codeTheme,
  colorMode,
  // Direct setters (for internal use by theme system)
  setActiveTheme,
  setCodeTheme,
  setCodeThemePreference,
  setColorMode,
  setColorModePreference,
  setTheme,
  setUiSize,
  setUiSizePreference,
  uiSize,
} from "../lib/preferences";

// Preference types from lib/types
export type { ColorMode, UiSize } from "../lib/types";
export {
  CODE_THEME_DISPLAY_NAMES,
  CODE_THEME_FAMILIES,
  CODE_THEME_IDS,
  DEFAULT_CODE_THEME,
} from "./codeThemes";

// Theme computations and manipulation from context
export {
  activeBaseTheme,
  isDark,
  resolvedCodeTheme,
  setBaseTheme,
  toggleTheme,
} from "./context";

// Theme types and constants
export type { BaseThemeName, ThemeName } from "./themes";
export { BASE_THEMES, THEMES } from "./themes";
