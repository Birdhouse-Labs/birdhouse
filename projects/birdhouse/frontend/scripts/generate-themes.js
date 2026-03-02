#!/usr/bin/env node

// ABOUTME: Theme generation script - scans individual theme CSS files and generates themes.css + themes.ts
// ABOUTME: Automatically maintains theme registries and imports for the theming system

import { execSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// File paths
const themesDir = join(projectRoot, "src/styles/themes");
const themesCssPath = join(projectRoot, "src/styles/themes.css");
const themesTsPath = join(projectRoot, "src/theme/themes.ts");
const themeMetadataPath = join(projectRoot, "src/theme/themeMetadata.ts");

/**
 * Parse theme metadata from a theme CSS file
 */
async function parseThemeMetadata(themeFilePath) {
  const content = await readFile(themeFilePath, "utf8");

  const metadata = {
    gradients: {},
    heading: null,
  };

  // Match --theme-gradient-from, via, to
  const fromMatch = content.match(/--theme-gradient-from:\s*([^;]+);/);
  const viaMatch = content.match(/--theme-gradient-via:\s*([^;]+);/);
  const toMatch = content.match(/--theme-gradient-to:\s*([^;]+);/);

  if (fromMatch) metadata.gradients.from = fromMatch[1].split("/*")[0].trim();
  if (viaMatch) metadata.gradients.via = viaMatch[1].split("/*")[0].trim();
  if (toMatch) metadata.gradients.to = toMatch[1].split("/*")[0].trim();

  // Match --theme-heading color
  const headingMatch = content.match(/--theme-heading:\s*([^;]+);/);
  if (headingMatch) metadata.heading = headingMatch[1].split("/*")[0].trim();

  return metadata;
}

/**
 * Get all theme CSS files and extract theme information
 */
async function scanThemeFiles() {
  let files;
  try {
    files = await readdir(themesDir);
  } catch (error) {
    throw new Error(
      `Could not read themes directory: ${themesDir}. Error: ${error.message}`,
    );
  }

  // Filter for CSS files and extract theme names
  const themeFiles = files.filter((file) => file.endsWith(".css")).sort(); // Alphabetical order

  const themes = themeFiles.map((file) => file.replace(".css", ""));

  // Extract base theme names (remove -light/-dark suffix)
  const baseThemes = [
    ...new Set(themes.map((theme) => theme.replace(/-(?:light|dark)$/, ""))),
  ].sort();

  console.log(`Found ${themes.length} theme files:`);
  for (const theme of themes) {
    console.log(`  - ${theme}`);
  }
  console.log(`Extracted ${baseThemes.length} base theme families:`);
  for (const base of baseThemes) {
    console.log(`  - ${base}`);
  }

  return { themeFiles, themes, baseThemes };
}

/**
 * Generate themes.css with imports
 */
function generateThemesCss(themeFiles, baseThemes) {
  const header = `/* GENERATED FILE - DO NOT EDIT MANUALLY */
/* Run \`pnpm generate:themes\` to regenerate this file */
/* Source: Individual theme files in src/styles/themes/ */

`;

  // Group theme files by base theme
  const themesByFamily = {};
  themeFiles.forEach((file) => {
    const themeName = file.replace(".css", "");
    const baseTheme = themeName.replace(/-(?:light|dark)$/, "");
    if (!themesByFamily[baseTheme]) {
      themesByFamily[baseTheme] = [];
    }
    themesByFamily[baseTheme].push(file);
  });

  // Generate imports grouped by theme family
  let imports = "";
  baseThemes.forEach((baseTheme) => {
    if (themesByFamily[baseTheme]) {
      const familyName = baseTheme
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      imports += `/* ${familyName} Theme Family */\n`;
      for (const file of themesByFamily[baseTheme].sort()) {
        imports += `@import './themes/${file}';\n`;
      }
      imports += "\n";
    }
  });

  return header + imports.trim();
}

/**
 * Generate themes.ts with arrays and types
 */
function generateThemesTs(themes, baseThemes) {
  const header = `/* GENERATED FILE - DO NOT EDIT MANUALLY */
/* Run \`pnpm generate:themes\` to regenerate this file */
/* Source: Individual theme files in src/styles/themes/ */

`;

  const themesArray = `export const THEMES = [
${themes.map((theme) => `  "${theme}",`).join("\n")}
] as const;

export type ThemeName = (typeof THEMES)[number];

`;

  const baseThemesArray = `export const BASE_THEMES = [
${baseThemes.map((base) => `  "${base}",`).join("\n")}
] as const;

export type BaseThemeName = (typeof BASE_THEMES)[number];
`;

  return header + themesArray + baseThemesArray;
}

/**
 * Generate themeMetadata.ts with gradient colors and heading colors for UI rendering
 */
function generateThemeMetadata(metadataByTheme, baseThemes) {
  const header = `/* GENERATED FILE - DO NOT EDIT MANUALLY */
/* Run \`pnpm generate:themes\` to regenerate this file */
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

`;

  const metadataObject = `export const THEME_METADATA: Record<string, ThemeMetadata> = {
${baseThemes
  .map((base) => {
    const metadata = metadataByTheme[base];
    if (!metadata || !metadata.gradients || !metadata.heading) {
      return `  "${base}": {
    gradient: { from: "#000000", via: "#000000", to: "#000000" },
    heading: "#000000",
  }, // Error: missing data`;
    }
    const g = metadata.gradients;
    return `  "${base}": {
    gradient: {
      from: "${g.from}",
      via: "${g.via}",
      to: "${g.to}",
    },
    heading: "${metadata.heading}",
  },`;
  })
  .join("\n")}
} as const;

