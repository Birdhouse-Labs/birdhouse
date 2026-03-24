// ABOUTME: Receives logs from frontend and writes to unified log stream
// ABOUTME: Tags all entries with system: "frontend" for filtering; also serves recent log reads

import { Hono } from "hono";
import { readRecentLogs } from "../lib/log-reader";
import { type LogLevel, rootLogger } from "../lib/logger";

const frontendLogger = rootLogger.child({ system: "frontend" });

// Valid log levels we accept from frontend
const validLevels = new Set<LogLevel>(["trace", "debug", "info", "warn", "error", "fatal"]);

interface FrontendLogEntry {
  level: string;
  subsystem: string;
  msg: string;
  data?: Record<string, unknown>;
}

export function createLogRoutes() {
  const router = new Hono();

  /**
   * GET /api/logs/recent
   * Returns recent log lines from the Birdhouse server log and (optionally) a
   * per-workspace OpenCode log, merged by timestamp newest-first.
   *
   * Query params:
   *   limit       - max lines to return (default 200)
   *   workspaceId - if provided, includes OpenCode logs for that workspace (dev mode only)
   *   openCodeDataRoot - override OpenCode data root path (used in tests)
   */
  router.get("/recent", async (c) => {
    const rawLimit = c.req.query("limit");
    const limit = rawLimit ? (Number.isNaN(Number(rawLimit)) ? 200 : Number(rawLimit)) : 200;
    const workspaceId = c.req.query("workspaceId") || undefined;
    const openCodeDataRoot = c.req.query("openCodeDataRoot") || undefined;

    const result = await readRecentLogs({ limit, workspaceId, openCodeDataRoot });
    return c.json(result);
  });

  router.post("/", async (c) => {
    try {
      const entry: FrontendLogEntry = await c.req.json();
      const { level, subsystem, msg, data } = entry;

      // Validate level
      if (!validLevels.has(level as LogLevel)) {
        return c.json({ error: "Invalid log level" }, 400);
      }

      // Create child logger for this subsystem
      const subLogger = frontendLogger.child({
        subsystem: subsystem || "unknown",
      });

      // Log at the specified level
      const logFn = subLogger[level as LogLevel].bind(subLogger);
      if (data && Object.keys(data).length > 0) {
        logFn(data, msg || "");
      } else {
        logFn(msg || "");
      }

      return c.json({ ok: true });
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
  });

  return router;
}
