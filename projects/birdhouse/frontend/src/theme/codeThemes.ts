// ABOUTME: Code syntax highlighting theme definitions
// ABOUTME: Maps theme families to dark/light variants for auto-switching

export interface CodeThemeFamily {
  dark: string;
  light: string | null; // null means dark-only theme
}

// Theme families that have both dark and light variants
// When user selects these, we auto-switch based on app dark/light mode
export const CODE_THEME_FAMILIES: Record<string, CodeThemeFamily> = {
  // GitHub family
  github: { dark: "github-dark", light: "github-light" },
  "github-default": {
    dark: "github-dark-default",
    light: "github-light-default",
  },
  "github-dimmed": { dark: "github-dark-dimmed", light: "github-light" },
  "github-high-contrast": {
    dark: "github-dark-high-contrast",
    light: "github-light-high-contrast",
  },

  // Catppuccin family (multiple dark variants, one light)
  "catppuccin-mocha": { dark: "catppuccin-mocha", light: "catppuccin-latte" },
  "catppuccin-macchiato": {
    dark: "catppuccin-macchiato",
    light: "catppuccin-latte",
  },
  "catppuccin-frappe": { dark: "catppuccin-frappe", light: "catppuccin-latte" },

  // Gruvbox family
  "gruvbox-hard": { dark: "gruvbox-dark-hard", light: "gruvbox-light-hard" },
  "gruvbox-medium": {
    dark: "gruvbox-dark-medium",
    light: "gruvbox-light-medium",
  },
  "gruvbox-soft": { dark: "gruvbox-dark-soft", light: "gruvbox-light-soft" },

  // Other paired families
  everforest: { dark: "everforest-dark", light: "everforest-light" },
  kanagawa: { dark: "kanagawa-wave", light: "kanagawa-lotus" },
  "kanagawa-dragon": { dark: "kanagawa-dragon", light: "kanagawa-lotus" },
  material: { dark: "material-theme-darker", light: "material-theme-lighter" },
  min: { dark: "min-dark", light: "min-light" },
  one: { dark: "one-dark-pro", light: "one-light" },
  plus: { dark: "dark-plus", light: "light-plus" },
  "rose-pine": { dark: "rose-pine", light: "rose-pine-dawn" },
  "rose-pine-moon": { dark: "rose-pine-moon", light: "rose-pine-dawn" },
  slack: { dark: "slack-dark", light: "slack-ochin" },
  solarized: { dark: "solarized-dark", light: "solarized-light" },
  vitesse: { dark: "vitesse-dark", light: "vitesse-light" },
  "vitesse-black": { dark: "vitesse-black", light: "vitesse-light" },

  // Dark-only themes (light fallback to github-light for app light mode)
  andromeeda: { dark: "andromeeda", light: null },
  "aurora-x": { dark: "aurora-x", light: null },
  "ayu-dark": { dark: "ayu-dark", light: null },
  dracula: { dark: "dracula", light: null },
  "dracula-soft": { dark: "dracula-soft", light: null },
  houston: { dark: "houston", light: null },
  laserwave: { dark: "laserwave", light: null },
  "material-ocean": { dark: "material-theme-ocean", light: null },
  "material-palenight": { dark: "material-theme-palenight", light: null },
  monokai: { dark: "monokai", light: null },
  "night-owl": { dark: "night-owl", light: null },
  nord: { dark: "nord", light: null },
  plastic: { dark: "plastic", light: null },
  poimandres: { dark: "poimandres", light: null },
  "synthwave-84": { dark: "synthwave-84", light: null },
  "tokyo-night": { dark: "tokyo-night", light: null },
  vesper: { dark: "vesper", light: null },

  // Light-only theme
  "snazzy-light": { dark: "snazzy-light", light: "snazzy-light" },
};

// Display names for the dropdown (prettier than the IDs)
export const CODE_THEME_DISPLAY_NAMES: Record<string, string> = {
  github: "GitHub",
  "github-default": "GitHub Default",
  "github-dimmed": "GitHub Dimmed",
  "github-high-contrast": "GitHub High Contrast",
  "catppuccin-mocha": "Catppuccin Mocha",
  "catppuccin-macchiato": "Catppuccin Macchiato",
  "catppuccin-frappe": "Catppuccin Frappé",
  "gruvbox-hard": "Gruvbox Hard",
  "gruvbox-medium": "Gruvbox Medium",
  "gruvbox-soft": "Gruvbox Soft",
  everforest: "Everforest",
  kanagawa: "Kanagawa Wave",
  "kanagawa-dragon": "Kanagawa Dragon",
  material: "Material",
  min: "Min",
  one: "One Dark/Light",
  plus: "VS Code Plus",
  "rose-pine": "Rosé Pine",
  "rose-pine-moon": "Rosé Pine Moon",
  slack: "Slack",
  solarized: "Solarized",
  vitesse: "Vitesse",
  "vitesse-black": "Vitesse Black",
  andromeeda: "Andromeeda ●",
  "aurora-x": "Aurora X ●",
  "ayu-dark": "Ayu Dark ●",
  dracula: "Dracula ●",
  "dracula-soft": "Dracula Soft ●",
  houston: "Houston ●",
  laserwave: "Laserwave ●",
  "material-ocean": "Material Ocean ●",
  "material-palenight": "Material Palenight ●",
  monokai: "Monokai ●",
  "night-owl": "Night Owl ●",
  nord: "Nord ●",
  plastic: "Plastic ●",
  poimandres: "Poimandres ●",
  "synthwave-84": "Synthwave '84 ●",
  "tokyo-night": "Tokyo Night ●",
  vesper: "Vesper ●",
  "snazzy-light": "Snazzy Light ○",
};

// Get sorted list of theme IDs for the dropdown
export const CODE_THEME_IDS = Object.keys(CODE_THEME_FAMILIES).sort((a, b) => {
  const nameA = CODE_THEME_DISPLAY_NAMES[a] ?? a;
  const nameB = CODE_THEME_DISPLAY_NAMES[b] ?? b;
  return nameA.localeCompare(nameB);
});

// Default theme
export const DEFAULT_CODE_THEME = "github";

// Resolve the actual syntax theme ID based on selected family and dark/light mode
export function resolveCodeTheme(familyId: string, isDark: boolean): string {
  const family = CODE_THEME_FAMILIES[familyId];
  if (!family) {
    return isDark ? "github-dark" : "github-light";
  }

  if (isDark) {
    return family.dark;
  }

  // For light mode: use light variant if available, otherwise use dark variant
  // (dark-only themes will just stay dark, which looks fine on light backgrounds)
  return family.light ?? family.dark;
}
