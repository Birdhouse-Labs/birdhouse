/* GENERATED FILE - DO NOT EDIT MANUALLY */
/* Run `pnpm generate:themes` to regenerate this file */
/* Source: Theme metadata extracted from individual theme files in src/styles/themes/ */

export interface ThemeGradient {
  from: string;
  via: string;
  to: string;
}

export interface ThemeMetadata {
  gradient: ThemeGradient;
  heading: string;
}

export const THEME_METADATA: Record<string, ThemeMetadata> = {
  "copper-forest": {
    gradient: {
      from: "oklch(64.6% 0.194 41.1deg)",
      via: "oklch(55.3% 0.174 38.4deg)",
      to: "oklch(55.5% 0.146 49deg)",
    },
    heading: "oklch(96.2% 0.058 95.6deg)",
  },
  "ember-forge": {
    gradient: {
      from: "oklch(70.5% 0.187 47.6deg)",
      via: "oklch(76.9% 0.165 70.1deg)",
      to: "oklch(63.7% 0.208 25.3deg)",
    },
    heading: "oklch(90.1% 0.073 70.7deg)",
  },
  "forest-depths": {
    gradient: {
      from: "oklch(76.9% 0.165 70.1deg)",
      via: "oklch(76.8% 0.204 130.8deg)",
      to: "oklch(69.6% 0.149 162.5deg)",
    },
    heading: "oklch(96.2% 0.058 95.6deg)",
  },
  monochrome: {
    gradient: {
      from: "#b6b6b6",
      via: "#dedede",
      to: "#fbfbfb",
    },
    heading: "#ffffff",
  },
  "ocean-depth": {
    gradient: {
      from: "oklch(71.5% 0.126 215.2deg)",
      via: "oklch(70.4% 0.123 182.5deg)",
      to: "oklch(60% 0.104 184.7deg)",
    },
    heading: "oklch(95.6% 0.044 203.4deg)",
  },
  "purple-dream": {
    gradient: {
      from: "oklch(62.7% 0.233 303.9deg)",
      via: "oklch(66.7% 0.259 322.1deg)",
      to: "oklch(65.6% 0.212 354.3deg)",
    },
    heading: "oklch(83.3% 0.132 321.4deg)",
  },
  "sketch-graphite": {
    gradient: {
      from: "oklch(75.4% 0.085 67.1deg)",
      via: "oklch(77.8% 0.033 79.9deg)",
      to: "oklch(79.8% 0.036 166.6deg)",
    },
    heading: "oklch(96.5% 0.005 78.3deg)",
  },
} as const;

// Legacy export for backward compatibility
export const THEME_GRADIENTS: Record<string, ThemeGradient> = Object.fromEntries(
  Object.entries(THEME_METADATA).map(([key, value]) => [key, value.gradient]),
) as Record<string, ThemeGradient>;
