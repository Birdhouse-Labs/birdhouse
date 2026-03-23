#!/usr/bin/env bun
// ABOUTME: Development launcher script that starts both frontend and server
// ABOUTME: Automatically loads .env file and supports custom port configuration

// Make this a module to support top-level await
export {};

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
let shuttingDown = false;

const shutdown = async (killOpenCode: boolean) => {
  if (shuttingDown) return;
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

// SIGINT (Ctrl+C): on first press, list running OpenCode instances and offer to kill them.
// Second press within 3s kills them; waiting out the timer exits cleanly leaving them alive.
let sigintCount = 0;
let sigintTimer: ReturnType<typeof setTimeout> | null = null;

process.on('SIGINT', async () => {
  sigintCount++;

  if (sigintCount === 1) {
    // Query server for running OpenCode instances
    let running: Array<{ title: string; pid: number; port: number }> = [];
    try {
      const res = await fetch(`http://localhost:${SERVER_PORT}/api/workspaces/health`);
      if (res.ok) {
        const data = await res.json() as Array<{ title: string; pid: number; port: number; opencodeRunning: boolean }>;
        running = data.filter(w => w.opencodeRunning);
      }
    } catch {
      // Server already down — nothing to list
    }

    process.stdout.write('\n');
    if (running.length > 0) {
      process.stdout.write('OpenCode instances still running:\n');
      for (const w of running) {
        process.stdout.write(`  ${w.title || w.pid}  pid=${w.pid}  port=${w.port}\n`);
      }
      process.stdout.write('\nPress Ctrl+C again within 3s to kill them, or Ctrl+\\ to always kill.\n');

      sigintTimer = setTimeout(() => {
        sigintTimer = null;
        shutdown(false);
      }, 3000);
    } else {
      shutdown(false);
    }
  } else {
    // Second press — kill OpenCode too
    if (sigintTimer) clearTimeout(sigintTimer);
    process.stdout.write('Killing OpenCode instances...\n');
    shutdown(true);
  }
});

process.on('SIGTERM', () => shutdown(false));

// SIGQUIT: hard teardown including OpenCode (for scripts/agents)
process.on('SIGQUIT', () => shutdown(true));

// Wait for all processes and handle port conflicts
const exitResult = await Promise.race([serverProc.exited, frontendProc.exited]);

// Check if any process failed due to port conflict
if (serverProc.exitCode !== null && serverProc.exitCode !== 0) {
  console.error('\n❌ Server failed to start (possibly port in use)');
  console.error(`   To free port ${SERVER_PORT}: kill -9 $(lsof -t -i:${SERVER_PORT})`);
  process.exit(1);
}

if (frontendProc.exitCode !== null && frontendProc.exitCode !== 0) {
  console.error('\n❌ Frontend failed to start (possibly port in use)');
  console.error(`   To free port ${FRONTEND_PORT}: kill -9 $(lsof -t -i:${FRONTEND_PORT})`);
  process.exit(1);
}
