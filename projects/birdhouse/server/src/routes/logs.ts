// ABOUTME: Receives logs from frontend and writes to unified log stream
// ABOUTME: Tags all entries with system: "frontend" for filtering

import { Hono } from "hono";
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
