// ABOUTME: Auto-discovers and exports all diff sample files using Vite's import.meta.glob
// ABOUTME: Just add a new .ts file to this folder - no manual imports needed!

import type { DiffSample } from "./types";

// Re-export the type from types.ts
export type { DiffSample } from "./types";

// Auto-import all sample files (eager mode for synchronous access)
const sampleModules = import.meta.glob<{ [key: string]: DiffSample }>(["./*.ts", "!./index.ts", "!./types.ts"], {
  eager: true,
});

// Extract samples from modules and sort by name
export const samples: DiffSample[] = Object.entries(sampleModules)
  .map(([path, module]) => {
    // Get filename without extension: "./bug-fix.ts" -> "bugFix"
    // Convert kebab-case to camelCase for export name
    const filename = path.replace(/^\.\//, "").replace(/\.ts$/, "");
    const exportName = filename.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return module[exportName];
  })
  .filter((sample): sample is DiffSample => sample !== undefined)
  .sort((a, b) => a.name.localeCompare(b.name));
