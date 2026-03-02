#!/usr/bin/env node

// ABOUTME: Theme consistency validator - ensures all themes define required CSS variables
// ABOUTME: Validates that theme definitions stay in sync with @theme inline usage

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// File paths
const indexCssPath = join(projectRoot, "src/index.css");
const themesDir = join(projectRoot, "src/styles/themes");

/**
 * Extract all CSS variables referenced in @theme inline block
 */
async function extractRequiredVariables() {
  const indexCss = await readFile(indexCssPath, "utf8");

  // Find @theme inline block
  const themeInlineMatch = indexCss.match(/@theme inline\s*\{([\s\S]*?)\}/);
  if (!themeInlineMatch) {
    throw new Error("Could not find @theme inline block in src/index.css");
  }

  const themeInlineContent = themeInlineMatch[1];

  // Extract all var(--theme-*) references (excluding those with fallbacks)
  const varMatches =
    themeInlineContent.match(/var\(--theme-[a-zA-Z0-9-]+\)/g) || [];

  // Extract variable names without var() wrapper
  const variables = varMatches
    .map((match) => match.replace(/var\((--theme-[a-zA-Z0-9-]+)\)/, "$1"))
    .filter((v, i, arr) => arr.indexOf(v) === i) // Remove duplicates
    .sort();

  console.log(
    `📋 Found ${variables.length} required theme variables in @theme inline:`,
  );
  for (const variable of variables) {
    console.log(`   ${variable}`);
  }

  return variables;
}

/**
 * Extract CSS variables defined in a theme file
 */
async function extractThemeVariables(themeFilePath) {
  const content = await readFile(themeFilePath, "utf8");

  // Extract --theme-* variable definitions
  const varMatches = content.match(/^\s*(--theme-[a-zA-Z0-9-]+):/gm) || [];

  const variables = varMatches
    .map((match) => match.trim().replace(/:.*$/, "")) // Remove everything after :
    .sort();

  return variables;
}

/**
 * Get all theme files and their defined variables
 */
async function scanAllThemes() {
  const files = await readdir(themesDir);
  const themeFiles = files.filter((file) => file.endsWith(".css")).sort();

  const themes = {};

  for (const file of themeFiles) {
    const filePath = join(themesDir, file);
    const variables = await extractThemeVariables(filePath);
    themes[file] = variables;
  }

  return themes;
}

/**
 * Validate theme consistency
 */
async function validateThemes() {
  console.log("🎨 Validating theme consistency...\n");

  try {
    // Get required variables from @theme inline
    const requiredVars = await extractRequiredVariables();
    console.log("");

    // Get all theme definitions
    const themes = await scanAllThemes();
    const themeNames = Object.keys(themes);

    console.log(`🔍 Checking ${themeNames.length} theme files...\n`);

    let hasErrors = false;
    let hasWarnings = false;

    // Check each theme
    for (const themeName of themeNames) {
      const definedVars = themes[themeName];
      const missing = requiredVars.filter((v) => !definedVars.includes(v));
      const extra = definedVars.filter((v) => !requiredVars.includes(v));

      if (missing.length > 0) {
        hasErrors = true;
        console.log(`❌ ${themeName}:`);
        console.log(`   Missing required variables: ${missing.join(", ")}`);
        console.log("");
      }

      if (extra.length > 0) {
        hasWarnings = true;
        console.log(`⚠️  ${themeName}:`);
        console.log(
          `   Unused variables (not in @theme inline): ${extra.join(", ")}`,
        );
        console.log("");
      }

      if (missing.length === 0 && extra.length === 0) {
        console.log(
          `✅ ${themeName}: All ${definedVars.length} variables correct`,
        );
      }
    }

    // Cross-theme consistency check
    console.log("\n🔄 Checking cross-theme consistency...");

    // Group themes by family and check light/dark pairs have same variables
    const families = {};
    for (const themeName of themeNames) {
      const baseName = themeName.replace(/-(light|dark)\.css$/, "");
      if (!families[baseName]) families[baseName] = {};

      const variant = themeName.includes("-light") ? "light" : "dark";
      families[baseName][variant] = themes[themeName];
    }

    for (const [family, variants] of Object.entries(families)) {
      if (variants.light && variants.dark) {
        const lightVars = new Set(variants.light);
        const darkVars = new Set(variants.dark);

        const onlyInLight = [...lightVars].filter((v) => !darkVars.has(v));
        const onlyInDark = [...darkVars].filter((v) => !lightVars.has(v));

        if (onlyInLight.length > 0 || onlyInDark.length > 0) {
          hasErrors = true;
          console.log(`❌ ${family} light/dark pair inconsistent:`);
          if (onlyInLight.length > 0) {
            console.log(`   Only in light: ${onlyInLight.join(", ")}`);
          }
          if (onlyInDark.length > 0) {
            console.log(`   Only in dark: ${onlyInDark.join(", ")}`);
          }
          console.log("");
        } else {
          console.log(
            `✅ ${family}: Light/dark pair consistent (${lightVars.size} variables)`,
          );
        }
      }
    }

    // Final report
    console.log("\n" + "=".repeat(60));
    if (hasErrors) {
      console.log("❌ Theme validation failed.");
      console.log("   Fix missing variables and inconsistencies above.");
      process.exit(1);
    } else if (hasWarnings) {
      console.log("⚠️  Theme validation passed with warnings.");
      console.log("   Consider removing unused variables for cleaner themes.");
    } else {
      console.log("✅ Theme validation passed completely!");
      console.log(
        `   All ${themeNames.length} themes are consistent and complete.`,
      );
    }
  } catch (error) {
    console.error("💥 Theme validation error:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateThemes();
}
