// ABOUTME: Tests for LogViewer pure logic
// ABOUTME: Covers timestamp formatting and log line filtering — both are pure functions worth testing

import { describe, expect, it } from "vitest";
import type { LogLine } from "../types/workspace";
import { filterLines, formatTime } from "./LogViewer";

const makeLine = (overrides: Partial<LogLine> = {}): LogLine => ({
  time: "2026-03-23T10:30:45.000Z",
  level: "info",
  subsystem: "server",
  msg: "Server started",
  raw: '{"level":"info","msg":"Server started"}',
  source: "birdhouse",
  ...overrides,
});

describe("formatTime", () => {
  it("returns an HH:MM:SS formatted string", () => {
    // Use the current time to get the expected local value
    const isoTime = "2026-03-23T10:30:45.000Z";
    const result = formatTime(isoTime);
    // Should be 8 chars in HH:MM:SS format
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("returns something for an invalid timestamp rather than crashing", () => {
    expect(() => formatTime("not-a-date")).not.toThrow();
  });
});

describe("filterLines", () => {
  const lines = [
    makeLine({ msg: "Server started", raw: '{"msg":"Server started"}', source: "birdhouse" }),
    makeLine({ msg: "Connection error", raw: '{"msg":"Connection error"}', source: "birdhouse" }),
    makeLine({ msg: "OpenCode ready", raw: '{"msg":"OpenCode ready"}', source: "opencode" }),
    makeLine({ msg: "Hidden in raw", raw: '{"secret":"needle_xyz"}', source: "birdhouse" }),
  ];

  describe("search", () => {
    it("returns all lines when search is empty", () => {
      expect(filterLines(lines, "", "all")).toHaveLength(4);
    });

    it("filters by msg text (case-insensitive)", () => {
      const result = filterLines(lines, "ERROR", "all");
      expect(result).toHaveLength(1);
      expect(result[0]!.msg).toBe("Connection error");
    });

    it("filters by raw field text", () => {
      const result = filterLines(lines, "needle_xyz", "all");
      expect(result).toHaveLength(1);
      expect(result[0]!.msg).toBe("Hidden in raw");
    });

    it("returns empty array when nothing matches", () => {
      expect(filterLines(lines, "zzznomatch", "all")).toHaveLength(0);
    });
  });

  describe("source filter", () => {
    it("returns all lines when source is 'all'", () => {
      expect(filterLines(lines, "", "all")).toHaveLength(4);
    });

    it("filters to birdhouse lines only", () => {
      const result = filterLines(lines, "", "birdhouse");
      expect(result.every((l) => l.source === "birdhouse")).toBe(true);
      expect(result).toHaveLength(3);
    });

    it("filters to opencode lines only", () => {
      const result = filterLines(lines, "", "opencode");
      expect(result.every((l) => l.source === "opencode")).toBe(true);
      expect(result).toHaveLength(1);
    });
  });

  describe("combined search + source filter", () => {
    it("applies both search and source filter together", () => {
      const result = filterLines(lines, "started", "opencode");
      expect(result).toHaveLength(0);
    });

    it("matches birdhouse line by search", () => {
      const result = filterLines(lines, "started", "birdhouse");
      expect(result).toHaveLength(1);
      expect(result[0]!.msg).toBe("Server started");
    });
  });
});
