// ABOUTME: Main server entry point for Birdhouse server
// ABOUTME: Sets up Hono app with workspace middleware, Pino logging, and routes

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { pinoLogger } from "hono-pino";
import { createPosthogDeps, withDeps } from "./dependencies";
import { DATA_DIR, getDataDB, initDataDB } from "./lib/data-db";
import { syncDevPluginSource } from "./lib/dev-plugin-sync";
import { log, rootLogger } from "./lib/logger";
import { OpenCodeManager } from "./lib/opencode-manager";
import { initPatternGroupsPersistence } from "./lib/pattern-groups-db";
import { warmRecentWorkspacesInBackground } from "./lib/startup-warmup";
import { createAAPIMiddleware } from "./middleware/aapi";
import { createWorkspaceMiddleware } from "./middleware/workspace";
import { createAAPIAgentRoutes } from "./routes/aapi-agents";
import { createAgentRoutes } from "./routes/agents";
import { createBundleRoutes } from "./routes/bundles";
import { createConfigRoutes } from "./routes/config";
import { createEventRoutes } from "./routes/events";
import { createFileRoutes } from "./routes/files";
import { createLogRoutes } from "./routes/logs";
import { createModelRoutes } from "./routes/models";
import { createPatternGroupRoutes } from "./routes/pattern-groups";
import { createPosthogRoutes } from "./routes/posthog-ingest";
import { createSkillRoutes } from "./routes/skills";
import { createTitleRoutes } from "./routes/title";
import { createUserProfileRoutes } from "./routes/user-profile";
import { createWorkspaceRoutes } from "./routes/workspaces";

// Required configuration
if (!process.env.BIRDHOUSE_BASE_PORT) {
  throw new Error("BIRDHOUSE_BASE_PORT environment variable is required");
}

// OpenCode configuration - one of two modes required:
//   Dev mode:  OPENCODE_PATH points to Birdhouse's OpenCode fork (runs from source)
//   Prod mode: BIRDHOUSE_OPENCODE_BIN points to compiled OpenCode binary
const isDevMode = !!process.env.OPENCODE_PATH;
if (!isDevMode && !process.env.BIRDHOUSE_OPENCODE_BIN) {
  console.error("❌ OpenCode is not configured. Set one of:");
  console.error("");
  console.error("  Dev mode (recommended):");
  console.error("    OPENCODE_PATH=/path/to/opencode");
  console.error("");
  console.error("  Clone the Birdhouse OpenCode fork:");
  console.error("    git clone https://github.com/Birdhouse-Labs/opencode.git");
  console.error("    cd opencode && git checkout birdhouse");
  console.error("    Then set OPENCODE_PATH=/path/to/opencode in your .env file");
  console.error("");
  console.error("  Production mode:");
  console.error("    BIRDHOUSE_OPENCODE_BIN=/path/to/opencode/binary");
  process.exit(1);
}

if (isDevMode) {
  const opencodePath = process.env.OPENCODE_PATH;
  if (!opencodePath) {
    throw new Error("OPENCODE_PATH is required in dev mode");
  }
  const opencodeIndexPath = join(opencodePath, "packages", "opencode", "src", "index.ts");
  if (!existsSync(opencodeIndexPath)) {
    console.error(`❌ OPENCODE_PATH is set but does not look like a valid OpenCode repository:`);
    console.error(`   ${opencodePath}`);
    console.error("");
    console.error("  Expected to find: packages/opencode/src/index.ts");
    console.error("");
    console.error("  Make sure OPENCODE_PATH points to the Birdhouse OpenCode fork root:");
    console.error("    git clone https://github.com/Birdhouse-Labs/opencode.git");
    console.error("    cd opencode && git checkout birdhouse");
    process.exit(1);
  }
}

// Server port is passed by launcher (dev.ts/serve.ts compute it as BASE_PORT + 1)
const PORT = Number.parseInt(process.env.BIRDHOUSE_BASE_PORT, 10);
const FRONTEND_STATIC = process.env.FRONTEND_STATIC;

// Binary path (unused in dev mode, required in production)
const OPENCODE_BINARY = process.env.BIRDHOUSE_OPENCODE_BIN || "";

// Run migrations and initialize DataDB
await initDataDB();
const dataDb = getDataDB();
const opencodeManager = new OpenCodeManager(dataDb, OPENCODE_BINARY, PORT);

// Initialize pattern groups persistence
const patternsBasePath = join(DATA_DIR, "patterns");
const patternGroupsPersistence = initPatternGroupsPersistence(patternsBasePath);

// Seed pattern groups
log.server.info("Seeding pattern groups...");

// 1. Seed user default group
await patternGroupsPersistence.ensureUserDefaultGroup();

// 2. Seed workspace default groups for all existing workspaces
const workspaces = dataDb.getAllWorkspaces();
await patternGroupsPersistence.ensureAllWorkspaceDefaultGroups(workspaces);

// 3. Seed Birdhouse patterns
const { seeded, updated } = await patternGroupsPersistence.seedBirdhousePatterns();
log.server.info({ seeded, updated }, "Birdhouse patterns seeded");

// Dev mode: Ensure plugin source is available for running OpenCode from source
// In dev, OPENCODE_PATH points to OpenCode source and we run from TypeScript
// Production mode uses compiled binary which has plugin embedded
if (process.env.OPENCODE_PATH) {
  const pluginSource = resolve(__dirname, "..", "..", "..", "birdhouse-oc-plugin", "src", "plugin.ts");
  syncDevPluginSource(pluginSource, process.env.OPENCODE_PATH);
}

// Validate existing OpenCode instances from database
await opencodeManager.validateAllOpenCodeInstances();

