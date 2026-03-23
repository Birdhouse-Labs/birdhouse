#!/usr/bin/env node
// ABOUTME: Birdhouse CLI entry point - lightweight launcher that ensures server is running
// ABOUTME: Opens browser to workspace setup URL and lets frontend/server handle workspace management

const { spawn } = require('child_process');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { resolve, join } = require('path');
const { platform, arch } = require('os');

// ============================================================================
// CONSTANTS
// ============================================================================

const REQUIRED_PLATFORM = 'darwin';
const SUPPORTED_ARCHS = ['arm64', 'x64'];
const DEFAULT_PORT = 50100;
const HEALTH_CHECK_TIMEOUT = 30000; // 30 seconds
const SHUTDOWN_GRACE_PERIOD = 5000; // 5 seconds

// ============================================================================
// CLI METADATA
// ============================================================================

// BIRDHOUSE_CLI_ROOT is set by the bin/birdhouse shell wrapper
const CLI_ROOT = process.env.BIRDHOUSE_CLI_ROOT || resolve(__dirname, '..');

// BIRDHOUSE_VERSION is injected at compile time via --define
const VERSION = process.env.BIRDHOUSE_VERSION || 'dev';

// Load git commit info if available
let GIT_COMMIT = null;
try {
  const versionJson = JSON.parse(readFileSync(join(CLI_ROOT, 'version.json'), 'utf-8'));
  GIT_COMMIT = versionJson.commit;
} catch (err) {
  // version.json may not exist in development
}

const VERSION_STRING = GIT_COMMIT ? `${VERSION} (${GIT_COMMIT})` : VERSION;

// ============================================================================
// BINARY PATHS (architecture-specific)
// ============================================================================

const CURRENT_ARCH = arch();
const CURRENT_PLATFORM = platform();

const PATHS = {
  server: resolve(CLI_ROOT, `dist/server-${REQUIRED_PLATFORM}-${CURRENT_ARCH}`),
  opencode: resolve(CLI_ROOT, `dist/opencode/${REQUIRED_PLATFORM}-${CURRENT_ARCH}/opencode`),
  frontend: resolve(CLI_ROOT, 'dist/frontend'),
};

// ============================================================================
// UTILITIES
// ============================================================================

function log(message) {
  console.log(message);
}

function error(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function validatePlatform() {
  if (CURRENT_PLATFORM !== REQUIRED_PLATFORM) {
    error(
      `Birdhouse CLI currently only supports macOS.\n` +
      `Your platform: ${CURRENT_PLATFORM}\n\n` +
      `Please check https://birdhouse.dev/docs for updates.`
    );
  }
  
  if (!SUPPORTED_ARCHS.includes(CURRENT_ARCH)) {
    error(
      `Birdhouse CLI supports macOS on ${SUPPORTED_ARCHS.join(' and ')}.\n` +
      `Your architecture: ${CURRENT_ARCH}\n\n` +
      `Please check https://birdhouse.dev/docs for updates.`
    );
  }
}

function getWorkspaceRoot() {
  return process.cwd();
}

async function checkServerRunning(port) {
  try {
    const response = await fetch(`http://localhost:${port}/api/health`);
    return response.ok;
  } catch (err) {
    return false;
  }
}

async function waitForServer(url, timeout) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch (err) {
      // Server not ready yet, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return false;
}

function openBrowser(url) {
  const open = spawn('open', [url], { stdio: 'ignore' });
  open.unref();
}

// ============================================================================
// UPDATE CHECK
// ============================================================================

const UPDATE_CHECK_CACHE = join(CLI_ROOT, 'update-check.json');
const UPDATE_CHECK_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const GITHUB_RELEASES_API = 'https://api.github.com/repos/birdhouse-labs/birdhouse/releases/latest';

/**
 * Compare two semver strings. Returns true if remote is strictly newer than local.
 * Handles pre-release suffixes by stripping them for numeric comparison — if the
 * numeric parts are equal, a release version (no suffix) beats a pre-release.
 */
function isNewerVersion(local, remote) {
  if (local === 'dev') return false;

  const parse = (v) => {
    const [numeric, pre] = v.replace(/^v/, '').split('-');
    const parts = numeric.split('.').map(Number);
    return { parts, pre: pre || null };
  };

  const a = parse(local);
  const b = parse(remote);

  for (let i = 0; i < Math.max(a.parts.length, b.parts.length); i++) {
    const aN = a.parts[i] ?? 0;
    const bN = b.parts[i] ?? 0;
    if (bN > aN) return true;
    if (bN < aN) return false;
  }

  // Numeric parts equal: release > pre-release
  if (a.pre && !b.pre) return true;
  return false;
}

/**
 * Fire-and-forget update check. Reads from cache if fresh, otherwise fetches
 * from GitHub. Returns { latestVersion } or null if check fails or is skipped.
 */
async function checkForUpdate() {
  try {
    // Read cache
    if (existsSync(UPDATE_CHECK_CACHE)) {
      const cache = JSON.parse(readFileSync(UPDATE_CHECK_CACHE, 'utf-8'));
      if (Date.now() - cache.checkedAt < UPDATE_CHECK_TTL_MS) {
        return { latestVersion: cache.latestVersion };
      }
    }

    // Fetch latest release from GitHub
    const res = await fetch(GITHUB_RELEASES_API, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': `birdhouse-cli/${VERSION}` },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const latestVersion = (data.tag_name || '').replace(/^v/, '');
    if (!latestVersion) return null;

    // Write cache
    writeFileSync(UPDATE_CHECK_CACHE, JSON.stringify({ latestVersion, checkedAt: Date.now() }));

    return { latestVersion };
  } catch (err) {
    // Network failures are silent — never block or warn the user
    return null;
  }
}

// ============================================================================
// PROCESS MANAGEMENT
// ============================================================================

let serverPid = null;
let shuttingDown = false;

function spawnServer(port) {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    BIRDHOUSE_BASE_PORT: port.toString(),
    BIRDHOUSE_OPENCODE_BIN: PATHS.opencode,
    FRONTEND_STATIC: PATHS.frontend,
    // Note: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are embedded in the server binary at build time
    // via Bun's compile process, so no need to pass them here
  };
  
  log(`🌐 Starting Birdhouse server on port ${port}...`);
  
  const proc = spawn(PATHS.server, [], {
    env,
    stdio: 'inherit',
  });
  
  serverPid = proc.pid;
  
  proc.on('exit', (code) => {
    if (!shuttingDown) {
      error(`Birdhouse server exited unexpectedly with code ${code}`);
    }
  });
  
  return proc;
}

async function shutdown(serverProc) {
  if (shuttingDown) return;
  shuttingDown = true;
  
  log('\n\n👋 Shutting down Birdhouse...');
  
  // Send SIGTERM to server
  if (serverPid) {
    try {
      process.kill(serverPid, 'SIGTERM');
    } catch (err) {
      // Process may have already exited
    }
  }
  
  // Wait for grace period
  await new Promise(resolve => setTimeout(resolve, SHUTDOWN_GRACE_PERIOD));
  
  // Force kill if still running
  if (serverPid) {
    try {
      process.kill(serverPid, 'SIGKILL');
    } catch (err) {
      // Already dead
    }
  }
  
  process.exit(0);
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

function showVersion() {
  log(`Birdhouse CLI v${VERSION_STRING}`);
  process.exit(0);
}

function showHelp() {
  log(`
Birdhouse CLI v${VERSION_STRING}

Usage:
  birdhouse ui [--port <port>]    Start Birdhouse UI
  birdhouse --version             Show version
  birdhouse --help                Show this help

Options:
  --port <port>    Port to run the server on (default: ${DEFAULT_PORT})

For more information, visit: https://birdhouselabs.ai
  `.trim());
  process.exit(0);
}

/**
 * Parse --port flag from args array
 * @param {string[]} args - Command arguments (after 'ui')
 * @returns {{ port: number }} Parsed options
 */
function parseUIOptions(args) {
  let port = DEFAULT_PORT;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' || args[i] === '-p') {
      const portArg = args[i + 1];
      if (!portArg) {
        error('--port requires a port number');
      }
      const parsedPort = parseInt(portArg, 10);
      if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        error(`Invalid port number: ${portArg}`);
      }
      port = parsedPort;
      i++; // Skip the port value
    } else if (args[i].startsWith('--port=')) {
      const portArg = args[i].split('=')[1];
      const parsedPort = parseInt(portArg, 10);
      if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        error(`Invalid port number: ${portArg}`);
      }
      port = parsedPort;
    } else if (args[i].startsWith('-') && args[i] !== '-p') {
      error(`Unknown option: ${args[i]}\n\nRun 'birdhouse --help' for usage information.`);
    }
  }
  
  return { port };
}

