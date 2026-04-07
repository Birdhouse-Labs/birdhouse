// ABOUTME: Tests for model validation helper
// ABOUTME: Mocks OpenCode client via deps to test validation logic

import { describe, expect, test } from "bun:test";
import type { BirdhouseProvidersResponse } from "../harness";
import { parseModelId, validateModel } from "./model-validator";

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
    const providers: BirdhouseProvidersResponse = {
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
      ],
    };

    const mockOpenCode = {
      getProviders: async () => providers,
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

describe("parseModelId", () => {
  test("splits simple provider/model correctly", () => {
    const result = parseModelId("anthropic/claude-sonnet-4");
    expect(result.providerID).toBe("anthropic");
    expect(result.modelID).toBe("claude-sonnet-4");
  });

  test("multi-segment model ID - providerID is before first slash, modelID is the rest", () => {
    const result = parseModelId("fireworks-ai/accounts/fireworks/models/kimi-k2p5");
    expect(result.providerID).toBe("fireworks-ai");
    expect(result.modelID).toBe("accounts/fireworks/models/kimi-k2p5");
  });

  test("throws on missing slash", () => {
    expect(() => parseModelId("noslash")).toThrow();
  });

  test("throws on empty string", () => {
    expect(() => parseModelId("")).toThrow();
  });
});
