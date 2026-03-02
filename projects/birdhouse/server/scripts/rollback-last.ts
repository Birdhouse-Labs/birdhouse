#!/usr/bin/env bun
// Rollback the last migration on a specified database

import type { Migration } from 'kysely'
import { Kysely, Migrator } from 'kysely'
import { BunSqliteDialect } from 'kysely-bun-sqlite'
import Database from 'bun:sqlite'

// Import migrations directly (same as run-migrations.ts)
import * as migration_000 from '../src/lib/migrations/migrations/2024-02-13_000_initial_schema'
import * as migration_002 from '../src/lib/migrations/migrations/2024-02-13_002_add_config_updated_at_to_workspace_secrets'

const dbPath = process.argv[2]

if (!dbPath) {
  console.error('Usage: bun scripts/rollback-last.ts <db-path>')
  process.exit(1)
}

console.log(`Rolling back last migration on: ${dbPath}`)

const db = new Kysely<Record<string, never>>({
  dialect: new BunSqliteDialect({
    database: new Database(dbPath)
  })
})

const migrator = new Migrator({
  db,
  provider: {
    async getMigrations() {
      const migrations: Record<string, Migration> = {
        '2024-02-13_000_initial_schema': migration_000,
        '2024-02-13_002_add_config_updated_at_to_workspace_secrets': migration_002,
      }
      return migrations
    },
  },
})

const { error, results } = await migrator.migrateDown()

results?.forEach((it) => {
  if (it.status === 'Success') {
    console.log(`✅ Rolled back: ${it.migrationName}`)
  } else if (it.status === 'Error') {
    console.error(`❌ Rollback failed: ${it.migrationName}`)
  } else if (it.status === 'NotExecuted') {
    console.log(`⏭️  No migrations to rollback`)
  }
})

if (error) {
  console.error('Rollback failed:', error)
  await db.destroy()
  process.exit(1)
}

await db.destroy()
console.log('✨ Done')
