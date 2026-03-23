#!/usr/bin/env bun
// ABOUTME: Development launcher script that starts both frontend and server
// ABOUTME: Automatically loads .env file and supports custom port configuration

// Make this a module to support top-level await
export {};

import { Database } from 'bun:sqlite';
import { homedir } from 'node:os';
import { join } from 'node:path';

if (!process.env.BIRDHOUSE_BASE_PORT) {
  console.error('❌ Missing BIRDHOUSE_BASE_PORT in .env file');
  process.exit(1);
}

const BASE_PORT = Number.parseInt(process.env.BIRDHOUSE_BASE_PORT, 10);
const FRONTEND_PORT = BASE_PORT.toString();
const SERVER_PORT = (BASE_PORT + 1).toString();
const OPENCODE_BASE_PORT = BASE_PORT + 11;

console.log('🚀 Starting Birdhouse...');
console.log(`   Server:    http://localhost:${SERVER_PORT}`);
console.log(`   Frontend:  http://localhost:${FRONTEND_PORT}`);
console.log(`   OpenCode:  Spawned per-workspace (ports ${OPENCODE_BASE_PORT}+)`);
console.log('');

// Start server (will spawn OpenCode per workspace)
const serverProc = Bun.spawn(['bun', 'run', 'dev'], {
  cwd: './server',
  env: { 
    ...process.env, 
    BIRDHOUSE_BASE_PORT: SERVER_PORT,
  },
  stdout: 'inherit',
  stderr: 'inherit',
});

// Start frontend
const frontendProc = Bun.spawn(['bun', 'run', 'dev'], {
  cwd: './frontend',
  env: {
    ...process.env,
    PORT: FRONTEND_PORT,
    // Pass server port to frontend for auto-detection
    VITE_SERVER_PORT: SERVER_PORT,
  },
  stdout: 'inherit',
  stderr: 'inherit',
});

// Handle shutdown gracefully
// shuttingDown: set on first SIGINT to suppress child exit error messages
// shutdownStarted: set when shutdown() begins to prevent double-execution
let shuttingDown = false;
let shutdownStarted = false;

const shutdown = async (killOpenCode: boolean) => {
  if (shutdownStarted) return;
  shutdownStarted = true;
  shuttingDown = true;

  if (killOpenCode) {
    // Tell server to kill OpenCode instances before exiting
    serverProc.kill('SIGQUIT');
    // Give it time to kill OpenCode gracefully before we force-exit
    await Promise.race([serverProc.exited, new Promise(r => setTimeout(r, 6000))]);
  } else {
    serverProc.kill('SIGTERM');
  }

  frontendProc.kill('SIGTERM');

  const timeout = setTimeout(() => {
    serverProc.kill('SIGKILL');
    frontendProc.kill('SIGKILL');
    process.exit(1);
  }, 5000);

  await Promise.all([serverProc.exited, frontendProc.exited]);
  clearTimeout(timeout);

  console.log('✅ Shutdown complete');
  process.exit(0);
};

// SIGINT (Ctrl+C): print running OpenCode instances then exit cleanly, leaving them alive.
// Use Ctrl+\ (SIGQUIT) to also kill OpenCode instances.
process.on('SIGINT', async () => {
  if (shuttingDown) return;
  shuttingDown = true;

  // Read running OpenCode instances directly from the DB — don't depend on the server
  // being alive (it receives the same SIGINT from the process group and may already be gone).
  type WorkspaceRow = { title: string | null; opencode_pid: number | null; opencode_port: number | null };
  let running: Array<{ title: string; pid: number; port: number }> = [];
  try {
    const dataDir = process.platform === 'darwin'
      ? join(homedir(), 'Library/Application Support/Birdhouse')
      : join(homedir(), '.local/share/birdhouse');
    const dbPath = process.env.BIRDHOUSE_DATA_DB_PATH || join(dataDir, 'data.db');
    const db = new Database(dbPath, { readonly: true });
    const rows = db.query<WorkspaceRow, []>(
      'SELECT title, opencode_pid, opencode_port FROM workspaces WHERE opencode_pid IS NOT NULL AND opencode_port IS NOT NULL'
    ).all();
    db.close();
    running = rows.map(r => ({ title: r.title || r.opencode_pid!.toString(), pid: r.opencode_pid!, port: r.opencode_port! }));
  } catch {
    // DB not readable — nothing to list
  }

  process.stdout.write('\n');
  if (running.length > 0) {
    process.stdout.write('OpenCode instances left running:\n');
    for (const w of running) {
      process.stdout.write(`  ${w.title}  pid=${w.pid}  port=${w.port}\n`);
    }
    process.stdout.write('(Use Ctrl+\\ to kill them too)\n');
  }

  shutdown(false);
});

process.on('SIGTERM', () => shutdown(false));

// SIGQUIT: hard teardown including OpenCode (for scripts/agents)
process.on('SIGQUIT', () => shutdown(true));

// Watch for unexpected child exits (e.g. port conflicts at startup).
// Once shuttingDown is set, we ignore exits — they're expected.
serverProc.exited.then(() => {
  if (!shuttingDown && serverProc.exitCode !== 0) {
    console.error('\n❌ Server failed to start (possibly port in use)');
    console.error(`   To free port ${SERVER_PORT}: kill -9 $(lsof -t -i:${SERVER_PORT})`);
    process.exit(1);
  }
});

frontendProc.exited.then(() => {
  if (!shuttingDown && frontendProc.exitCode !== 0) {
    console.error('\n❌ Frontend failed to start (possibly port in use)');
    console.error(`   To free port ${FRONTEND_PORT}: kill -9 $(lsof -t -i:${FRONTEND_PORT})`);
    process.exit(1);
  }
});

// Keep the event loop alive — all exit paths go through shutdown()
await new Promise(() => {});
