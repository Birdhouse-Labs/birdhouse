// ABOUTME: Script to generate a new agents.db migration file with a timestamp-based name
// ABOUTME: Also inserts the static import into run-agents-db-migrations.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const name = process.argv[2];

if (!name) {
  console.error("Usage: bun run migration:new <descriptive_name>");
  console.error("Example: bun run migration:new add_composer_drafts");
  process.exit(1);
}

// YYYYMMDDHHmmss — second precision, filesystem-safe, lexicographically sortable
const now = new Date();
const pad = (n: number, len = 2) => String(n).padStart(len, "0");
const timestamp = [
  now.getFullYear(),
  pad(now.getMonth() + 1),
  pad(now.getDate()),
  pad(now.getHours()),
  pad(now.getMinutes()),
  pad(now.getSeconds()),
].join("");

const filename = `${timestamp}_${name}.ts`;
const migrationKey = `${timestamp}_${name}`;
const importName = `migration_${timestamp}`;

const migrationsDir = join(import.meta.dir, "../src/lib/agents-db-migrations/migrations");
const runnerPath = join(import.meta.dir, "../src/lib/agents-db-migrations/run-agents-db-migrations.ts");

// Write the migration stub
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

writeFileSync(join(migrationsDir, filename), stub);
console.log(`Created: src/lib/agents-db-migrations/migrations/${filename}`);

// Insert the import and registration into run-agents-db-migrations.ts
let runner = readFileSync(runnerPath, "utf-8");

// Find the last existing import line and insert after it
const lastImportMatch = runner.match(/(^import \* as migration_\d+ from.*$)/m);
if (!lastImportMatch) {
  console.error("Could not find existing migration imports in run-agents-db-migrations.ts");
  process.exit(1);
}

// Find the last migration import line (there may be several)
const importLines = [...runner.matchAll(/^import \* as migration_\d+ from.*$/gm)];
const lastImportLine = importLines[importLines.length - 1];

const newImportLine = `import * as ${importName} from "./migrations/${timestamp}_${name}";`;
runner = runner.slice(0, lastImportLine.index! + lastImportLine[0].length) +
  "\n" + newImportLine +
  runner.slice(lastImportLine.index! + lastImportLine[0].length);

// Insert into allMigrations object — find the last entry and add after it
const lastEntryMatch = [...runner.matchAll(/^    "(\d{14}_[^"]+)": migration_\d+,/gm)];
if (lastEntryMatch.length === 0) {
  console.error("Could not find existing entries in allMigrations in run-agents-db-migrations.ts");
  process.exit(1);
}
const lastEntry = lastEntryMatch[lastEntryMatch.length - 1];
const newEntry = `    "${migrationKey}": ${importName},`;
runner = runner.slice(0, lastEntry.index! + lastEntry[0].length) +
  "\n" + newEntry +
  runner.slice(lastEntry.index! + lastEntry[0].length);

writeFileSync(runnerPath, runner);
console.log(`Updated: src/lib/agents-db-migrations/run-agents-db-migrations.ts`);
console.log(`\nMigration key: "${migrationKey}"`);
