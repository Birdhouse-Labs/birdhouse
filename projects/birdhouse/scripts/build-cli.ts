#!/usr/bin/env bun
// ABOUTME: CLI distribution build script that compiles all components into cli-dist/
// ABOUTME: Builds frontend, server binary, OpenCode binary, and plugin for macOS distribution

import { rmSync, mkdirSync, cpSync, existsSync, chmodSync, writeFileSync } from 'fs';
import { join } from 'path';

// Make this a module to support top-level await
export {};

const PROJECT_ROOT = join(import.meta.dir, '..');
const CLI_DIST = join(PROJECT_ROOT, 'cli-dist');
const FRONTEND_DIR = join(PROJECT_ROOT, 'frontend');
const SERVER_DIR = join(PROJECT_ROOT, 'server');
const PLUGIN_DIR = join(PROJECT_ROOT, '..', 'birdhouse-oc-plugin');
const TEMPLATES_DIR = join(PROJECT_ROOT, 'scripts', 'templates');

// OPENCODE_PATH environment variable is REQUIRED
// Must point to OpenCode repository root (e.g., /path/to/opencode)
// NOT packages/opencode subdirectory
if (!process.env.OPENCODE_PATH) {
  console.error('❌ OPENCODE_PATH environment variable is required');
  console.error('   Set it to your OpenCode repository root:');
  console.error('   export OPENCODE_PATH=/path/to/opencode');
  console.error('');
   console.error('   Example: export OPENCODE_PATH=/path/to/opencode');
  process.exit(1);
}

const OPENCODE_PATH = process.env.OPENCODE_PATH;
const OPENCODE_PKG = join(OPENCODE_PATH, 'packages', 'opencode');

console.log('🏗️  Building Birdhouse CLI distribution...');
console.log('');

// ============================================================================
// Step 0: Capture Git Commit Info
// ============================================================================
console.log('🔍 Capturing git commit info...');

