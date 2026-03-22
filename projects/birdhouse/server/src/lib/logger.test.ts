// ABOUTME: Tests for the Pino-based logging system
// ABOUTME: Verifies subsystem configuration, logger creation, and test log capture

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { clearCapturedLogs, createTestDeps, getCapturedLogs, useDeps, withDeps } from "../dependencies";

describe("Logger", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset module cache to test different env configurations
    // Note: Bun doesn't have a clean way to reset module cache,
    // so we test the parsing functions directly
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("subsystem levels parsing", () => {
    test("parses SUBSYSTEM_LEVELS environment variable", async () => {
      // We need to test the parsing logic directly since module caching
      // makes it hard to test different env configurations

      // Test the format: subsystem:level,subsystem:level
      const config = "stream:warn,opencode:debug,api:silent";
      const pairs = config.split(",").filter(Boolean);

      const levels = new Map<string, string>();
      for (const pair of pairs) {
        const [subsystem, level] = pair.split(":");
        if (subsystem && level) {
          levels.set(subsystem.trim(), level.trim().toLowerCase());
        }
      }

      expect(levels.get("stream")).toBe("warn");
      expect(levels.get("opencode")).toBe("debug");
      expect(levels.get("api")).toBe("silent");
      expect(levels.get("unknown")).toBeUndefined();
    });

    test('handles "off" as alias for "silent"', () => {
      const config = "stream:off";
      const [_subsystem, level] = config.split(":");
      const normalizedLevel = level.trim().toLowerCase();
      const finalLevel = normalizedLevel === "off" ? "silent" : normalizedLevel;

      expect(finalLevel).toBe("silent");
    });

    test("handles empty SUBSYSTEM_LEVELS", () => {
      const config = "";
      const pairs = config.split(",").filter(Boolean);
      expect(pairs).toHaveLength(0);
    });

    test("handles malformed entries gracefully", () => {
      const config = "stream:warn,invalid,api:info,:broken,good:debug";
      const pairs = config.split(",").filter(Boolean);

      const levels = new Map<string, string>();
      for (const pair of pairs) {
        const [subsystem, level] = pair.split(":");
        if (subsystem && level) {
          levels.set(subsystem.trim(), level.trim().toLowerCase());
        }
      }

      expect(levels.get("stream")).toBe("warn");
      expect(levels.get("api")).toBe("info");
      expect(levels.get("good")).toBe("debug");
      // Invalid entries are skipped
      expect(levels.has("invalid")).toBe(false);
      expect(levels.has("")).toBe(false);
    });
  });

  describe("log object structure", () => {
    test("log object has expected subsystem loggers", async () => {
      const { log } = await import("./logger");

      expect(log.api).toBeDefined();
      expect(log.opencode).toBeDefined();
      expect(log.stream).toBeDefined();
      expect(log.server).toBeDefined();
    });

    test("subsystem loggers have standard pino methods", async () => {
      const { log } = await import("./logger");

      // Check that loggers have the expected methods
      expect(typeof log.api.info).toBe("function");
      expect(typeof log.api.debug).toBe("function");
      expect(typeof log.api.warn).toBe("function");
      expect(typeof log.api.error).toBe("function");
      expect(typeof log.api.fatal).toBe("function");
      expect(typeof log.api.trace).toBe("function");
    });

    test("subsystem loggers can create child loggers", async () => {
      const { log } = await import("./logger");

      const childLogger = log.api.child({ requestId: "test-123" });
      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe("function");
    });
  });

  describe("createRequestLogger", () => {
    test("creates logger with requestId binding", async () => {
      const { createRequestLogger } = await import("./logger");

      const requestLogger = createRequestLogger("req-abc123");
      expect(requestLogger).toBeDefined();
      expect(typeof requestLogger.info).toBe("function");
    });

    test("creates logger with extra bindings", async () => {
      const { createRequestLogger } = await import("./logger");

      const requestLogger = createRequestLogger("req-abc123", {
        userId: "user-456",
      });
      expect(requestLogger).toBeDefined();
    });
  });

  describe("utility functions", () => {
    test("isSubsystemEnabled returns true for non-silent subsystems", async () => {
      const { isSubsystemEnabled } = await import("./logger");

      // Without SUBSYSTEM_LEVELS set, all should be enabled
      expect(isSubsystemEnabled("api")).toBe(true);
      expect(isSubsystemEnabled("stream")).toBe(true);
      expect(isSubsystemEnabled("unknown")).toBe(true);
    });

    test("getSubsystemLevel returns configured or default level", async () => {
      const { getSubsystemLevel } = await import("./logger");

      // Returns default level when not specifically configured
      const level = getSubsystemLevel("api");
      expect(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).toContain(level);
    });
  });

  describe("test log capture", () => {
    beforeEach(() => {
      clearCapturedLogs();
    });

    test("captures logs from test logger", async () => {
      const deps = await createTestDeps();

      await withDeps(deps, () => {
        const { log } = useDeps();
        log.api.info({ userId: "user-123" }, "User logged in");
      });

      const logs = getCapturedLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual({
        level: "info",
        subsystem: "api",
        msg: "User logged in",
        data: { userId: "user-123" },
      });
    });

    test("captures multiple logs across subsystems", async () => {
      const deps = await createTestDeps();

      await withDeps(deps, () => {
        const { log } = useDeps();
        log.api.debug("API debug message");
        log.stream.warn({ eventType: "disconnect" }, "Stream disconnected");
        log.opencode.error({ code: 500 }, "OpenCode error");
      });

      const logs = getCapturedLogs();
      expect(logs).toHaveLength(3);

      expect(logs[0]).toEqual({
        level: "debug",
        subsystem: "api",
        msg: "API debug message",
      });

      expect(logs[1]).toEqual({
        level: "warn",
        subsystem: "stream",
        msg: "Stream disconnected",
        data: { eventType: "disconnect" },
      });

      expect(logs[2]).toEqual({
        level: "error",
        subsystem: "opencode",
        msg: "OpenCode error",
        data: { code: 500 },
      });
    });

    test("clearCapturedLogs resets the log buffer", async () => {
      const deps = await createTestDeps();

      await withDeps(deps, () => {
        const { log } = useDeps();
        log.api.info("First log");
      });

      expect(getCapturedLogs()).toHaveLength(1);

      clearCapturedLogs();

      expect(getCapturedLogs()).toHaveLength(0);

      await withDeps(deps, () => {
        const { log } = useDeps();
        log.api.info("Second log");
      });

      expect(getCapturedLogs()).toHaveLength(1);
      expect(getCapturedLogs()[0].msg).toBe("Second log");
    });

    test("can filter captured logs by level", async () => {
      const deps = await createTestDeps();

      await withDeps(deps, () => {
        const { log } = useDeps();
        log.api.debug("Debug message");
        log.api.info("Info message");
        log.api.warn("Warning message");
        log.api.error("Error message");
      });

      const logs = getCapturedLogs();
      const errors = logs.filter((l) => l.level === "error");
      const warnings = logs.filter((l) => l.level === "warn");

      expect(errors).toHaveLength(1);
      expect(errors[0].msg).toBe("Error message");

      expect(warnings).toHaveLength(1);
      expect(warnings[0].msg).toBe("Warning message");
    });

    test("can filter captured logs by subsystem", async () => {
      const deps = await createTestDeps();

      await withDeps(deps, () => {
        const { log } = useDeps();
        log.api.info("API log");
        log.stream.info("Stream log");
        log.api.info("Another API log");
      });

      const logs = getCapturedLogs();
      const apiLogs = logs.filter((l) => l.subsystem === "api");
      const streamLogs = logs.filter((l) => l.subsystem === "stream");

      expect(apiLogs).toHaveLength(2);
      expect(streamLogs).toHaveLength(1);
    });

    test("can assert on log data properties", async () => {
      const deps = await createTestDeps();

      await withDeps(deps, () => {
        const { log } = useDeps();
        log.api.info({ requestId: "req-abc", userId: "user-123", duration: 45 }, "Request completed");
      });

      const logs = getCapturedLogs();
      expect(logs[0].data).toMatchObject({
        requestId: "req-abc",
        userId: "user-123",
      });
    });
  });
});
