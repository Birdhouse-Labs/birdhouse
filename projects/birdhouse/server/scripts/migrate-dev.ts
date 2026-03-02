#!/usr/bin/env bun
// Run migrations on the dev database

import { runMigrations } from '../src/lib/migrations/run-migrations'
import { homedir } from 'os'
import { join } from 'path'

const DEV_DB = join(homedir(), 'Library/Application Support/Birdhouse/data-dev.db')

console.log('🔧 Running migrations on DEV database...')
console.log(`   ${DEV_DB}\n`)

await runMigrations(DEV_DB)

console.log('\n✨ Dev database is up to date!')