// Legacy export for backward compatibility
export const THEME_GRADIENTS: Record<string, ThemeGradient> =
  Object.fromEntries(
    Object.entries(THEME_METADATA).map(([key, value]) => [key, value.gradient]),
  ) as Record<string, ThemeGradient>;
`;

  return header + metadataObject;
}

/**
 * Main generation function
 */
async function generateThemes() {
  console.log("🎨 Generating theme files...");

  try {
    // Scan theme files
    const { themeFiles, themes, baseThemes } = await scanThemeFiles();

    if (themes.length === 0) {
      throw new Error("No theme files found in src/styles/themes/");
    }

    // Parse theme metadata from all theme files
    console.log("\n🎨 Extracting theme metadata...");
    const metadataByTheme = {};
    for (const file of themeFiles) {
      const themeName = file.replace(".css", "");
      const baseTheme = themeName.replace(/-(?:light|dark)$/, "");
      const filePath = join(themesDir, file);

      const metadata = await parseThemeMetadata(filePath);

      // Use the first variant (light or dark) we encounter for each base theme
      // Both should have the same gradient colors anyway
      if (!metadataByTheme[baseTheme]) {
        metadataByTheme[baseTheme] = metadata;
        console.log(`  ${baseTheme}:`);
        console.log(
          `    Gradient: ${metadata.gradients.from} → ${metadata.gradients.via} → ${metadata.gradients.to}`,
        );
        console.log(`    Heading: ${metadata.heading}`);
      }
    }

    // Generate CSS file
    const cssContent = generateThemesCss(themeFiles, baseThemes);
    await writeFile(themesCssPath, cssContent, "utf8");
    console.log(`\n✅ Generated ${themesCssPath}`);

    // Generate TypeScript file
    const tsContent = generateThemesTs(themes, baseThemes);
    await writeFile(themesTsPath, tsContent, "utf8");
    console.log(`✅ Generated ${themesTsPath}`);

    // Generate theme metadata file with gradients and heading colors
    const metadataContent = generateThemeMetadata(metadataByTheme, baseThemes);
    await writeFile(themeMetadataPath, metadataContent, "utf8");
    console.log(`✅ Generated ${themeMetadataPath}`);

    // Format generated TypeScript files with biome (format only, no linting)
    console.log("\n🔧 Formatting generated files...");
    const { execSync } = await import("node:child_process");
    execSync(
      `npx biome format ${themesTsPath} ${themeMetadataPath} --write --no-errors-on-unmatched`,
      { stdio: "inherit", cwd: projectRoot },
    );
    console.log("✅ Formatted generated files");

    console.log(`\n🎉 Successfully generated theme files!`);
    console.log(`   Themes: ${themes.length} individual themes`);
    console.log(`   Families: ${baseThemes.length} base theme families`);
    console.log(
      `   Theme metadata: ${Object.keys(metadataByTheme).length} base themes`,
    );
  } catch (error) {
    console.error("❌ Theme generation failed:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateThemes();
}
