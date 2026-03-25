// ABOUTME: Tests for log file reading, parsing, and merging logic
// ABOUTME: Covers Birdhouse JSON logs and OpenCode plain-text logs

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseBirdhouseLogLine, parseOpenCodeLogLine, readRecentLogs } from "./log-reader";

// ---------------------------------------------------------------------------
// parseBirdhouseLogLine
// ---------------------------------------------------------------------------

describe("parseBirdhouseLogLine", () => {
  test("parses a well-formed Birdhouse log line", () => {
    const line =
      '{"level":"info","time":"2026-03-24T03:20:12.824Z","system":"server","subsystem":"api","msg":"Request completed"}';
    const result = parseBirdhouseLogLine(line);

    expect(result).not.toBeNull();
    expect(result?.level).toBe("info");
    expect(result?.time).toBe("2026-03-24T03:20:12.824Z");
    expect(result?.subsystem).toBe("api");
    expect(result?.msg).toBe("Request completed");
    expect(result?.source).toBe("birdhouse");
    expect(result?.raw).toBe(line);
  });

  test("falls back to 'unknown' subsystem when field is missing", () => {
    const line = '{"level":"warn","time":"2026-03-24T10:00:00.000Z","msg":"No subsystem"}';
    const result = parseBirdhouseLogLine(line);

    expect(result).not.toBeNull();
    expect(result?.subsystem).toBe("unknown");
  });

  test("returns null for malformed JSON", () => {
    const result = parseBirdhouseLogLine("not json at all");
    expect(result).toBeNull();
  });

  test("returns null for empty line", () => {
    expect(parseBirdhouseLogLine("")).toBeNull();
    expect(parseBirdhouseLogLine("   ")).toBeNull();
  });

  test("returns null when time field is missing", () => {
    const line = '{"level":"info","subsystem":"api","msg":"No time"}';
    const result = parseBirdhouseLogLine(line);
    expect(result).toBeNull();
  });

  test("returns null when level field is missing", () => {
    const line = '{"time":"2026-03-24T03:20:12.824Z","subsystem":"api","msg":"No level"}';
    const result = parseBirdhouseLogLine(line);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseOpenCodeLogLine
// ---------------------------------------------------------------------------

describe("parseOpenCodeLogLine", () => {
  test("parses a well-formed OpenCode log line", () => {
    const line = "INFO  2026-03-24T03:20:12 +0ms service=server status=started method=GET path=/question request";
    const result = parseOpenCodeLogLine(line);

    expect(result).not.toBeNull();
    expect(result?.level).toBe("info");
    expect(result?.time).toBe("2026-03-24T03:20:12.000Z");
    expect(result?.subsystem).toBe("opencode");
    expect(result?.msg).toBe("service=server status=started method=GET path=/question request");
    expect(result?.source).toBe("opencode");
    expect(result?.raw).toBe(line);
  });

  test("normalises uppercase level to lowercase", () => {
    const line = "WARN  2026-03-24T04:00:00 +5ms something happened";
    const result = parseOpenCodeLogLine(line);

    expect(result).not.toBeNull();
    expect(result?.level).toBe("warn");
  });

  test("handles DEBUG level", () => {
    const line = "DEBUG 2026-03-24T05:00:00 +10ms some debug info";
    const result = parseOpenCodeLogLine(line);

    expect(result).not.toBeNull();
    expect(result?.level).toBe("debug");
  });

  test("msg is only the remainder after the elapsed field — no level/timestamp prefix", () => {
    const line = "INFO  2026-03-24T03:20:51 +38831ms service=server method=GET path=/global/health request";
    const result = parseOpenCodeLogLine(line);

    expect(result).not.toBeNull();
    // msg must not start with the level, timestamp, or elapsed prefix
    expect(result?.msg).not.toMatch(/^INFO/);
    expect(result?.msg).not.toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result?.msg).not.toMatch(/^\+\d+ms/);
    // msg is the full suffix after +Xms — key=value pairs plus trailing words
    expect(result?.msg).toBe("service=server method=GET path=/global/health request");
  });

  test("returns null for malformed line (no timestamp)", () => {
    const result = parseOpenCodeLogLine("INFO garbage line no timestamp");
    expect(result).toBeNull();
  });

  test("returns null for empty line", () => {
    expect(parseOpenCodeLogLine("")).toBeNull();
    expect(parseOpenCodeLogLine("   ")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readRecentLogs — integration using temp files
// ---------------------------------------------------------------------------

describe("readRecentLogs", () => {
  let tmpDir: string;
  let originalLogDir: string | undefined;
  let originalOpencodePathEnv: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "birdhouse-log-test-"));
    originalLogDir = process.env.LOG_DIR;
    originalOpencodePathEnv = process.env.OPENCODE_PATH;
    originalNodeEnv = process.env.NODE_ENV;
    // Force dev mode for tests (so birdhouse log suffix is "-dev")
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (originalLogDir === undefined) {
      delete process.env.LOG_DIR;
    } else {
      process.env.LOG_DIR = originalLogDir;
    }
    if (originalOpencodePathEnv === undefined) {
      delete process.env.OPENCODE_PATH;
    } else {
      process.env.OPENCODE_PATH = originalOpencodePathEnv;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  function writeBirdhouseLog(lines: string[]): string {
    process.env.LOG_DIR = tmpDir;
    const date = new Date().toISOString().split("T")[0];
    const logPath = join(tmpDir, `birdhouse-dev-${date}.log`);
    writeFileSync(logPath, `${lines.join("\n")}\n`);
    return logPath;
  }

  function writeOpenCodeLog(workspaceId: string, lines: string[]): string {
    const logsDir = join(tmpDir, "workspaces", workspaceId, "engine", "logs");
    mkdirSync(logsDir, { recursive: true });
    const logPath = join(logsDir, "opencode.log");
    writeFileSync(logPath, `${lines.join("\n")}\n`);
    return logPath;
  }

  test("returns empty lines and truncated:false when Birdhouse log does not exist", async () => {
    process.env.LOG_DIR = tmpDir; // tmpDir has no log file
    const result = await readRecentLogs({ limit: 200 });

    expect(result.lines).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  test("reads and parses Birdhouse log lines", async () => {
    writeBirdhouseLog([
      '{"level":"info","time":"2026-03-24T01:00:00.000Z","subsystem":"api","msg":"First"}',
      '{"level":"debug","time":"2026-03-24T02:00:00.000Z","subsystem":"server","msg":"Second"}',
    ]);

    const result = await readRecentLogs({ limit: 200 });

    expect(result.lines).toHaveLength(2);
    // Sorted newest first
    expect(result.lines[0].msg).toBe("Second");
    expect(result.lines[1].msg).toBe("First");
    expect(result.truncated).toBe(false);
  });

  test("returns truncated:true when more lines exist than limit", async () => {
    const lines = Array.from(
      { length: 10 },
      (_, i) => `{"level":"info","time":"2026-03-24T0${i}:00:00.000Z","subsystem":"api","msg":"Line ${i}"}`,
    );
    writeBirdhouseLog(lines);

    const result = await readRecentLogs({ limit: 5 });

    expect(result.lines).toHaveLength(5);
    expect(result.truncated).toBe(true);
  });

  test("skips malformed Birdhouse log lines silently", async () => {
    writeBirdhouseLog([
      '{"level":"info","time":"2026-03-24T01:00:00.000Z","subsystem":"api","msg":"Good"}',
      "this is not json",
      "",
    ]);

    const result = await readRecentLogs({ limit: 200 });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].msg).toBe("Good");
  });

  test("merges Birdhouse and OpenCode lines sorted newest first", async () => {
    // OPENCODE_PATH must be set to trigger dev-mode OpenCode log reading
    process.env.OPENCODE_PATH = "/fake/opencode/path";

    writeBirdhouseLog([
      '{"level":"info","time":"2026-03-24T01:00:00.000Z","subsystem":"api","msg":"Birdhouse first"}',
      '{"level":"info","time":"2026-03-24T03:00:00.000Z","subsystem":"api","msg":"Birdhouse third"}',
    ]);

    const workspaceId = "ws_test123";
    // Override the data root so our test writes land in tmpDir
    writeOpenCodeLog(workspaceId, ["INFO  2026-03-24T02:00:00 +0ms opencode second"]);

    const result = await readRecentLogs({
      limit: 200,
      workspaceId,
      openCodeDataRoot: join(tmpDir, "workspaces"),
    });

    expect(result.lines).toHaveLength(3);
    expect(result.lines[0].msg).toBe("Birdhouse third");
    expect(result.lines[0].source).toBe("birdhouse");
    expect(result.lines[1].msg).toBe("opencode second");
    expect(result.lines[1].source).toBe("opencode");
    expect(result.lines[2].msg).toBe("Birdhouse first");
  });

  test("returns empty OpenCode lines when workspaceId is not provided", async () => {
    process.env.OPENCODE_PATH = "/fake/opencode/path";

    writeBirdhouseLog(['{"level":"info","time":"2026-03-24T01:00:00.000Z","subsystem":"api","msg":"Only birdhouse"}']);

    const result = await readRecentLogs({ limit: 200 });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].source).toBe("birdhouse");
  });

  test("returns empty OpenCode lines in prod mode (no OPENCODE_PATH)", async () => {
    delete process.env.OPENCODE_PATH;

    writeBirdhouseLog(['{"level":"info","time":"2026-03-24T01:00:00.000Z","subsystem":"api","msg":"Prod birdhouse"}']);

    const workspaceId = "ws_prod_test";
    writeOpenCodeLog(workspaceId, ["INFO  2026-03-24T01:30:00 +0ms opencode msg"]);

    const result = await readRecentLogs({
      limit: 200,
      workspaceId,
      openCodeDataRoot: join(tmpDir, "workspaces"),
    });

    // In prod mode, OpenCode logs are in the Birdhouse log already — no separate file read
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].source).toBe("birdhouse");
  });

  test("returns empty when OpenCode log file does not exist (no error)", async () => {
    process.env.OPENCODE_PATH = "/fake/opencode/path";

    writeBirdhouseLog(['{"level":"info","time":"2026-03-24T01:00:00.000Z","subsystem":"api","msg":"Birdhouse only"}']);

    const result = await readRecentLogs({
      limit: 200,
      workspaceId: "ws_nonexistent",
      openCodeDataRoot: join(tmpDir, "workspaces"),
    });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].source).toBe("birdhouse");
  });
});