log.server.info(
  {
    port: PORT,
    opencodeBinary: OPENCODE_BINARY,
  },
  "Birdhouse Server initializing",
);

// Create Hono app
const app = new Hono();
const posthogDeps = createPosthogDeps();

// Middleware: CORS
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Disposition"], // Allow frontend to read filename from export endpoint
  }),
);

app.use("/ingest", async (_c, next) => withDeps(posthogDeps, () => next()));
app.use("/ingest/*", async (_c, next) => withDeps(posthogDeps, () => next()));
app.route("/ingest", createPosthogRoutes());

// Middleware: Pino HTTP logging (replaces hono/logger)
// Apply to all routes except /api/logs (log relay is infrastructure noise)
app.use(
  "/api/workspace/:workspaceId/*",
  pinoLogger({
    pino: rootLogger,
    http: { reqId: () => crypto.randomUUID().slice(0, 8) },
  }),
);
app.use(
  "/api/workspaces",
  pinoLogger({
    pino: rootLogger,
    http: { reqId: () => crypto.randomUUID().slice(0, 8) },
  }),
);
app.use(
  "/api/workspace/*",
  pinoLogger({
    pino: rootLogger,
    http: { reqId: () => crypto.randomUUID().slice(0, 8) },
  }),
);
app.use(
  "/api/health",
  pinoLogger({
    pino: rootLogger,
    http: { reqId: () => crypto.randomUUID().slice(0, 8) },
  }),
);
app.use(
  "/aapi/*",
  pinoLogger({
    pino: rootLogger,
    http: { reqId: () => crypto.randomUUID().slice(0, 8) },
  }),
);
// /api/logs gets logger but no HTTP logging (http: false)
app.use("/api/logs", pinoLogger({ pino: rootLogger, http: false }));

// Middleware: Workspace context for workspace-scoped routes
const workspaceMiddleware = createWorkspaceMiddleware(opencodeManager, dataDb);
app.use("/api/workspace/:workspaceId/*", workspaceMiddleware);

// Middleware: AAPI context for plugin routes (reads X-Birdhouse-Workspace-ID header)
const aapiMiddleware = createAAPIMiddleware(opencodeManager, dataDb);
app.use("/aapi/*", aapiMiddleware);

// Health check
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Runtime config (global - not workspace-scoped)
app.route("/api/config", createConfigRoutes());

// User profile routes (global - not workspace-scoped)
app.route("/api/user-profile", createUserProfileRoutes(dataDb));

// Workspace management routes (plural - not workspace-scoped)
app.route("/api/workspaces", createWorkspaceRoutes(dataDb, opencodeManager, patternGroupsPersistence));

// Global routes (not workspace-scoped)
app.route("/api/bundles", createBundleRoutes(dataDb));

// Pattern groups route (uses workspaceId query param - needs workspace context for SSE)
app.use("/api/pattern-groups/*", async (c, next) => {
  const workspaceId = c.req.query("workspaceId");
  if (workspaceId) {
    // Load workspace context for SSE event emission
    const workspace = dataDb.getWorkspaceById(workspaceId);
    if (workspace) {
      c.set("workspace", workspace);
      try {
        const opencode = await opencodeManager.getOrSpawnOpenCode(workspaceId);
        c.set("opencodePort", opencode.port);
        c.set("opencodeBase", `http://127.0.0.1:${opencode.port}`);
      } catch (error) {
        log.server.warn({ workspaceId, error }, "Failed to load OpenCode for pattern-groups SSE");
      }
    }
  }
  await next();
});
app.route("/api/pattern-groups", createPatternGroupRoutes(dataDb, patternGroupsPersistence));

// Workspace-scoped routes (with middleware)
app.route("/api/workspace/:workspaceId/agents", createAgentRoutes());
app.route("/api/workspace/:workspaceId/events", createEventRoutes());
app.route("/api/workspace/:workspaceId/models", createModelRoutes());
app.route("/api/workspace/:workspaceId/skills", createSkillRoutes(dataDb));
app.route("/api/workspace/:workspaceId/title", createTitleRoutes());
app.route("/api/workspace/:workspaceId/files", createFileRoutes());

// Agent API routes (plugin-optimized with filtering)
app.route("/aapi/agents", createAAPIAgentRoutes());

// Frontend log relay
app.route("/api/logs", createLogRoutes());

// Static file serving (must come after API routes to avoid shadowing)
if (FRONTEND_STATIC) {
  log.server.info({ path: FRONTEND_STATIC }, "Serving frontend static files");
  app.use("/*", serveStatic({ root: FRONTEND_STATIC }));
} else {
  // Root API info (only if not serving static files)
  app.get("/", (c) => {
    return c.json({
      message: "Birdhouse Server",
      version: "2.0.0",
      endpoints: {
        health: "/api/health",
        workspaces: "/api/workspaces",
        patternGroups: "/api/pattern-groups",
        agents: "/api/workspace/:workspaceId/agents",
        skills: "/api/workspace/:workspaceId/skills",
        title: "/api/workspace/:workspaceId/title",
        events: "/api/workspace/:workspaceId/events (SSE)",
        files: "/api/workspace/:workspaceId/files",
        models: "/api/workspace/:workspaceId/models",
      },
    });
  });
}

app.onError((err, c) => {
  console.error(`${err}`);

  log.server.error(
    {
      path: c.req.path,
      error: err instanceof Error ? err.message : "Unknown error",
    },
    "Failed to send message to agent",
  );
  return c.text("Custom Error Message", 500);
});

// Start server
log.server.info({ port: PORT }, "Birdhouse Server started");
warmRecentWorkspacesInBackground(dataDb, opencodeManager);

export default {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 0, // Disable timeout for long-lived SSE connections
};
