// ABOUTME: Tests for the frontend browser logger
// ABOUTME: Verifies error serialization and log entry structure

import { describe, expect, test } from "vitest";
import { type SerializedError, serializeError } from "./logger";

describe("serializeError", () => {
  test("serializes Error with name, message, and stack", () => {
    const err = new Error("Something went wrong");
    const serialized = serializeError(err);

    expect(serialized).toBeDefined();
    expect(serialized?.name).toBe("Error");
    expect(serialized?.message).toBe("Something went wrong");
    expect(serialized?.stack).toBeDefined();
    expect(serialized?.stack).toContain("Error: Something went wrong");
  });

  test("serializes TypeError with correct name", () => {
    const err = new TypeError("Invalid type");
    const serialized = serializeError(err);

    expect(serialized?.name).toBe("TypeError");
    expect(serialized?.message).toBe("Invalid type");
    expect(serialized?.stack).toBeDefined();
  });

  test("serializes custom error classes", () => {
    class ApiError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "ApiError";
      }
    }

    const err = new ApiError("Request failed");
    const serialized = serializeError(err);

    expect(serialized?.name).toBe("ApiError");
    expect(serialized?.message).toBe("Request failed");
  });

  test("handles thrown strings", () => {
    const serialized = serializeError("string error");

    expect(serialized?.name).toBe("Error");
    expect(serialized?.message).toBe("string error");
    expect(serialized?.stack).toBeUndefined();
  });

  test("handles thrown numbers", () => {
    const serialized = serializeError(42);

    expect(serialized?.name).toBe("Error");
    expect(serialized?.message).toBe("42");
  });

  test("handles thrown objects", () => {
    const serialized = serializeError({ code: 500, reason: "Server error" });

    expect(serialized?.name).toBe("Error");
    expect(serialized?.message).toBe("[object Object]");
  });

  test("returns undefined for null", () => {
    const serialized = serializeError(null);
    expect(serialized).toBeUndefined();
  });

  test("returns undefined for undefined", () => {
    const serialized = serializeError(undefined);
    expect(serialized).toBeUndefined();
  });

  test("stack trace includes file location", () => {
    const err = new Error("Test error");
    const serialized = serializeError(err);

    // Stack should contain the test file name
    expect(serialized?.stack).toContain("logger.test.ts");
  });
});

describe("SerializedError type", () => {
  test("type matches expected structure", () => {
    const serialized: SerializedError = {
      name: "Error",
      message: "test",
      stack: "Error: test\n    at ...",
    };

    expect(serialized.name).toBe("Error");
    expect(serialized.message).toBe("test");
    expect(serialized.stack).toBeDefined();
  });

  test("stack is optional", () => {
    const serialized: SerializedError = {
      name: "Error",
      message: "test",
    };

    expect(serialized.stack).toBeUndefined();
  });
});
