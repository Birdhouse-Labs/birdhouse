#!/usr/bin/env bun
// ABOUTME: Production serve script that builds and serves optimized frontend + server
// ABOUTME: Builds frontend once, then starts server and serves frontend production build

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

console.log('🏗️  Building Birdhouse for production...');
console.log('');

// Build frontend first (with env vars so they're baked into the bundle)
console.log('📦 Building frontend...');
const buildProc = Bun.spawn(['bun', 'run', 'build'], {
  cwd: './frontend',
  env: {
    ...process.env,
    VITE_SERVER_PORT: SERVER_PORT,
  },
  stdout: 'inherit',
  stderr: 'inherit',
});

await buildProc.exited;

if (buildProc.exitCode !== 0) {
  console.error('❌ Frontend build failed');
  process.exit(1);
}

console.log('✅ Frontend build complete');
console.log('');
console.log('🚀 Starting Birdhouse in production mode...');
console.log(`   Server:    http://localhost:${SERVER_PORT}`);
console.log(`   Frontend:  http://localhost:${FRONTEND_PORT}`);
console.log(`   OpenCode:  Spawned per-workspace (ports ${OPENCODE_BASE_PORT}+)`);
console.log('');

// Start server in production mode (will spawn OpenCode per workspace)
const serverProc = Bun.spawn(['bun', 'run', 'start'], {
  cwd: './server',
  env: {
    ...process.env,
    BIRDHOUSE_BASE_PORT: SERVER_PORT,
  },
  stdout: 'inherit',
  stderr: 'inherit',
});

// Start frontend preview server (serves production build)
const frontendProc = Bun.spawn(['bun', 'run', 'serve'], {
  cwd: './frontend',
  env: {
    ...process.env,
    PORT: FRONTEND_PORT,
    VITE_SERVER_PORT: SERVER_PORT,
  },
  stdout: 'inherit',
  stderr: 'inherit',
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  serverProc.kill();
  frontendProc.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  serverProc.kill();
  frontendProc.kill();
  process.exit(0);
});

// Wait for all processes
await Promise.race([serverProc.exited, frontendProc.exited]);
