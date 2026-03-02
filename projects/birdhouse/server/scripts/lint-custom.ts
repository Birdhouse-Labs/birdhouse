// ABOUTME: Custom lint rules for Birdhouse server project
// ABOUTME: Prevents stream instance mismatch bugs in tests

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

interface LintError {
  file: string;
  line: number;
  rule: string;
  message: string;
}

const errors: LintError[] = [];

/**
 * Recursively find all TypeScript files in a directory
 */
function findTsFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules and dist directories
      if (entry !== "node_modules" && entry !== "dist") {
        findTsFiles(fullPath, files);
      }
    } else if (entry.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Prevent direct OpenCodeStream instantiation
 * Handlers should use getWorkspaceStream() or getOpenCodeStream() singleton
 * This ensures test spies can capture SSE events properly
 */
function checkStreamSingleton(file: string, content: string, lines: string[]) {
  // Skip test files - they may need to test OpenCodeStream constructor
  if (file.includes(".test.ts") || file.includes("test-utils")) {
    return;
  }

  // Skip the opencode-stream.ts file itself (it needs to instantiate)
  if (file.includes("opencode-stream.ts")) {
    return;
  }

  // Skip dependencies.ts - it has a factory function that creates streams
  if (file.includes("dependencies.ts")) {
    return;
  }

  const pattern = /new\s+OpenCodeStream\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const lineNumber = content.substring(0, match.index).split("\n").length;
    const line = lines[lineNumber - 1];

    // Allow if there's a comment on the same line or line above saying it's intentional
    const prevLine = lineNumber > 1 ? lines[lineNumber - 2] : "";
    if (
      line?.includes("lint-ignore") ||
      line?.includes("intentional") ||
      prevLine?.includes("lint-ignore") ||
      prevLine?.includes("intentional")
    ) {
      continue;
    }

    errors.push({
      file,
      line: lineNumber,
      rule: "no-direct-stream-instantiation",
      message:
        "Don't create OpenCodeStream instances directly. Use getWorkspaceStream() or getOpenCodeStream() instead. " +
        "This ensures test spies can capture SSE events properly. " +
        "If this is intentional, add '// lint-ignore' comment.",
    });
  }
}

/**
 * Main linting function
 */
function lintProject() {
  const srcDir = join(process.cwd(), "src");
  const files = findTsFiles(srcDir);

  console.log(`🔍 Running custom lint rules on ${files.length} files...\n`);

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");

    checkStreamSingleton(file, content, lines);
  }

  // Report results
  if (errors.length === 0) {
    console.log("✅ No custom lint errors found!\n");
    process.exit(0);
  } else {
    console.log(`❌ Found ${errors.length} custom lint error(s):\n`);

    // Group by file
    const errorsByFile = new Map<string, LintError[]>();
    for (const error of errors) {
      if (!errorsByFile.has(error.file)) {
        errorsByFile.set(error.file, []);
      }
      errorsByFile.get(error.file)!.push(error);
    }

    // Print errors grouped by file
    for (const [file, fileErrors] of errorsByFile) {
      const relativePath = file.replace(process.cwd(), ".");
      console.log(`📁 ${relativePath}`);

      for (const error of fileErrors) {
        console.log(`  Line ${error.line}: [${error.rule}]`);
        console.log(`    ${error.message}\n`);
      }
    }

    process.exit(1);
  }
}

// Run the linter
lintProject();
