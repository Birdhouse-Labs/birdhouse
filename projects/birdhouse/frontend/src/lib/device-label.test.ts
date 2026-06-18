// ABOUTME: Tests for UA-based device label formatting
// ABOUTME: Covers mobile, desktop, and fallback cases

import { describe, expect, test } from "vitest";
import { formatDeviceLabel } from "./device-label";

describe("formatDeviceLabel", () => {
  test("returns 'Unknown device' for null", () => {
    expect(formatDeviceLabel(null)).toBe("Unknown device");
  });

  test("returns 'Unknown device' for undefined", () => {
    expect(formatDeviceLabel(undefined)).toBe("Unknown device");
  });

  test("returns 'Unknown device' for empty string", () => {
    expect(formatDeviceLabel("")).toBe("Unknown device");
  });

  test("formats iPhone UA — shows device vendor+model and browser", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const label = formatDeviceLabel(ua);
    expect(label).toContain("Safari");
    // Mobile devices should include some device identifier
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toBe("Unknown device");
  });

  test("formats Mac Chrome UA — shows OS and browser", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    const label = formatDeviceLabel(ua);
    expect(label).toContain("Chrome");
    expect(label).toContain("macOS");
    expect(label).not.toBe("Unknown device");
  });

  test("formats Windows Edge UA — shows OS and browser", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0";
    const label = formatDeviceLabel(ua);
    expect(label).toContain("Windows");
    expect(label).not.toBe("Unknown device");
  });

  test("formats Android UA — shows OS or device and browser", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
    const label = formatDeviceLabel(ua);
    expect(label).not.toBe("Unknown device");
    expect(label.length).toBeGreaterThan(0);
  });

  test("uses ' · ' as separator between parts", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    const label = formatDeviceLabel(ua);
    expect(label).toContain(" · ");
  });

  test("handles completely unrecognized UA string gracefully", () => {
    const label = formatDeviceLabel("SomeUnknownBot/1.0");
    // Should not throw and should return some string
    expect(typeof label).toBe("string");
    expect(label.length).toBeGreaterThan(0);
  });
});
