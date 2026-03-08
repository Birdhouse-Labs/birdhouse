/* GENERATED FILE - DO NOT EDIT MANUALLY */
/* Run `pnpm generate:themes` to regenerate this file */
/* Source: Theme metadata extracted from individual theme files in src/styles/themes/ */

export interface ThemeGradient {
  from: string;
  via: string;
  to: string;
}

export interface ThemeMetadata {
  gradientLight: ThemeGradient;
  gradientDark: ThemeGradient;
}

export const THEME_METADATA: Record<string, ThemeMetadata> = {
  "copper-forest": {
    gradientLight: {
      from: "oklch(64.6% 0.194 41.1deg)",
      via: "oklch(55.3% 0.174 38.4deg)",
      to: "oklch(55.5% 0.146 49deg)",
    },
    gradientDark: {
      from: "oklch(64.6% 0.194 41.1deg)",
      via: "oklch(55.3% 0.174 38.4deg)",
      to: "oklch(55.5% 0.146 49deg)",
    },
  },
  "ember-forge": {
    gradientLight: {
      from: "oklch(70.5% 0.187 47.6deg)",
      via: "oklch(76.9% 0.165 70.1deg)",
      to: "oklch(79.5% 0.162 86deg)",
    },
    gradientDark: {
      from: "oklch(70.5% 0.187 47.6deg)",
      via: "oklch(76.9% 0.165 70.1deg)",
      to: "oklch(63.7% 0.208 25.3deg)",
    },
  },
  "forest-depths": {
    gradientLight: {
      from: "oklch(66.6% 0.157 58.3deg)",
      via: "oklch(64.8% 0.175 131.7deg)",
      to: "oklch(62.7% 0.17 149.2deg)",
    },
    gradientDark: {
      from: "oklch(76.9% 0.165 70.1deg)",
      via: "oklch(76.8% 0.204 130.8deg)",
      to: "oklch(69.6% 0.149 162.5deg)",
    },
  },
  monochrome: {
    gradientLight: {
      from: "#707070",
      via: "#5f5f5f",
      to: "#343434",
    },
    gradientDark: {
      from: "#b6b6b6",
      via: "#dedede",
      to: "#fbfbfb",
    },
  },
  "ocean-depth": {
    gradientLight: {
      from: "oklch(79.7% 0.134 211.5deg)",
      via: "oklch(71.5% 0.126 215.2deg)",
      to: "oklch(68.5% 0.148 237.3deg)",
    },
    gradientDark: {
      from: "oklch(71.5% 0.126 215.2deg)",
      via: "oklch(70.4% 0.123 182.5deg)",
      to: "oklch(60% 0.104 184.7deg)",
    },
  },
  "purple-dream": {
    gradientLight: {
      from: "oklch(62.7% 0.233 303.9deg)",
      via: "oklch(66.7% 0.259 322.1deg)",
      to: "oklch(65.6% 0.212 354.3deg)",
    },
    gradientDark: {
      from: "oklch(62.7% 0.233 303.9deg)",
      via: "oklch(66.7% 0.259 322.1deg)",
      to: "oklch(65.6% 0.212 354.3deg)",
    },
  },
  "sketch-graphite": {
    gradientLight: {
      from: "oklch(57.1% 0.053 72.7deg)",
      via: "oklch(67.1% 0.037 55.7deg)",
      to: "oklch(61.6% 0.045 166.7deg)",
    },
    gradientDark: {
      from: "oklch(75.4% 0.085 67.1deg)",
      via: "oklch(77.8% 0.033 79.9deg)",
      to: "oklch(79.8% 0.036 166.6deg)",
    },
  },
} as const;
