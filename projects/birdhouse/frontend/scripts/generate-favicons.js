#!/usr/bin/env node

// ABOUTME: Favicon generation script - creates theme-specific SVG favicons for each theme + light/dark mode
// ABOUTME: Generates favicons in public/favicons/ directory and updates index.html with favicon switching logic

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// Paths
const publicDir = join(projectRoot, "public");
const faviconsDir = join(publicDir, "favicons");
const themeMetadataPath = join(projectRoot, "src/theme/themeMetadata.ts");

// Birdhouse icon SVG paths (from Header.tsx)
const ICON_PATHS = `
  <path
    d="M12 18v4"
    fill="none"
    stroke="url(#gradient)"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="m17 18 1.956-11.468"
    stroke="url(#gradient)"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="m3 8 7.82-5.615a2 2 0 0 1 2.36 0L21 8"
    stroke="url(#gradient)"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M4 18h16"
    stroke="url(#gradient)"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M7 18 5.044 6.532"
    stroke="url(#gradient)"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <circle
    cx="12"
    cy="10"
    r="2"
    stroke="url(#gradient)"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`;

/**
 * Generate SVG favicon with specific gradient colors
 */
function generateFaviconSvg(gradientFrom, gradientVia, gradientTo) {
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${gradientFrom}" />
      <stop offset="50%" style="stop-color:${gradientVia}" />
      <stop offset="100%" style="stop-color:${gradientTo}" />
    </linearGradient>
  </defs>${ICON_PATHS}</svg>`;
}

/**
 * Parse theme metadata from themeMetadata.ts
 */
async function parseThemeMetadata() {
  const content = await readFile(themeMetadataPath, "utf8");
  
  // Extract THEME_METADATA object using regex
  const metadataMatch = content.match(/export const THEME_METADATA[^=]+=\s*({[\s\S]+?})\s*as const;/);
  if (!metadataMatch) {
    throw new Error("Could not find THEME_METADATA in themeMetadata.ts");
  }

  // Parse the object (simple eval in controlled context)
  // biome-ignore lint: eval is safe here for controlled build script
  const metadata = eval(`(${metadataMatch[1]})`);
  
  return metadata;
}

/**
 * Adjust gradient colors for dark mode (lighter/more vibrant)
 */
function adjustColorsForDarkMode(from, via, to) {
  // For OKLCH colors, increase lightness slightly
  const adjustOklch = (color) => {
    const oklchMatch = color.match(/oklch\(([0-9.]+)%\s+([0-9.]+)\s+([0-9.]+)deg\)/);
    if (oklchMatch) {
      const lightness = Number.parseFloat(oklchMatch[1]);
      const chroma = oklchMatch[2];
      const hue = oklchMatch[3];
      // Increase lightness by 5-10% for dark mode
      const newLightness = Math.min(100, lightness + 8);
      return `oklch(${newLightness}% ${chroma} ${hue}deg)`;
    }
    
    // For hex colors, return as-is (monochrome theme)
    return color;
  };

  return {
    from: adjustOklch(from),
    via: adjustOklch(via),
    to: adjustOklch(to),
  };
}

/**
 * Generate all favicons
 */
async function generateFavicons() {
  console.log("🎨 Generating theme-specific favicons...\n");

  // Create favicons directory
  await mkdir(faviconsDir, { recursive: true });

  // Parse theme metadata
  const themeMetadata = await parseThemeMetadata();
  const themes = Object.keys(themeMetadata);

  console.log(`Found ${themes.length} themes: ${themes.join(", ")}\n`);

  // Generate favicon for each theme + mode
  const generatedFiles = [];
  
  for (const themeName of themes) {
    const theme = themeMetadata[themeName];
    const { from, via, to } = theme.gradient;

    // Light mode version
    const lightSvg = generateFaviconSvg(from, via, to);
    const lightPath = join(faviconsDir, `${themeName}-light.svg`);
    await writeFile(lightPath, lightSvg);
    generatedFiles.push(`${themeName}-light.svg`);
    console.log(`✓ Generated ${themeName}-light.svg`);

    // Dark mode version (adjusted colors)
    const darkColors = adjustColorsForDarkMode(from, via, to);
    const darkSvg = generateFaviconSvg(darkColors.from, darkColors.via, darkColors.to);
    const darkPath = join(faviconsDir, `${themeName}-dark.svg`);
    await writeFile(darkPath, darkSvg);
    generatedFiles.push(`${themeName}-dark.svg`);
    console.log(`✓ Generated ${themeName}-dark.svg`);
  }

  // Generate default favicon (purple-dream light as fallback)
  const defaultTheme = themeMetadata["purple-dream"];
  const defaultSvg = generateFaviconSvg(
    defaultTheme.gradient.from,
    defaultTheme.gradient.via,
    defaultTheme.gradient.to
  );
  const defaultPath = join(publicDir, "favicon.svg");
  await writeFile(defaultPath, defaultSvg);
  console.log("\n✓ Generated default favicon.svg (purple-dream-light)");

  console.log(`\n✅ Generated ${generatedFiles.length} theme-specific favicons!`);
  console.log("\nNext steps:");
  console.log("1. Add JavaScript to swap favicons based on active theme");
  console.log("2. Update index.html to reference /favicon.svg as default");
}

// Run the generator
generateFavicons().catch((error) => {
  console.error("Error generating favicons:", error);
  process.exit(1);
});