async function runUI(args = []) {
  validatePlatform();
  
  const { port } = parseUIOptions(args);

  // Start update check in background immediately — we'll read the result later
  const updateCheckPromise = checkForUpdate();
  
  const workspaceRoot = getWorkspaceRoot();
  log(`📁 Workspace: ${workspaceRoot}`);
  log('');
  
  // Check if server is already running on this port
  const serverRunning = await checkServerRunning(port);
  
  let serverProc = null;
  let shouldManageServer = false;
  
  if (!serverRunning) {
    serverProc = spawnServer(port);
    shouldManageServer = true;
    
    log(`⏳ Waiting for server to be ready...`);
    const serverReady = await waitForServer(
      `http://localhost:${port}/api/health`,
      HEALTH_CHECK_TIMEOUT
    );
    
    if (!serverReady) {
      if (serverProc) await shutdown(serverProc);
      error('Server failed to start within timeout period');
    }
    
    log('✅ Server ready!');
  } else {
    log(`✅ Server already running on port ${port}`);
  }
  
  log('');
  
  // Open browser - frontend will handle workspace registration
  const url = `http://localhost:${port}/#/setup?directory=${encodeURIComponent(workspaceRoot)}`;
  log(`🚀 Opening Birdhouse at ${url}`);
  
  if (shouldManageServer) {
    log('');
    log('Press Ctrl+C to stop');
    log('');
  }
  
  openBrowser(url);

  // Print update notice if a newer version is available
  const updateResult = await updateCheckPromise;
  if (updateResult && isNewerVersion(VERSION, updateResult.latestVersion)) {
    log('');
    log(`Update available: v${updateResult.latestVersion} (you have v${VERSION})`);
    log('  curl -fsSL https://raw.githubusercontent.com/birdhouse-labs/birdhouse/main/install.sh | bash');
  }
  
  if (shouldManageServer) {
    // Setup signal handlers
    process.on('SIGINT', () => shutdown(serverProc));
    process.on('SIGTERM', () => shutdown(serverProc));
    
    // Keep alive
    await new Promise(resolve => serverProc.on('exit', resolve));
  } else {
    // Server is persistent, CLI can exit
    log('');
    process.exit(0);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  // Default to 'ui' if no args provided
  if (args.length === 0) {
    await runUI([]);
    return;
  }
  
  const command = args[0];
  
  switch (command) {
    case 'ui':
      await runUI(args.slice(1));
      break;
    case '--version':
    case '-v':
      showVersion();
      break;
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      error(`Unknown command: ${command}\n\nRun 'birdhouse --help' for usage information.`);
  }
}

main().catch(err => {
  error(err.message);
});
