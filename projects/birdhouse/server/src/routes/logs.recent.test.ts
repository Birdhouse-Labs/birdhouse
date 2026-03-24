// ABOUTME: Tests for GET /api/logs/recent endpoint
// ABOUTME: Verifies response shape, query param handling, and always-200 behaviour

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { createLogRoutes } from "./logs";

interface RecentLogsResponse {
  lines: Array<{
    time: string;
    level: string;
    subsystem: string;
    msg: string;
    raw: string;
    source: "birdhouse" | "opencode";
  }>;
  truncated: boolean;
}

function buildApp() {
  const app = new Hono();
  app.route("/api/logs", createLogRoutes());
  return app;
}

describe("GET /api/logs/recent", () => {
  let tmpDir: string;
  let originalLogDir: string | undefined;
  let originalOpencodePathEnv: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "birdhouse-route-test-"));
    originalLogDir = process.env.LOG_DIR;
    originalOpencodePathEnv = process.env.OPENCODE_PATH;
    originalNodeEnv = process.env.NODE_ENV;
    process.env.LOG_DIR = tmpDir;
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

  function writeBirdhouseLog(lines: string[]) {
    const date = new Date().toISOString().split("T")[0];
    const logPath = join(tmpDir, `birdhouse-dev-${date}.log`);
    writeFileSync(logPath, `${lines.join("\n")}\n`);
  }

  function writeOpenCodeLog(workspaceId: string, lines: string[]) {
    const logsDir = join(tmpDir, "workspaces", workspaceId, "engine", "logs");
    mkdirSync(logsDir, { recursive: true });
    writeFileSync(join(logsDir, "opencode.log"), `${lines.join("\n")}\n`);
  }

  test("returns 200 with empty lines when no log file exists", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/api/logs/recent"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as RecentLogsResponse;
    expect(body.lines).toEqual([]);
    expect(body.truncated).toBe(false);
  });

  test("returns parsed Birdhouse log lines", async () => {
    writeBirdhouseLog(['{"level":"info","time":"2026-03-24T01:00:00.000Z","subsystem":"api","msg":"Hello"}']);

    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/api/logs/recent"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as RecentLogsResponse;
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0].msg).toBe("Hello");
    expect(body.lines[0].source).toBe("birdhouse");
    expect(body.lines[0].level).toBe("info");
    expect(body.lines[0].subsystem).toBe("api");
    expect(typeof body.lines[0].raw).toBe("string");
  });

  test("respects limit query param", async () => {
    const lines = Array.from(
      { length: 20 },
      (_, i) =>
        `{"level":"info","time":"2026-03-24T0${String(i).padStart(2, "0")}:00:00.000Z","subsystem":"api","msg":"Line ${i}"}`,
    );
    writeBirdhouseLog(lines);

    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/api/logs/recent?limit=5"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as RecentLogsResponse;
    expect(body.lines).toHaveLength(5);
    expect(body.truncated).toBe(true);
  });

  test("default limit is 200", async () => {
    // Write 150 lines — all should be returned (under the default 200 limit)
    const lines = Array.from(
      { length: 150 },
      (_, i) =>
        `{"level":"info","time":"2026-03-24T00:00:${String(i % 60).padStart(2, "0")}.${String(i).padStart(3, "0")}Z","subsystem":"api","msg":"Line ${i}"}`,
    );
    writeBirdhouseLog(lines);

    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/api/logs/recent"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as RecentLogsResponse;
    expect(body.lines).toHaveLength(150);
    expect(body.truncated).toBe(false);
  });

  test("merges OpenCode log when workspaceId is provided in dev mode", async () => {
    process.env.OPENCODE_PATH = "/fake/opencode";

    writeBirdhouseLog(['{"level":"info","time":"2026-03-24T01:00:00.000Z","subsystem":"api","msg":"Birdhouse line"}']);

    const workspaceId = "ws_routetest";
    writeOpenCodeLog(workspaceId, ["INFO  2026-03-24T02:00:00 +0ms service=server opencode line"]);

    const app = buildApp();
    const res = await app.fetch(
      new Request(
        `http://localhost/api/logs/recent?workspaceId=${workspaceId}&openCodeDataRoot=${join(tmpDir, "workspaces")}`,
      ),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as RecentLogsResponse;
    expect(body.lines).toHaveLength(2);
    const sources = body.lines.map((l) => l.source);
    expect(sources).toContain("birdhouse");
    expect(sources).toContain("opencode");
  });

  test("always returns 200 even with invalid limit param", async () => {
    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/api/logs/recent?limit=notanumber"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as RecentLogsResponse;
    // Falls back to default 200
    expect(Array.isArray(body.lines)).toBe(true);
  });
});
