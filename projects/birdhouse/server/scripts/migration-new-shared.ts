// ABOUTME: Shared logic for generating new migration files with timestamp names
// ABOUTME: Used by agent-migration-new.ts and data-migration-new.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface MigrationTarget {
  /** Human-readable label for messages */
  label: string;
  /** Absolute path to the migrations/ subdirectory */
  migrationsDir: string;
  /** Absolute path to the runner file that registers static imports */
  runnerPath: string;
  /** Relative import path prefix used inside the runner (e.g. "./migrations/") */
  runnerImportPrefix: string;
  /** Relative path shown in success messages (e.g. "src/lib/agents-db-migrations/migrations/") */
  displayPrefix: string;
  /** Runner file display name for messages */
  runnerDisplayName: string;
}

// YYYYMMDDHHmmss — second precision, filesystem-safe, lexicographically sortable
function makeTimestamp(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

export function generateMigration(name: string, target: MigrationTarget): void {
  const timestamp = makeTimestamp();
  const filename = `${timestamp}_${name}.ts`;
  const migrationKey = `${timestamp}_${name}`;
  const importName = `migration_${timestamp}`;

  // Write stub migration file
  const stub = `// ABOUTME: Migration: ${name.replace(/_/g, " ")}
// ABOUTME: Describe what this migration does

import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  // TODO: implement migration
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  // TODO: implement rollback
}
`;

  writeFileSync(join(target.migrationsDir, filename), stub);
  console.log(`Created: ${target.displayPrefix}${filename}`);

  // Insert import and allMigrations entry into runner
  let runner = readFileSync(target.runnerPath, "utf-8");

  // Find the last migration import line
  const importLines = [...runner.matchAll(/^import \* as migration_\S+ from.*$/gm)];
  if (importLines.length === 0) {
    console.error(`Could not find migration imports in ${target.runnerDisplayName}`);
    process.exit(1);
  }
  const lastImportLine = importLines[importLines.length - 1];
  const newImportLine = `import * as ${importName} from "${target.runnerImportPrefix}${timestamp}_${name}";`;
  runner =
    runner.slice(0, lastImportLine.index! + lastImportLine[0].length) +
    "\n" +
    newImportLine +
    runner.slice(lastImportLine.index! + lastImportLine[0].length);

  // Find the last allMigrations entry (handles both old YYYY-MM-DD_NNN_ and new YYYYMMDDHHmmss_ keys)
  // Allows 2 or 4 spaces of indentation
  const lastEntryMatch = [...runner.matchAll(/^ {2,4}"[^"]+": migration_\S+,$/gm)];
  if (lastEntryMatch.length === 0) {
    console.error(`Could not find allMigrations entries in ${target.runnerDisplayName}`);
    process.exit(1);
  }
  const lastEntry = lastEntryMatch[lastEntryMatch.length - 1];
  const newEntry = `  "${migrationKey}": ${importName},`;
  runner =
    runner.slice(0, lastEntry.index! + lastEntry[0].length) +
    "\n" +
    newEntry +
    runner.slice(lastEntry.index! + lastEntry[0].length);

  writeFileSync(target.runnerPath, runner);
  console.log(`Updated: ${target.runnerDisplayName}`);
  console.log(`\nMigration key: "${migrationKey}"`);
}
