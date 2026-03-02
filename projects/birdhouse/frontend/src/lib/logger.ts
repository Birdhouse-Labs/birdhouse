// ABOUTME: Browser logger that relays all logs to server for unified log stream
// ABOUTME: Pretty console output locally, sends to /api/logs for persistence and agent access

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Serialized error for JSON transport */
export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
}

interface LogEntry {
  level: LogLevel;
  subsystem: string;
  msg: string;
  data?: Record<string, unknown>;
  error?: SerializedError;
}

/**
 * Serialize an Error object for JSON transport
 * Extracts name, message, and stack trace
 */
export function serializeError(err: unknown): SerializedError | undefined {
  if (!err) return undefined;

  if (err instanceof Error) {
    const result: SerializedError = {
      name: err.name,
      message: err.message,
    };
    // Only add stack if it exists (satisfies exactOptionalPropertyTypes)
    if (err.stack) {
      result.stack = err.stack;
    }
    return result;
  }

  // Handle non-Error objects (e.g., thrown strings)
  return {
    name: "Error",
    message: String(err),
  };
}

import { API_BASE_URL } from "../config/api";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || API_BASE_URL;

/**
 * Logger class that writes to console and relays to server
 */
class Logger {
  private subsystem: string;

  constructor(subsystem: string) {
    this.subsystem = subsystem;
  }

  private log(level: LogLevel, msg: string, data?: Record<string, unknown>, err?: unknown) {
    const entry: LogEntry = { level, subsystem: this.subsystem, msg };
    if (data && Object.keys(data).length > 0) {
      entry.data = data;
    }
    const serializedError = serializeError(err);
    if (serializedError) {
      entry.error = serializedError;
    }

    // Write to browser console with subsystem prefix
    this.writeToConsole(level, msg, data, err);

    // Send to server (fire-and-forget, don't block on response)
    this.sendToServer(entry);
  }

  private writeToConsole(level: LogLevel, msg: string, data?: Record<string, unknown>, err?: unknown) {
    const prefix = `[${this.subsystem}]`;
    // Map our levels to console methods (debug -> log since console.debug is often hidden)
    const consoleMethod = level === "debug" ? "log" : level;

    // Build args array for console
    const args: unknown[] = [prefix, msg];
    if (data && Object.keys(data).length > 0) {
      args.push(data);
    }
    if (err) {
      args.push(err); // Console can display Error objects nicely
    }

    // biome-ignore lint/suspicious/noConsole: Logger needs console access
    console[consoleMethod](...args);
  }

  private sendToServer(entry: LogEntry) {
    fetch(`${SERVER_URL}/api/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch(() => {
      // Server down? That's fine, we already logged to console
    });
  }

  debug(msg: string, data?: Record<string, unknown>) {
    this.log("debug", msg, data);
  }

  info(msg: string, data?: Record<string, unknown>) {
    this.log("info", msg, data);
  }

  warn(msg: string, data?: Record<string, unknown>, err?: unknown) {
    this.log("warn", msg, data, err);
  }

  error(msg: string, data?: Record<string, unknown>, err?: unknown) {
    this.log("error", msg, data, err);
  }
}

/**
 * Pre-configured subsystem loggers
 * Usage: import { log } from './lib/logger';
 *        log.ui.info('Button clicked', { buttonId: 'submit' });
 */
export const log = {
  /** UI interactions, component lifecycle */
  ui: new Logger("ui"),
  /** API calls, fetch requests */
  api: new Logger("api"),
  /** Theme changes, dark mode */
  theme: new Logger("theme"),
  /** Agent management */
  agent: new Logger("agent"),
};

/**
 * Create a custom subsystem logger
 * Usage: const myLog = createLogger('custom');
 *        myLog.info('Something happened');
 */
export function createLogger(subsystem: string): Logger {
  return new Logger(subsystem);
}
