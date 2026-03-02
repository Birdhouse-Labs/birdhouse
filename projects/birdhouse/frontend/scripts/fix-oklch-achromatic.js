#!/usr/bin/env node

/**
 * Fix OKLCH Achromatic Colors
 *
 * Converts oklch(X% 0 nan) to hex equivalents.
 *
 * Problem: oklch(X% 0 nan) renders inconsistently in browsers:
 * - Background colors: transparent/black instead of intended gray
 * - Text colors: works but inconsistent
 *
 * Solution: Convert all achromatic colors (chroma=0, hue=nan) to hex format.
 * Chromatic colors remain in OKLCH format.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Convert OKLCH lightness percentage to hex color
 * @param {number} lightness - Lightness value 0-100
 * @returns {string} Hex color (e.g., "#ffffff")
 */
function oklchLightnessToHex(lightness) {
  // OKLCH lightness is 0-100%, convert to 0-255 RGB value
  const value = Math.round(lightness * 2.55);
  const hex = value.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}

/**
 * Convert oklch(X% 0 nan) to hex
 * @param {string} content - File content
 * @returns {object} { content: string, changeCount: number, changes: array }
 */
function convertOklchToHex(content) {
  const changes = [];
  let changeCount = 0;

  // Match oklch(X% 0 nan) or oklch(X 0 nan) - with or without %
  const pattern = /oklch\((\d+(?:\.\d+)?)%?\s+0\s+nan\)/g;

  const newContent = content.replace(pattern, (match, lightness) => {
    const lightnessNum = parseFloat(lightness);
    const hex = oklchLightnessToHex(lightnessNum);

    changeCount++;
    changes.push({
      from: match,
      to: hex,
      lightness: lightnessNum,
    });

    return hex;
  });

  return { content: newContent, changeCount, changes };
}

/**
 * Process all theme files
 */
function main() {
  console.log("🎨 OKLCH Achromatic Color Converter\n");
  console.log("Converting oklch(X% 0 nan) to hex equivalents...\n");

  const themesDir = path.join(__dirname, "../src/styles/themes");
  const files = fs
    .readdirSync(themesDir)
    .filter((f) => f.endsWith(".css"))
    .sort();

  let totalFiles = 0;
  let totalChanges = 0;
  const fileResults = [];

  files.forEach((file) => {
    const filePath = path.join(themesDir, file);
    const originalContent = fs.readFileSync(filePath, "utf8");

    const {
      content: newContent,
      changeCount,
      changes,
    } = convertOklchToHex(originalContent);

    if (changeCount > 0) {
      // Write the converted content back
      fs.writeFileSync(filePath, newContent, "utf8");

      console.log(`✅ ${file}: ${changeCount} replacements`);

      // Show first few conversions as examples
      if (changes.length > 0) {
        const examples = changes.slice(0, 3);
        examples.forEach((change) => {
          console.log(`   ${change.from} → ${change.to}`);
        });
        if (changes.length > 3) {
          console.log(`   ... and ${changes.length - 3} more`);
        }
      }
      console.log();

      totalFiles++;
      totalChanges += changeCount;
      fileResults.push({ file, changeCount, changes });
    } else {
      console.log(`⏭️  ${file}: no changes needed`);
    }
  });

  console.log("\n" + "=".repeat(60));
  console.log(`✨ Conversion Complete!\n`);
  console.log(`📊 Summary:`);
  console.log(`   Files processed: ${files.length}`);
  console.log(`   Files modified: ${totalFiles}`);
  console.log(`   Total replacements: ${totalChanges}`);
  console.log("=".repeat(60));

  // Show unique conversions
  const uniqueConversions = new Map();
  fileResults.forEach((result) => {
    result.changes.forEach((change) => {
      const key = `${change.lightness}%`;
      if (!uniqueConversions.has(key)) {
        uniqueConversions.set(key, change);
      }
    });
  });

  if (uniqueConversions.size > 0) {
    console.log(`\n📋 Unique Conversions (${uniqueConversions.size}):`);
    Array.from(uniqueConversions.values())
      .sort((a, b) => b.lightness - a.lightness)
      .forEach((change) => {
        console.log(`   oklch(${change.lightness}% 0 nan) → ${change.to}`);
      });
  }

  console.log("\n✅ All theme files updated successfully!");
  console.log("\n💡 Next steps:");
  console.log('   1. Verify: rg "oklch.*nan" src/styles/themes/');
  console.log("   2. Test in browser");
  console.log("   3. Check git diff");
}

// Run the script
main();
