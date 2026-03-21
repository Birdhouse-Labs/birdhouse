---
name: db-migrations
description: Complete guide to Birdhouse database migrations for agents. Covers both data.db and agents.db — generating migrations, verifying via tests, and applying to specific databases when explicitly asked. Load this skill whenever working on database migrations.
trigger_phrases:
  - database migration
  - db migration
  - agents.db migration
  - data.db migration
  - add a migration
  - write a migration
---

# Birdhouse Database Migrations

Birdhouse has two SQLite databases, each with its own Kysely migration system:

| Database | Purpose | Runner |
|---|---|---|
| `data.db` | Global config — workspaces, secrets, user profile | `src/lib/migrations/run-migrations.ts` |
| `agents.db` | Per-workspace agent trees (one per workspace) | `src/lib/agents-db-migrations/run-agents-db-migrations.ts` |

---

## The rule: never touch real databases during development

Your job as an agent is to write and verify migrations. Verification happens entirely through the test suite. You do not apply migrations to real databases as part of your development workflow.

Real databases are only ever migrated in two ways:
1. **The server starts** — `initDataDB()` and `initAgentsDB()` run automatically
2. **A human explicitly asks you to apply to a specific database** — use the patterns below

If you find yourself about to run a `db:` script without being explicitly asked, stop.

---

## Writing a migration

### Step 1: Generate the file

```bash
# For agents.db
bun run agent-migration:new <descriptive_name>

# For data.db
bun run data-migration:new <descriptive_name>
```

This creates `YYYYMMDDHHmmss_<name>.ts` and automatically adds the static import to the runner. You never edit the runner by hand.

### Step 2: Implement up and down

Use raw SQL — not Kysely's query builder:

```typescript
import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`ALTER TABLE agents ADD COLUMN notes TEXT`.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  // SQLite cannot drop columns before 3.35 — recreate the table
  await sql`CREATE TABLE agents_new AS SELECT id, session_id, ... FROM agents`.execute(db);
  await sql`DROP TABLE agents`.execute(db);
  await sql`ALTER TABLE agents_new RENAME TO agents`.execute(db);
}
```

### Step 3: Run the tests — this is your verification

```bash
cd projects/birdhouse/server
bun test
```

The test suite runs every migration against:
- A fresh empty database (proves `up` works)
- Real-world fixture snapshots (proves existing customer databases survive)

Passing tests = migration is verified. You are done.

### Step 4: Update TypeScript types if needed

If you added or removed columns, update interfaces in `agents-db.ts` or `data-db.ts`.

---

## Naming

- New migrations: `YYYYMMDDHHmmss_descriptive_name.ts` (second precision, sorts correctly across branches)
- Legacy `data.db` files use `YYYY-MM-DD_NNN_name` — frozen, never rename them
- **Never rename any migration file after it has run on any database** — the filename is Kysely's tracking key

---

## Applying a migration to a specific database (when explicitly asked)

When a human asks you to apply a migration to a specific database, use the appropriate script from the server directory. Always confirm the path with the human before running.

```bash
cd projects/birdhouse/server

# Apply all pending data.db migrations
bun run db:migrate-data <path-to-data.db>

# Apply all pending agents.db migrations (workspace ID or path)
bun run db:migrate-agents-db <workspace-id-or-path>

# Examples:
bun run db:migrate-data ~/Library/Application\ Support/Birdhouse/data-spotcheck.db
bun run db:migrate-agents-db ws_a8d1e136456699b4
bun run db:migrate-agents-db ~/Library/Application\ Support/Birdhouse/workspaces/ws_xxx/agents.db
```

---

## Rolling back a migration (when explicitly asked)

Rolling back is a human decision. If asked to roll back a specific database, use:

```bash
# Roll back one step on data.db
bun run db:migrate-down-data <path-to-data.db>

# Roll back one step on agents.db (workspace ID or path)
bun run db:migrate-down-agents-db <workspace-id-or-path>
```

Each rollback script prints the currently applied migrations before acting so the human can confirm.

**Important constraints:**
- The migration being rolled back must still exist in `allMigrations` in the runner — rollback must run from the same worktree where the migration was applied
- Rollback undoes one migration at a time. To undo multiple, run the command multiple times.
- You should not decide which database to roll back or when — that is the human's call

---

## How the runners work (for reference)

Both runners use static imports so they bundle correctly into the compiled binary:

```typescript
// In run-agents-db-migrations.ts
import * as migration_20260320000000 from "./migrations/20260320000000_initial_schema";

const allMigrations: Record<string, Migration> = {
  "20260320000000_initial_schema": migration_20260320000000,
};
```

The generator script (`agent-migration:new` / `data-migration:new`) adds both lines automatically.

---

## Test fixtures

Real database snapshots are committed in `__fixtures__/` and run through migrations on every CI run:

| Fixture | What it represents |
|---|---|
| `src/lib/migrations/__fixtures__/data-dev-snapshot.db` | Real `data-dev.db`, all migrations applied |
| `src/lib/agents-db-migrations/__fixtures__/demo-snapshot.db` | Demo workspace, 291 agents |
| `src/lib/agents-db-migrations/__fixtures__/small-snapshot.db` | Smaller workspace, 53 agents |

If a fixture becomes significantly out of date, update it by copying a current real database into `__fixtures__/` and committing it.
