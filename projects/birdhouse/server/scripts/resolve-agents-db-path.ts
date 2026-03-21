// ABOUTME: Shared helper to resolve a workspace ID or path to an agents.db file path
// ABOUTME: Used by db:migrate-agents-db and db:migrate-down-agents-db scripts

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function resolveAgentsDbPath(arg: string): string {
  const dbPath = arg.startsWith("ws_")
    ? join(homedir(), "Library/Application Support/Birdhouse/workspaces", arg, "agents.db")
    : arg.replace(/^~/, homedir());

  if (!existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    process.exit(1);
  }

  return dbPath;
}
