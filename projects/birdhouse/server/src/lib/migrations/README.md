# data.db Migrations

Kysely-based migrations for `data.db`. Run automatically on server startup via `initDataDB()`.

---

## Approach: Raw SQL

We use **raw SQL** inside Kysely migration files — not Kysely's query builder DSL. Reasons:

- Everyone knows SQL, no DSL to learn
- SQLite's DROP COLUMN limitation requires raw `CREATE TABLE … AS SELECT` anyway
- Easy to review in PRs

Kysely is used only for migration management (tracking, locking, transactions).

---

## Creating a New Migration

### Step 1: Generate the file

```bash
bun run data-migration:new <descriptive_name>
```

Example:

```bash
bun run data-migration:new add_workspace_description
```

This creates `src/lib/migrations/migrations/YYYYMMDDHHmmss_add_workspace_description.ts`
and automatically registers the static import in `run-migrations.ts`.

### Step 2: Write the migration

Open the generated file and implement `up` and `down`:

```typescript
export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  await sql`ALTER TABLE workspaces ADD COLUMN description TEXT`.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  // SQLite can't DROP COLUMN before 3.35 — recreate the table
  await sql`CREATE TABLE workspaces_new ( ... )`.execute(db);
  await sql`INSERT INTO workspaces_new SELECT ... FROM workspaces`.execute(db);
  await sql`DROP TABLE workspaces`.execute(db);
  await sql`ALTER TABLE workspaces_new RENAME TO workspaces`.execute(db);
}
```

### Step 3: Test on dev database

```bash
bun run migrate:dev
```

Runs migrations against `data-dev.db` only. Never touches prod.

### Step 4: Verify

```bash
sqlite3 ~/Library/Application\ Support/Birdhouse/data-dev.db "PRAGMA table_info(workspaces);"
```

### Step 5: Test rollback

```bash
bun run migrate:rollback
```

### Step 6: Update TypeScript types

Update interfaces in `data-db.ts` to match the new schema.

### Step 7: Ship it

Migrations run automatically on prod when the server starts. They're bundled into the compiled binary via static imports — no separate files needed.

---

## Migration Naming

Files use `YYYYMMDDHHmmss_descriptive_name.ts` — second-precision timestamps sort lexicographically, so ordering is correct even across branches. The three original migrations use an older `YYYY-MM-DD_NNN_name` format; those names are frozen in production databases and cannot change.

---

## Quick Commands

```bash
# Generate a new migration
bun run data-migration:new <name>

# Run pending migrations on dev
bun run migrate:dev

# Rollback last migration on dev
bun run migrate:rollback

# Check which migrations have been applied
sqlite3 ~/Library/Application\ Support/Birdhouse/data-dev.db "SELECT * FROM kysely_migration;"
```

---

## Safety

- **Always test on dev first** — `migrate:dev` targets `data-dev.db` only
- **Never edit an applied migration** — once it's run on any database, it's permanent
- **Never rename migration files** — the filename is the key Kysely uses to track state
- Tests in `run-migrations.test.ts` run a real-world fixture through migrations on every CI run
