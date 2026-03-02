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

const handleShutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  
  console.log(`\n\n👋 Shutting down (${signal})...`);
  
  // Send SIGTERM to children for graceful shutdown
  serverProc.kill('SIGTERM');
  frontendProc.kill('SIGTERM');
  
  // Wait for children to exit (with timeout)
  const timeout = setTimeout(() => {
    console.log('⚠️  Children did not exit gracefully, forcing shutdown...');
    serverProc.kill('SIGKILL');
    frontendProc.kill('SIGKILL');
    process.exit(1);
  }, 5000);
  
  await Promise.all([serverProc.exited, frontendProc.exited]);
  clearTimeout(timeout);
  
  console.log('✅ Shutdown complete');
  process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

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
