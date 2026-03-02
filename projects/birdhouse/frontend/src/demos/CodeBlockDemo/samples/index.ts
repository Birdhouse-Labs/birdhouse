// ABOUTME: Auto-discovers and exports all code sample files using Vite's import.meta.glob
// ABOUTME: Just add a new .ts file to this folder - no manual imports needed!

import type { CodeSample } from "./types";

// Re-export the type from types.ts
export type { CodeSample } from "./types";

// Auto-import all sample files (eager mode for synchronous access)
// Each file should export a named constant matching its filename (e.g., elixir.ts exports `elixir`)
const sampleModules = import.meta.glob<{ [key: string]: CodeSample }>(["./*.ts", "!./index.ts", "!./types.ts"], {
  eager: true,
});

// Extract samples from modules and sort by name
export const samples: CodeSample[] = Object.entries(sampleModules)
  .map(([path, module]) => {
    // Get filename without extension: "./elixir.ts" -> "elixir"
    const filename = path.replace(/^\.\//, "").replace(/\.ts$/, "");
    // Each module exports a named constant matching the filename
    return module[filename];
  })
  .filter((sample): sample is CodeSample => sample !== undefined)
  .sort((a, b) => a.name.localeCompare(b.name));

// File extension mapping for display
export const fileExtensions: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  python: "py",
  java: "java",
  csharp: "cs",
  cpp: "cpp",
  c: "c",
  php: "php",
  sql: "sql",
  go: "go",
  rust: "rs",
  zig: "zig",
  kotlin: "kt",
  ruby: "rb",
  swift: "swift",
  bash: "sh",
  powershell: "ps1",
  html: "html",
  lua: "lua",
  dart: "dart",
  r: "R",
  graphql: "graphql",
  toml: "toml",
  clojure: "clj",
  brainfuck: "bf",
  elixir: "ex",
  haskell: "hs",
  perl: "pl",
  cobol: "cob",
  fortran: "f90",
};
