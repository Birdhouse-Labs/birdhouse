// ABOUTME: Generates a new data.db migration file with a timestamp-based name
// ABOUTME: Also inserts the static import into run-migrations.ts

import { join } from "node:path";
import { generateMigration } from "./migration-new-shared";

const name = process.argv[2];

if (!name) {
  console.error("Usage: bun run data-migration:new <descriptive_name>");
  console.error("Example: bun run data-migration:new add_workspace_description");
  process.exit(1);
}

generateMigration(name, {
  label: "data.db",
  migrationsDir: join(import.meta.dir, "../src/lib/migrations/migrations"),
  runnerPath: join(import.meta.dir, "../src/lib/migrations/run-migrations.ts"),
  runnerImportPrefix: "./migrations/",
  displayPrefix: "src/lib/migrations/migrations/",
  runnerDisplayName: "src/lib/migrations/run-migrations.ts",
});
