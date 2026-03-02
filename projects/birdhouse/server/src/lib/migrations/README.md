# Database Migrations

This directory contains Kysely-based database migrations for `data.db`.

Migrations run automatically when the server starts via `initDataDB()` in `index.ts`.

---

## Our Approach: Raw SQL

We use **raw SQL** (not Kysely's DSL) for migrations because:

- ✅ **SQLite limitations** - DROP COLUMN requires table recreation which needs raw SQL anyway
- ✅ **Simpler** - Everyone knows SQL, no DSL to learn
- ✅ **Clearer** - Easy to review in PRs, copy/paste from SQLite docs
- ✅ **Consistent** - Same style for both `up()` and `down()` migrations

Kysely is used **only for migration management** (tracking which migrations have run, locking, transactions), not as a query builder.

---

## Dev vs Production Databases

We have two databases:

- **Dev:** `~/Library/Application Support/Birdhouse/data-dev.db` (for testing migrations)
- **Prod:** `~/Library/Application Support/Birdhouse/data.db` (real data)

**Always test migrations on dev first!**

---

## Creating a New Migration

### Step 1: Create the migration file

Create a new file in `src/lib/migrations/migrations/` with this naming format:

```
YYYY-MM-DD_XXX_description.ts
```

Example: `2024-02-13_003_add_workspace_description.ts`

### Step 2: Write the migration

Use raw SQL for both up and down:

```typescript
import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`
    ALTER TABLE workspaces 
    ADD COLUMN description TEXT
  `.execute(db)
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  // SQLite doesn't support DROP COLUMN, so recreate table
  await sql`
    CREATE TABLE workspaces_new (
      workspace_id TEXT PRIMARY KEY,
      directory TEXT NOT NULL UNIQUE,
      title TEXT,
      -- description removed
      opencode_port INTEGER,
      opencode_pid INTEGER,
      created_at TEXT NOT NULL,
      last_used TEXT NOT NULL
    )
  `.execute(db)
  
  await sql`
    INSERT INTO workspaces_new 
    SELECT workspace_id, directory, title, opencode_port, opencode_pid, created_at, last_used 
    FROM workspaces
  `.execute(db)
  
  await sql`DROP TABLE workspaces`.execute(db)
  await sql`ALTER TABLE workspaces_new RENAME TO workspaces`.execute(db)
  
  // Recreate indexes
  await sql`CREATE INDEX idx_workspaces_directory ON workspaces(directory)`.execute(db)
  await sql`CREATE INDEX idx_workspaces_opencode_port ON workspaces(opencode_port)`.execute(db)
  await sql`CREATE INDEX idx_workspaces_last_used ON workspaces(last_used)`.execute(db)
}
```

### Step 3: Test on dev database

```bash
bun run migrate:dev
```

This runs migrations on `data-dev.db`.

### Step 4: Verify the schema

```bash
sqlite3 ~/Library/Application\ Support/Birdhouse/data-dev.db "PRAGMA table_info(workspaces);"
```

### Step 5: Test rollback

```bash
bun run migrate:rollback
```

Check that the column is gone:

```bash
sqlite3 ~/Library/Application\ Support/Birdhouse/data-dev.db "PRAGMA table_info(workspaces);"
```

### Step 6: Re-apply

```bash
bun run migrate:dev
```

### Step 7: Update TypeScript types

Update your interfaces in `data-db.ts`:

```typescript
export interface Workspace {
  workspace_id: string;
  directory: string;
  title?: string | null;
  description?: string | null; // NEW
  opencode_port: number | null;
  opencode_pid: number | null;
  created_at: string;
  last_used: string;
}
```

### Step 8: Register the migration

**IMPORTANT:** After creating a new migration file, you must register it in `run-migrations.ts` so it's bundled into the production binary.

Edit `src/lib/migrations/run-migrations.ts`:

```typescript
// Add import at the top
import * as migration_003 from "./migrations/2024-02-13_003_add_workspace_description";

// Add to getMigrations() object
async getMigrations() {
  const migrations: Record<string, Migration> = {
    "2024-02-13_000_initial_schema": migration_000,
    "2024-02-13_002_add_config_updated_at_to_workspace_secrets": migration_002,
    "2024-02-13_003_add_workspace_description": migration_003,  // ← Add this
  };
  return migrations;
}
```

Also update `scripts/rollback-last.ts` with the same import and registration.

### Step 9: Production

When you're confident, migrations will run automatically on prod when the server starts (via `initDataDB()`).

Migrations are bundled directly into the compiled binary, so no migration files need to be deployed separately.

---

## Quick Commands

```bash
# Run migrations on dev
bun run migrate:dev

# Rollback last migration on dev
bun run migrate:rollback

# View applied migrations
sqlite3 ~/Library/Application\ Support/Birdhouse/data-dev.db "SELECT * FROM kysely_migration;"

# View table schema
sqlite3 ~/Library/Application\ Support/Birdhouse/data-dev.db "PRAGMA table_info(table_name);"
```

---

## Tips

1. **Always test on dev first** - Never run untested migrations on prod
2. **Commit migrations with your code** - Migrations are part of your codebase
3. **Never edit applied migrations** - Once a migration runs on prod, it's permanent
4. **Test rollback** - Make sure your `down()` works before deploying
5. **SQLite quirks** - Remember DROP COLUMN requires table recreation

---

## When Things Go Wrong

### Migration failed mid-way

Check the error, fix the migration file, then rollback:

```bash
bun run migrate:rollback
```

Fix the file, then re-apply:

```bash
bun run migrate:dev
```

### Accidentally ran on prod

If you need to rollback prod:

```bash
cd server
bun scripts/rollback-last.ts ~/Library/Application\ Support/Birdhouse/data.db
```

**⚠️ Be careful!** This will lose data if the down migration doesn't preserve it.

### Migration is stuck

Check what migrations are applied:

```bash
sqlite3 ~/Library/Application\ Support/Birdhouse/data-dev.db "SELECT * FROM kysely_migration;"
```

You can manually delete a migration record (dangerous!):

```bash
sqlite3 ~/Library/Application\ Support/Birdhouse/data-dev.db "DELETE FROM kysely_migration WHERE name = 'migration_name';"
```

---

## Production Deployment

Migrations run automatically when the server starts (in `index.ts` via `await initDataDB()`).

The server will:
1. Check `kysely_migration` table
2. Run any unapplied migrations in order
3. Only start if migrations succeed

If a migration fails, the server won't start.
