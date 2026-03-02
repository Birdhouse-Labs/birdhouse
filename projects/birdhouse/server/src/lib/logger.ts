// ABOUTME: Pino-based structured logging with per-subsystem log level configuration
// ABOUTME: Writes to ~/Library/Logs/Birdhouse/ with daily rotation, always on

import { appendFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import pino, { type Logger } from "pino";

export type { Logger };
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";

/** Captured log entry for test assertions */
export interface CapturedLog {
  level: LogLevel;
  subsystem: string;
  msg: string;
  data?: Record<string, unknown>;
}

/** Logger interface matching Pino's API for the methods we use */
export interface SubsystemLogger {
  trace: (objOrMsg: Record<string, unknown> | string, msg?: string) => void;
  debug: (objOrMsg: Record<string, unknown> | string, msg?: string) => void;
  info: (objOrMsg: Record<string, unknown> | string, msg?: string) => void;
  warn: (objOrMsg: Record<string, unknown> | string, msg?: string) => void;
  error: (objOrMsg: Record<string, unknown> | string, msg?: string) => void;
  fatal: (objOrMsg: Record<string, unknown> | string, msg?: string) => void;
  child: (bindings: Record<string, unknown>) => SubsystemLogger;
}

/** Collection of subsystem loggers */
export interface LoggerDeps {
  api: SubsystemLogger;
  opencode: SubsystemLogger;
  stream: SubsystemLogger;
  server: SubsystemLogger;
}

const isDev = process.env.NODE_ENV !== "production";
const isTest = process.env.NODE_ENV === "test";
const defaultLevel = (process.env.LOG_LEVEL as LogLevel) || (isDev ? "debug" : "info");

/**
 * Parse per-subsystem log levels from environment variable
 * Format: SUBSYSTEM_LEVELS=stream:warn,opencode:debug,api:silent
 * Use 'silent' or 'off' to disable a subsystem entirely
 */
function parseSubsystemLevels(): Map<string, LogLevel> {
  const levels = new Map<string, LogLevel>();
  const config = process.env.SUBSYSTEM_LEVELS || "";

  for (const pair of config.split(",").filter(Boolean)) {
    const [subsystem, level] = pair.split(":");
    if (subsystem && level) {
      const normalizedLevel = level.trim().toLowerCase();
      // Treat 'off' as 'silent' (Pino's way to disable)
      const finalLevel = normalizedLevel === "off" ? "silent" : normalizedLevel;
      levels.set(subsystem.trim(), finalLevel as LogLevel);
    }
  }
  return levels;
}

const subsystemLevels = parseSubsystemLevels();

/** App name for log directory */
const APP_NAME = "Birdhouse";

/** Max days to keep log files */
const LOG_RETENTION_DAYS = 7;

/**
 * Get the macOS-appropriate log directory
 * ~/Library/Logs/Birdhouse/ on macOS
 * Falls back to ./logs/ on other platforms or if HOME not available
 */
function getLogDir(): string {
  // Allow override via environment
  if (process.env.LOG_DIR) {
    return process.env.LOG_DIR;
  }

  // macOS standard location: ~/Library/Logs/AppName
  const home = homedir();
  if (home && process.platform === "darwin") {
    return join(home, "Library", "Logs", APP_NAME);
  }

  // Fallback for other platforms or if home not available
  return join(process.cwd(), "logs");
}

/**
 * Get today's date string for log filename
 */
function getDateString(): string {
  const now = new Date();
  return now.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Get the current log file path with date-based rotation
 * Format: ~/Library/Logs/Birdhouse/birdhouse-2024-01-15.log
 * Dev mode: ~/Library/Logs/Birdhouse/birdhouse-dev-2024-01-15.log
 */
function getLogFilePath(): string {
  const logDir = getLogDir();
  const dateStr = getDateString();
  const suffix = isDev ? "-dev" : "";
  return join(logDir, `birdhouse${suffix}-${dateStr}.log`);
}

/**
 * Ensure log directory exists, create if needed
 */
function ensureLogDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Clean up old log files beyond retention period
 * Called once at startup
 */
function cleanupOldLogs(): void {
  const logDir = getLogDir();
  if (!existsSync(logDir)) return;

  const now = Date.now();
  const maxAge = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  try {
    const files = readdirSync(logDir);
    for (const file of files) {
      if (!file.startsWith("birdhouse-") || !file.endsWith(".log")) continue;

      const filePath = join(logDir, file);
      const stats = statSync(filePath);
      const age = now - stats.mtime.getTime();

      if (age > maxAge) {
        unlinkSync(filePath);
      }
    }
  } catch {
    // Ignore cleanup errors - not critical
  }
}

// Skip file logging in tests
const logFile = isTest ? undefined : getLogFilePath();

// Ensure directory exists and cleanup old logs at startup
if (logFile) {
  ensureLogDir(logFile);
  cleanupOldLogs();
}

/** Export log file path for external access (e.g., agents reading logs) */
export const currentLogFile = logFile;
export const logDirectory = getLogDir();

/**
 * Create a write stream that outputs to both console and file
 * Uses sync writes for simplicity (acceptable for local desktop app)
 */
function createDualWriteStream(): NodeJS.WritableStream {
  return {
    write(chunk: string | Buffer): boolean {
      const str = typeof chunk === "string" ? chunk : chunk.toString();

      // Always write to stdout
      process.stdout.write(str);

      // Write to file if enabled
      if (logFile) {
        appendFileSync(logFile, str);
      }

      return true;
    },
  } as NodeJS.WritableStream;
}

/**
 * Root logger instance
 * All subsystem loggers are children of this
 * Always writes JSON to file + stdout (no pino-pretty to avoid worker thread issues with Bun)
 */
export const rootLogger: Logger = pino(
  {
    level: defaultLevel,
    base: { system: "server" },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  },
  createDualWriteStream(),
);

/**
 * Create a subsystem logger with its own log level
 * Respects SUBSYSTEM_LEVELS env var for per-subsystem configuration
 */
export function createSubsystemLogger(subsystem: string): Logger {
  const level = subsystemLevels.get(subsystem) ?? defaultLevel;
  return rootLogger.child({ subsystem }, { level });
}

/**
 * Pre-configured subsystem loggers
 * Import these directly for convenience:
 *   import { log } from './lib/logger';
 *   log.api.info({ sessionId }, 'Session created');
 */
export const log = {
  /** HTTP routes and request handling */
  api: createSubsystemLogger("api"),
  /** OpenCode client operations */
  opencode: createSubsystemLogger("opencode"),
  /** SSE streaming and events */
  stream: createSubsystemLogger("stream"),
  /** Server startup and configuration */
  server: createSubsystemLogger("server"),
};

/**
 * Create a request-scoped logger with request context
 * Use in middleware to create per-request child loggers
 */
export function createRequestLogger(requestId: string, extra?: Record<string, unknown>): Logger {
  return log.api.child({ requestId, ...extra });
}

/**
 * Check if a subsystem is enabled (not set to silent)
 * Useful for skipping expensive log data preparation
 */
export function isSubsystemEnabled(subsystem: string): boolean {
  const level = subsystemLevels.get(subsystem) ?? defaultLevel;
  return level !== "silent";
}

/**
 * Get the configured log level for a subsystem
 */
export function getSubsystemLevel(subsystem: string): LogLevel {
  return subsystemLevels.get(subsystem) ?? defaultLevel;
}

/**
 * Create a test logger that captures all logs to an array
 * Use in tests to assert on log output
 */
export function createTestLogger(): {
  log: LoggerDeps;
  captured: CapturedLog[];
} {
  const captured: CapturedLog[] = [];

  function createTestSubsystemLogger(subsystem: string): SubsystemLogger {
    const makeLogFn =
      (level: LogLevel) =>
      (objOrMsg: Record<string, unknown> | string, msg?: string): void => {
        if (typeof objOrMsg === "string") {
          captured.push({ level, subsystem, msg: objOrMsg });
        } else {
          captured.push({ level, subsystem, msg: msg || "", data: objOrMsg });
        }
      };

    const logger: SubsystemLogger = {
      trace: makeLogFn("trace"),
      debug: makeLogFn("debug"),
      info: makeLogFn("info"),
      warn: makeLogFn("warn"),
      error: makeLogFn("error"),
      fatal: makeLogFn("fatal"),
      child: (bindings: Record<string, unknown>) => {
        // Child logger captures with merged bindings
        const childSubsystem = (bindings.subsystem as string) || subsystem;
        return createTestSubsystemLogger(childSubsystem);
      },
    };

    return logger;
  }

  return {
    log: {
      api: createTestSubsystemLogger("api"),
      opencode: createTestSubsystemLogger("opencode"),
      stream: createTestSubsystemLogger("stream"),
      server: createTestSubsystemLogger("server"),
    },
    captured,
  };
}

/**
 * Create live logger (wraps the Pino-based log object)
 */
export function createLiveLogger(): LoggerDeps {
  return log as unknown as LoggerDeps;
}
