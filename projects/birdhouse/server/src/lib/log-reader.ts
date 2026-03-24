// ABOUTME: Reads and parses Birdhouse server logs and OpenCode per-workspace logs
// ABOUTME: Merges both sources by timestamp, returning newest-first sorted results

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type LogSource = "birdhouse" | "opencode";
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LogLine {
  time: string; // ISO 8601
  level: string;
  subsystem: string;
  msg: string;
  raw: string;
  source: LogSource;
}

export interface ReadRecentLogsOptions {
  limit?: number;
  workspaceId?: string;
  /** Override for the OpenCode workspace data root (used in tests) */
  openCodeDataRoot?: string;
}

export interface ReadRecentLogsResult {
  lines: LogLine[];
  truncated: boolean;
}

// ---------------------------------------------------------------------------
// Birdhouse log parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single line from the Birdhouse newline-delimited JSON log.
 * Returns null if the line is blank, malformed, or missing required fields.
 */
export function parseBirdhouseLogLine(line: string): LogLine | null {
  if (!line.trim()) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }

  const time = parsed.time as string | undefined;
  const level = parsed.level as string | undefined;
  if (!time || !level) return null;

  const subsystem = (parsed.subsystem as string | undefined) ?? "unknown";
  const msg = (parsed.msg as string | undefined) ?? "";

  return { time, level, subsystem, msg, raw: line, source: "birdhouse" };
}

// ---------------------------------------------------------------------------
// OpenCode log parsing
// ---------------------------------------------------------------------------

// Format: LEVEL  YYYY-MM-DDTHH:MM:SS +Xms <remainder>
// Named capture groups make the intended field mapping unambiguous.
const OPENCODE_LINE_RE = /^(?<rawLevel>\w+)\s+(?<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\s+\+\d+ms\s+(?<msg>.*)/;

/**
 * Parse a single line from the OpenCode plain-text log.
 * Returns null if the line is blank or doesn't match the expected format.
 * msg is set to the remainder after the elapsed field — never includes the
 * level, timestamp, or elapsed prefix.
 */
export function parseOpenCodeLogLine(line: string): LogLine | null {
  if (!line.trim()) return null;

  const match = OPENCODE_LINE_RE.exec(line);
  if (!match?.groups) return null;

  const { rawLevel, timestamp, msg } = match.groups;
  const level = rawLevel.toLowerCase();
  // Timestamp has no timezone — treat as UTC
  const time = `${timestamp}.000Z`;

  return { time, level, subsystem: "opencode", msg, raw: line, source: "opencode" };
}

// ---------------------------------------------------------------------------
// File reading helpers
// ---------------------------------------------------------------------------

/**
 * Get the path to today's Birdhouse log file.
 * Respects LOG_DIR env override and dev/prod naming.
 */
function getBirdhouseLogPath(): string {
  const logDir = process.env.LOG_DIR ? process.env.LOG_DIR : join(homedir(), "Library", "Logs", "Birdhouse");

  const date = new Date().toISOString().split("T")[0];
  const isDev = process.env.NODE_ENV !== "production";
  const suffix = isDev ? "-dev" : "";
  return join(logDir, `birdhouse${suffix}-${date}.log`);
}

/**
 * Get the path to the OpenCode log for a workspace.
 * openCodeDataRoot defaults to the standard Birdhouse workspace data directory.
 */
function getOpenCodeLogPath(workspaceId: string, openCodeDataRoot?: string): string {
  const root = openCodeDataRoot ?? join(homedir(), "Library", "Application Support", "Birdhouse", "workspaces");
  return join(root, workspaceId, "engine", "logs", "opencode.log");
}

/**
 * Read all non-empty lines from a file.
 * Returns an empty array if the file doesn't exist or can't be read.
 */
function readLines(filePath: string): string[] {
  if (!existsSync(filePath)) return [];
  try {
    return readFileSync(filePath, "utf8")
      .split("\n")
      .filter((l) => l.trim().length > 0);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read recent log lines from the Birdhouse server log and (optionally) the
 * OpenCode log for a workspace. Returns them merged by timestamp, newest first.
 */
export async function readRecentLogs(options: ReadRecentLogsOptions): Promise<ReadRecentLogsResult> {
  const limit = options.limit ?? 200;
  const isDevMode = !!process.env.OPENCODE_PATH;

  // --- Birdhouse lines ---
  const birdhouseLines = readLines(getBirdhouseLogPath())
    .map(parseBirdhouseLogLine)
    .filter((l): l is LogLine => l !== null);

  // --- OpenCode lines (dev mode only, when workspaceId is provided) ---
  let opencodeLines: LogLine[] = [];
  if (isDevMode && options.workspaceId) {
    const ocPath = getOpenCodeLogPath(options.workspaceId, options.openCodeDataRoot);
    opencodeLines = readLines(ocPath)
      .map(parseOpenCodeLogLine)
      .filter((l): l is LogLine => l !== null);
  }

  // --- Merge and sort newest first ---
  const all = [...birdhouseLines, ...opencodeLines].sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  );

  const truncated = all.length > limit;
  const lines = all.slice(0, limit);

  return { lines, truncated };
}
