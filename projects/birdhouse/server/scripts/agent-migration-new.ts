// ABOUTME: Generates a new agents.db migration file with a timestamp-based name
// ABOUTME: Also inserts the static import into run-agents-db-migrations.ts

import { join } from "node:path";
import { generateMigration } from "./migration-new-shared";

const name = process.argv[2];

if (!name) {
  console.error("Usage: bun run agent-migration:new <descriptive_name>");
  console.error("Example: bun run agent-migration:new add_composer_drafts");
  process.exit(1);
}

generateMigration(name, {
  label: "agents.db",
  migrationsDir: join(import.meta.dir, "../src/lib/agents-db-migrations/migrations"),
  runnerPath: join(import.meta.dir, "../src/lib/agents-db-migrations/run-agents-db-migrations.ts"),
  runnerImportPrefix: "./migrations/",
  displayPrefix: "src/lib/agents-db-migrations/migrations/",
  runnerDisplayName: "src/lib/agents-db-migrations/run-agents-db-migrations.ts",
});
