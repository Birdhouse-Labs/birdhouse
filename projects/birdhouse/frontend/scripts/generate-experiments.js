#!/usr/bin/env node

// ABOUTME: Experiments generation script - scans experiment files and generates experiments index
// ABOUTME: Automatically maintains experiment registry for the experiments page

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// File paths
const experimentsBaseDir = join(projectRoot, "src/experiments");
const experimentsIndexPath = join(projectRoot, "src/experiments/index.ts");

// Experiment categories to scan
const experimentCategories = ["primary-buttons", "agent-top-bar", "header-title", "pattern-library-ui"];

/**
 * Get all experiment files and extract metadata
 */
async function scanExperimentFiles() {
  const allExperiments = {};

  for (const category of experimentCategories) {
    const categoryDir = join(experimentsBaseDir, category);
    let files;
    try {
      files = await readdir(categoryDir);
    } catch (error) {
      console.log(`⚠️  Skipping ${category}: directory not found or empty`);
      continue;
    }

    // Filter for TSX files, exclude template
    const experimentFiles = files
      .filter((file) => file.endsWith(".tsx") && !file.includes("template"))
      .sort()
      .reverse(); // Reverse alphabetical order (newest first)

    console.log(
      `Found ${experimentFiles.length} experiment files in ${category}:`,
    );
    for (const file of experimentFiles) {
      console.log(`  - ${file}`);
    }

    // Extract experiment IDs from filenames
    // Use category-prefixed identifiers to avoid clashes across categories
    const categoryPrefix = category
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
    const experiments = experimentFiles.map((file) => {
      const match = file.match(/experiment-(\d+)/);
      const id = match ? match[1] : file.replace(".tsx", "");
      return {
        id,
        filename: file,
        componentName: `Experiment${categoryPrefix}${id}`,
        metadataName: `metadata${categoryPrefix}${id}`,
        category,
      };
    });

    allExperiments[category] = experiments;
  }

  return allExperiments;
}

/**
 * Extract metadata from experiment file
 */
async function extractMetadata(filepath) {
  const content = await readFile(filepath, "utf8");

  // Try to extract metadata export
  const metadataMatch = content.match(/export const metadata = \{([^}]+)\}/s);
  if (metadataMatch) {
    const metadataContent = metadataMatch[1];
    const titleMatch = metadataContent.match(/title:\s*["']([^"']+)["']/);
    const descMatch = metadataContent.match(/description:\s*["']([^"']+)["']/);
    const dateMatch = metadataContent.match(/date:\s*["']([^"']+)["']/);

    return {
      title: titleMatch ? titleMatch[1] : null,
      description: descMatch ? descMatch[1] : null,
      date: dateMatch ? dateMatch[1] : null,
    };
  }

  return { title: null, description: null, date: null };
}

/**
 * Generate experiments index with imports and registry
 */
async function generateExperimentsIndex(experimentsByCategory) {
  const header = `// GENERATED FILE - DO NOT EDIT MANUALLY
// Run \`pnpm generate:experiments\` to regenerate this file
// Source: Individual experiment files in src/experiments/

`;

  let content = header;

  // Generate imports and registries for each category
  for (const [category, experiments] of Object.entries(experimentsByCategory)) {
    if (experiments.length === 0) continue;

    // Generate imports for this category
    const imports = experiments
      .map(
        (exp) =>
          `import ${exp.componentName}, { metadata as ${exp.metadataName} } from './${category}/experiment-${exp.id}';`,
      )
      .join("\n");

    // Generate registry for this category
    const categoryName = category
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
    const registry = `
export const ${categoryName.charAt(0).toLowerCase() + categoryName.slice(1)}Experiments = [
${experiments
  .map(
    (exp) => `  {
    id: "${exp.id}",
    component: ${exp.componentName},
    metadata: ${exp.metadataName},
  },`,
  )
  .join("\n")}
];
`;

    content += imports + registry;
  }

  await writeFile(experimentsIndexPath, content, "utf8");
  console.log(`✅ Generated: ${experimentsIndexPath}`);
}

/**
 * Main execution
 */
async function main() {
  console.log("🎨 Generating experiments index...\n");

  const experimentsByCategory = await scanExperimentFiles();

  let totalCount = 0;
  for (const [category, experiments] of Object.entries(experimentsByCategory)) {
    if (experiments.length === 0) continue;

    totalCount += experiments.length;

    // Extract metadata from each file
    console.log(`\n📋 Extracting metadata for ${category}...`);
    for (const exp of experiments) {
      const filepath = join(experimentsBaseDir, category, exp.filename);
      const metadata = await extractMetadata(filepath);
      exp.title = metadata.title || `Experiment ${exp.id}`;
      exp.description = metadata.description;
      exp.date = metadata.date;
      console.log(`  ✓ ${exp.id}: ${exp.title}${exp.date ? ` (${exp.date})` : ''}`);
    }

    // Sort by date (newest first), falling back to ID if no date
    experiments.sort((a, b) => {
      if (a.date && b.date) {
        return new Date(b.date) - new Date(a.date);
      }
      if (a.date) return -1; // experiments with dates come first
      if (b.date) return 1;
      return Number(b.id) - Number(a.id); // fallback to numeric ID sort
    });
  }

  if (totalCount === 0) {
    console.log(
      "⚠️  No experiment files found. Create files in src/experiments/",
    );
    return;
  }

  await generateExperimentsIndex(experimentsByCategory);

  console.log("\n✨ Experiments generation complete!");
  console.log(`📊 Total experiments: ${totalCount}`);
}

main().catch((error) => {
  console.error("❌ Error generating experiments:", error);
  process.exit(1);
});
