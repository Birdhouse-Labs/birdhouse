// ABOUTME: Tests for model validation helper
// ABOUTME: Mocks OpenCode client via deps to test validation logic

import { describe, expect, test } from "bun:test";
import { validateModel } from "./model-validator";

describe("Model Validator", () => {
  test("returns null for valid model", async () => {
    const mockOpenCode = {
      getProviders: async () => ({
        providers: [
          {
            id: "anthropic",
            name: "Anthropic",
            models: {
              "claude-sonnet-4": {
                id: "claude-sonnet-4",
                name: "Claude Sonnet 4",
              },
              "claude-haiku-4": {
                id: "claude-haiku-4",
                name: "Claude Haiku 4",
              },
            },
          },
        ],
      }),
    };

    const error = await validateModel("anthropic/claude-sonnet-4", mockOpenCode);
    expect(error).toBeNull();
  });

  test("returns error message for invalid model", async () => {
    const mockOpenCode = {
      getProviders: async () => ({
        providers: [
          {
            id: "anthropic",
            name: "Anthropic",
            models: {
              "claude-sonnet-4": {
                id: "claude-sonnet-4",
                name: "Claude Sonnet 4",
              },
            },
          },
        ],
      }),
    };

    const error = await validateModel("anthropic/claude-invalid-9000", mockOpenCode);

    expect(error).not.toBeNull();
    expect(error).toContain("Invalid model: anthropic/claude-invalid-9000");
    expect(error).toContain("Available models:");
    expect(error).toContain("anthropic/claude-sonnet-4");
  });

  test("returns null when fetch fails (graceful degradation)", async () => {
    const mockOpenCode = {
      getProviders: async () => {
        throw new Error("Network error");
      },
    };

    const error = await validateModel("any-model", mockOpenCode);

    // Should allow through when validation fails
    expect(error).toBeNull();
  });

  test("formats model list with proper indentation", async () => {
    const mockOpenCode = {
      getProviders: async () => ({
        providers: [
          {
            id: "anthropic",
            name: "Anthropic",
            models: {
              "claude-sonnet-4": {
                id: "claude-sonnet-4",
                name: "Claude Sonnet 4",
              },
            },
          },
          {
            id: "openai",
            name: "OpenAI",
            models: {
              "gpt-4": { id: "gpt-4", name: "GPT-4" },
            },
          },
        ] as import("../../src/lib/opencode-client").Provider[],
      }),
    };

    const error = await validateModel("invalid/model", mockOpenCode);

    expect(error).toContain("  - anthropic/claude-sonnet-4");
    expect(error).toContain("  - openai/gpt-4");
  });

  test("handles empty model list", async () => {
    const mockOpenCode = {
      getProviders: async () => ({
        providers: [],
      }),
    };

    const error = await validateModel("any-model", mockOpenCode);

    expect(error).not.toBeNull();
    expect(error).toContain("Invalid model: any-model");
    expect(error).toContain("Available models:");
  });
});