async function getGitCommit(): Promise<string> {
  // Locally: get hash and check for uncommitted changes
  const hashProc = Bun.spawn(['git', 'rev-parse', '--short', 'HEAD'], {
    cwd: PROJECT_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  await hashProc.exited;
  
  if (hashProc.exitCode !== 0) {
    console.warn('⚠️  Could not get git commit hash, using "unknown"');
    return 'unknown';
  }
  
  const hash = (await new Response(hashProc.stdout).text()).trim();
  
  // Check for uncommitted changes
  const statusProc = Bun.spawn(['git', 'status', '--porcelain'], {
    cwd: PROJECT_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  await statusProc.exited;
  
  const status = (await new Response(statusProc.stdout).text()).trim();
  const isDirty = status.length > 0;
  
  return isDirty ? `${hash}-dirty` : hash;
}

const gitCommit = await getGitCommit();
console.log(`✅ Git commit: ${gitCommit}`);
console.log('');

// ============================================================================
// Step 1: Clean and create directory structure
// ============================================================================
console.log('🧹 Cleaning cli-dist directory...');
if (existsSync(CLI_DIST)) {
  rmSync(CLI_DIST, { recursive: true, force: true });
}

mkdirSync(CLI_DIST, { recursive: true });
mkdirSync(join(CLI_DIST, 'bin'), { recursive: true });
mkdirSync(join(CLI_DIST, 'dist', 'opencode', 'darwin-arm64'), { recursive: true });
mkdirSync(join(CLI_DIST, 'dist', 'opencode', 'darwin-x64'), { recursive: true });

console.log('✅ Directory structure created');
console.log('');

// ============================================================================
// Binary Locations Reference
// ============================================================================
// The CLI passes these paths to the server via environment variables:
//   BIRDHOUSE_OPENCODE_BIN  -> cli-dist/dist/opencode/darwin-arm64/opencode
//   FRONTEND_STATIC         -> cli-dist/dist/frontend
//   BIRDHOUSE_BASE_PORT     -> 50100 (server serves frontend on 50100, OpenCode 50110+)
//
// Server is responsible for:
//   - Spawning OpenCode instances with workspace-specific configuration
//   - Managing multiple workspace/OpenCode pairs
//
// Plugin is now embedded in OpenCode binary (no external files needed)
// ============================================================================

// ============================================================================
// Step 2: Build Frontend
// ============================================================================
console.log('📦 Building frontend...');

const frontendBuild = Bun.spawn(['bun', 'run', 'build'], {
  cwd: FRONTEND_DIR,
  env: {
    ...process.env,
    VITE_SERVER_PORT: '50100', // Production: server serves frontend on base port
  },
  stdout: 'inherit',
  stderr: 'inherit',
});

await frontendBuild.exited;

if (frontendBuild.exitCode !== 0) {
  console.error('❌ Frontend build failed');
  process.exit(1);
}

// Copy frontend dist to cli-dist
cpSync(join(FRONTEND_DIR, 'dist'), join(CLI_DIST, 'dist', 'frontend'), { recursive: true });
console.log('✅ Frontend built and copied');
console.log('');

// ============================================================================
// Step 3: Build Server Binaries (both architectures)
// ============================================================================
console.log('🔧 Building server binaries...');

// Build for darwin-arm64
console.log('   Building server for darwin-arm64...');
const serverBuildArm64 = Bun.spawn([
  'bun',
  'build',
  'src/index.ts',
  '--compile',
  '--target=bun-darwin-arm64',
  `--outfile=${join(CLI_DIST, 'dist', 'server-darwin-arm64')}`,
], {
  cwd: SERVER_DIR,
  stdout: 'inherit',
  stderr: 'inherit',
});

await serverBuildArm64.exited;

if (serverBuildArm64.exitCode !== 0) {
  console.error('❌ Server build (arm64) failed');
  process.exit(1);
}

// Build for darwin-x64
console.log('   Building server for darwin-x64...');
const serverBuildX64 = Bun.spawn([
  'bun',
  'build',
  'src/index.ts',
  '--compile',
  '--target=bun-darwin-x64',
  `--outfile=${join(CLI_DIST, 'dist', 'server-darwin-x64')}`,
], {
  cwd: SERVER_DIR,
  stdout: 'inherit',
  stderr: 'inherit',
});

await serverBuildX64.exited;

if (serverBuildX64.exitCode !== 0) {
  console.error('❌ Server build (x64) failed');
  process.exit(1);
}

console.log('✅ Server binaries compiled (arm64 + x64)');
console.log('');

// ============================================================================
// Step 4: Build OpenCode Binary (with embedded Birdhouse plugin)
// ============================================================================
console.log('⚡ Building OpenCode binary...');

if (!existsSync(OPENCODE_PKG)) {
  console.error(`❌ OpenCode not found at: ${OPENCODE_PKG}`);
  console.error('   Set OPENCODE_PATH environment variable or clone OpenCode to default location');
  process.exit(1);
}

// Step 5a: Copy plugin source into OpenCode (so it gets compiled into binary)
console.log('🔌 Embedding plugin into OpenCode source...');
const opencodeBirdhousePlugin = join(OPENCODE_PKG, 'src', 'plugin', 'birdhouse.ts');
cpSync(join(PLUGIN_DIR, 'src', 'plugin.ts'), opencodeBirdhousePlugin);
console.log('✅ Plugin source copied to OpenCode');
console.log('');

// Step 5b: Install OpenCode dependencies for all platforms (needed for cross-compilation)
console.log('📦 Installing OpenCode dependencies for all platforms...');
const opencodeInstall = Bun.spawn(['bun', 'install', '--os=*', '--cpu=*'], {
  cwd: OPENCODE_PKG,
  stdout: 'inherit',
  stderr: 'inherit',
});

await opencodeInstall.exited;

if (opencodeInstall.exitCode !== 0) {
  console.error('❌ OpenCode dependency install failed');
  process.exit(1);
}
console.log('✅ OpenCode dependencies installed for all platforms');
console.log('');

// Step 5c: Build all platforms (not --single) so we get both darwin-arm64 and darwin-x64
const opencodeBuild = Bun.spawn(['bun', 'run', 'build'], {
  cwd: OPENCODE_PKG,
  stdout: 'inherit',
  stderr: 'inherit',
});

await opencodeBuild.exited;

if (opencodeBuild.exitCode !== 0) {
  console.error('❌ OpenCode build failed');
  process.exit(1);
}

// Copy OpenCode binaries for both architectures
const opencodeArm64Source = join(OPENCODE_PKG, 'dist', 'opencode-darwin-arm64', 'bin', 'opencode');
const opencodeX64Source = join(OPENCODE_PKG, 'dist', 'opencode-darwin-x64', 'bin', 'opencode');

if (!existsSync(opencodeArm64Source)) {
  console.error(`❌ OpenCode arm64 binary not found at: ${opencodeArm64Source}`);
  process.exit(1);
}

if (!existsSync(opencodeX64Source)) {
  console.error(`❌ OpenCode x64 binary not found at: ${opencodeX64Source}`);
  process.exit(1);
}

cpSync(opencodeArm64Source, join(CLI_DIST, 'dist', 'opencode', 'darwin-arm64', 'opencode'));
cpSync(opencodeX64Source, join(CLI_DIST, 'dist', 'opencode', 'darwin-x64', 'opencode'));
console.log('✅ OpenCode binaries built and copied (arm64 + x64, with embedded plugin)');
console.log('');

// ============================================================================
// Step 6: Write Shell Wrapper and Version Info
// ============================================================================
console.log('📝 Writing shell wrapper and version info...');

// Write the bin/birdhouse shell wrapper
const shellWrapper = `#!/bin/sh
# ABOUTME: Birdhouse CLI shell wrapper - detects architecture and execs the right binary
# ABOUTME: Sets BIRDHOUSE_CLI_ROOT so the binary knows where to find dist/ assets

ARCH=$(uname -m)
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
CLI_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

export BIRDHOUSE_CLI_ROOT="$CLI_ROOT"

case "$ARCH" in
  arm64)
    exec "$CLI_ROOT/dist/birdhouse-darwin-arm64" "$@"
    ;;
  x86_64)
    exec "$CLI_ROOT/dist/birdhouse-darwin-x64" "$@"
    ;;
  *)
    echo "Error: Unsupported architecture: $ARCH" >&2
    echo "Birdhouse supports macOS on arm64 and x86_64." >&2
    exit 1
    ;;
esac
`;
writeFileSync(join(CLI_DIST, 'bin', 'birdhouse'), shellWrapper);
chmodSync(join(CLI_DIST, 'bin', 'birdhouse'), 0o755);
console.log('✅ bin/birdhouse shell wrapper written and made executable');

// Write version.json with git commit info
const versionInfo = {
  commit: gitCommit,
};
writeFileSync(join(CLI_DIST, 'version.json'), JSON.stringify(versionInfo, null, 2) + '\n');
console.log('✅ version.json written');

console.log('');

// ============================================================================
// Step 7: Compile Launcher Binaries
// ============================================================================
console.log('🔧 Compiling launcher binaries...');

// BIRDHOUSE_VERSION is set by the release workflow (workflow_dispatch input).
// Falls back to 'dev' for local builds.
const cliVersion = process.env.BIRDHOUSE_VERSION || 'dev';

// Compile for darwin-arm64
console.log('   Compiling launcher for darwin-arm64...');
const launcherBuildArm64 = Bun.spawn([
  'bun',
  'build',
  join(TEMPLATES_DIR, 'birdhouse.js'),
  '--compile',
  '--target=bun-darwin-arm64',
  `--outfile=${join(CLI_DIST, 'dist', 'birdhouse-darwin-arm64')}`,
  `--define`, `process.env.BIRDHOUSE_VERSION="${cliVersion}"`,
], {
  cwd: PROJECT_ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});

await launcherBuildArm64.exited;

if (launcherBuildArm64.exitCode !== 0) {
  console.error('❌ Launcher build (arm64) failed');
  process.exit(1);
}

// Compile for darwin-x64
console.log('   Compiling launcher for darwin-x64...');
const launcherBuildX64 = Bun.spawn([
  'bun',
  'build',
  join(TEMPLATES_DIR, 'birdhouse.js'),
  '--compile',
  '--target=bun-darwin-x64',
  `--outfile=${join(CLI_DIST, 'dist', 'birdhouse-darwin-x64')}`,
  `--define`, `process.env.BIRDHOUSE_VERSION="${cliVersion}"`,
], {
  cwd: PROJECT_ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});

await launcherBuildX64.exited;

if (launcherBuildX64.exitCode !== 0) {
  console.error('❌ Launcher build (x64) failed');
  process.exit(1);
}

console.log('✅ Launcher binaries compiled (arm64 + x64)');
console.log('');

// ============================================================================
// Done
// ============================================================================
console.log('✅ Build complete!');
console.log(`📦 Distribution ready at: ${CLI_DIST}`);
console.log('');
console.log('To create release tarballs:');
console.log(`  cd ${CLI_DIST} && tar -czvf birdhouse-darwin-arm64.tar.gz dist/birdhouse-darwin-arm64 dist/server-darwin-arm64 dist/opencode/darwin-arm64 dist/frontend bin/ version.json`);
