# Database Migrations

Birdhouse uses **Kysely** for migration management across two SQLite databases:

| Database | Purpose | Location |
|---|---|---|
| `data.db` | Global app config — workspaces, secrets, user profile | `~/Library/Application Support/Birdhouse/data.db` |
| `agents.db` | Per-workspace agent trees | `~/Library/Application Support/Birdhouse/workspaces/<id>/agents.db` |

---

## The golden rule

**Real databases are only ever migrated by the server starting up.**

- `data.db` migrates inside `initDataDB()`, called once at server startup.
- Each `agents.db` migrates inside `initAgentsDB()`, called the first time a workspace is accessed after startup.

Agents and developers do not manually run migrations against real databases as part of normal development workflow. The test suite is how you verify a migration works.

---

## Writing a migration

### Step 1: Generate the file

For `data.db`:
```bash
bun run data-migration:new <descriptive_name>
```

For `agents.db`:
```bash
bun run agent-migration:new <descriptive_name>
```

This creates a timestamped migration file and automatically registers the static import in the runner. The timestamp format is `YYYYMMDDHHmmss` — second precision sorts correctly across branches without manual coordination.

### Step 2: Write the SQL

Open the generated file and implement `up` and `down` using raw SQL:

```typescript
import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`ALTER TABLE workspaces ADD COLUMN description TEXT`.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  // SQLite requires table recreation to remove a column
  await sql`CREATE TABLE workspaces_new (
    workspace_id TEXT PRIMARY KEY,
    directory TEXT NOT NULL UNIQUE,
    title TEXT,
    opencode_port INTEGER,
    opencode_pid INTEGER,
    created_at TEXT NOT NULL,
    last_used TEXT NOT NULL
  )`.execute(db);
  await sql`INSERT INTO workspaces_new SELECT workspace_id, directory, title, opencode_port, opencode_pid, created_at, last_used FROM workspaces`.execute(db);
  await sql`DROP TABLE workspaces`.execute(db);
  await sql`ALTER TABLE workspaces_new RENAME TO workspaces`.execute(db);
}
```

We use **raw SQL** (not Kysely's query builder DSL) because:
- Everyone knows SQL
- SQLite's column removal limitation requires raw table recreation anyway
- Easy to review in PRs

### Step 3: Run the tests

```bash
bun test
```

The test suite exercises every migration against:
- A fresh empty database (proves `up` works correctly)
- A real-world fixture snapshot with all prior migrations already applied (proves existing customer databases survive cleanly)

If the tests pass, the migration is verified. That is the entire development workflow. **Do not run `db:migrate-dev` as part of development.** The test fixtures exist precisely so that isn't necessary.

### Step 4: Update TypeScript types (if needed)

If you added or removed columns, update the corresponding interfaces in `data-db.ts` or `agents-db.ts`.

### Step 5: Ship it

Migrations are bundled into the compiled binary via static imports — no separate files needed at runtime. They run automatically when the server starts.

---

## Naming rules

| Database | New migrations | Legacy |
|---|---|---|
| `data.db` | `YYYYMMDDHHmmss_name.ts` | Three original files use `YYYY-MM-DD_NNN_name` — frozen, cannot be renamed |
| `agents.db` | `YYYYMMDDHHmmss_name.ts` | — |

**Never rename a migration file after it has run on any database.** The filename is the key Kysely uses to track which migrations have been applied. Renaming it causes Kysely to treat it as a new unapplied migration.

---

## Human-only commands

These commands exist for investigating or recovering real databases. They are **not part of the development workflow** — use the tests instead.

```bash
# Run pending data.db migrations on your personal dev database
bun run db:migrate-dev

# Roll back the last data.db migration on your dev database
bun run db:rollback-dev

# Run pending agents.db migrations on a specific workspace (by workspace ID or path)
bun run db:migrate-agents-db <workspace-id-or-path>
```

If you find yourself reaching for these during development, stop and ask whether the test coverage is sufficient instead.

---

## Test fixtures

Each migration runner has a `__fixtures__/` directory with real database snapshots committed to the repo:

| Fixture | What it represents |
|---|---|
| `src/lib/migrations/__fixtures__/data-dev-snapshot.db` | Real `data-dev.db` with all migrations applied |
| `src/lib/agents-db-migrations/__fixtures__/demo-snapshot.db` | Demo workspace `agents.db`, 291 agents |
| `src/lib/agents-db-migrations/__fixtures__/small-snapshot.db` | Smaller workspace `agents.db`, 53 agents |

These snapshots represent real customer database states. Tests run migrations against copies of them on every CI run to confirm no data is lost.

When a fixture becomes meaningfully out of date (e.g. after a squash), update it by copying a current real database into the `__fixtures__/` directory and committing it.

---

## How the runners work

Both runners follow the same pattern:

```typescript
// Static imports — bundled into the binary, no filesystem discovery at runtime
import * as migration_20260320000000 from "./migrations/20260320000000_initial_schema";

const allMigrations: Record<string, Migration> = {
  "20260320000000_initial_schema": migration_20260320000000,
};
```

When you run `agent-migration:new` or `data-migration:new`, the script adds both the import line and the `allMigrations` entry automatically. You never need to edit the runner file by hand.
