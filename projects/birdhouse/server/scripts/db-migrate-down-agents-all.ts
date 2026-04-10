// ABOUTME: Dry-runs or rolls back one specific agents.db migration across every discovered workspace database.
// ABOUTME: Uses data.db as the source of truth and only rolls back when the target migration is the latest applied.

import {
  bulkRollbackAgentsDbMigration,
  getDefaultBirdhouseRoot,
} from "./db-migrate-down-agents-all-lib";

interface ParsedArgs {
  targetMigration: string;
  execute: boolean;
  birdhouseRoot?: string;
}

function usage(): void {
  console.error("Usage: bun run db:migrate-down-agents-all <migration-name> [--execute] [--birdhouse-root <path>]");
  console.error("");
  console.error("Dry-run is the default.");
  console.error("Discovers agents.db files from <birdhouse-root>/workspaces/*/agents.db.");
  console.error("Only workspaces where the target migration is the latest applied migration are eligible.");
}

function parseArgs(argv: string[]): ParsedArgs {
  const [targetMigration, ...rest] = argv;
  if (!targetMigration) {
    usage();
    process.exit(1);
  }

  let execute = false;
  let birdhouseRoot: string | undefined;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--execute") {
      execute = true;
      continue;
    }
    if (arg === "--birdhouse-root") {
      birdhouseRoot = rest[index + 1];
      index += 1;
      continue;
    }

    console.error(`Unknown argument: ${arg}`);
    usage();
    process.exit(1);
  }

  return { targetMigration, execute, birdhouseRoot };
}

function printSummary(results: Awaited<ReturnType<typeof bulkRollbackAgentsDbMigration>>): void {
  for (const result of results) {
    const label = result.title ? `${result.workspaceId} (${result.title})` : result.workspaceId;
    const latest = result.latestAppliedMigration ? ` latest=${result.latestAppliedMigration}` : "";
    const error = result.error ? ` error=${result.error}` : "";
    console.log(`${result.status.padEnd(11)} ${label}\n  ${result.agentsDbPath}${latest}${error}`);
  }

  const counts = results.reduce<Record<string, number>>((acc, result) => {
    acc[result.status] = (acc[result.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\nSummary:");
  for (const status of ["rolled_back", "dry_run", "missing_db", "not_applied", "not_latest", "failed"] as const) {
    console.log(`  ${status}: ${counts[status] ?? 0}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const birdhouseRoot = args.birdhouseRoot ?? getDefaultBirdhouseRoot();

console.log(args.execute ? "Executing bulk rollback..." : "Dry run only. No databases will be modified.");
console.log(`  target migration: ${args.targetMigration}`);
console.log(`  Birdhouse root: ${birdhouseRoot}\n`);

const results = await bulkRollbackAgentsDbMigration({
  targetMigration: args.targetMigration,
  execute: args.execute,
  birdhouseRoot,
});

printSummary(results);

if (!args.execute) {
  console.log("\nRe-run with --execute to perform the rollback.");
}

if (results.some((result) => result.status === "failed")) {
  process.exit(1);
}
