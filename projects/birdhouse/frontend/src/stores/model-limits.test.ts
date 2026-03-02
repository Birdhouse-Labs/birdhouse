// ABOUTME: Tests for model-limits store
// ABOUTME: Validates fetching and caching behavior for model context limits

import { beforeEach, describe, expect, test, vi } from "vitest";
import { fetchModelLimits, getModelLimit } from "./model-limits";

describe("model-limits store", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch");
  });

  describe("fetchModelLimits", () => {
    const TEST_WORKSPACE_ID = "test-workspace-123";

    test("should fetch and cache model limits from API", async () => {
      const mockModels = [
        {
          id: "anthropic/claude-sonnet-4-5",
          name: "Claude Sonnet 4.5",
          provider: "Anthropic",
          contextLimit: 200_000,
          outputLimit: 64_000,
        },
        { id: "openai/gpt-4", name: "GPT-4", provider: "OpenAI", contextLimit: 128_000, outputLimit: 4096 },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockModels,
      } as Response);

      await fetchModelLimits(TEST_WORKSPACE_ID);

      expect(getModelLimit("anthropic/claude-sonnet-4-5")).toBe(200_000);
      expect(getModelLimit("openai/gpt-4")).toBe(128_000);
    });

    test("should throw on API errors", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
      } as Response);

      await expect(fetchModelLimits(TEST_WORKSPACE_ID)).rejects.toThrow(
        "Failed to fetch models: Internal Server Error",
      );
    });

    test("should throw on network errors", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      await expect(fetchModelLimits(TEST_WORKSPACE_ID)).rejects.toThrow("Network error");
    });
  });

  describe("getModelLimit", () => {
    const TEST_WORKSPACE_ID = "test-workspace-123";

    test("should return cached limit after fetch", async () => {
      const mockModels = [
        {
          id: "anthropic/claude-sonnet-4-5",
          name: "Claude Sonnet 4.5",
          provider: "Anthropic",
          contextLimit: 200_000,
          outputLimit: 64_000,
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockModels,
      } as Response);

      await fetchModelLimits(TEST_WORKSPACE_ID);

      expect(getModelLimit("anthropic/claude-sonnet-4-5")).toBe(200_000);
    });

    test("should lookup by model name when given provider/model format", async () => {
      const mockModels = [
        {
          id: "anthropic/claude-sonnet-4-5",
          name: "Claude Sonnet 4.5",
          provider: "Anthropic",
          contextLimit: 200_000,
          outputLimit: 64_000,
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockModels,
      } as Response);

      await fetchModelLimits(TEST_WORKSPACE_ID);

      // Should find by full ID
      expect(getModelLimit("anthropic/claude-sonnet-4-5")).toBe(200_000);
    });

    test("should return undefined for unknown models", async () => {
      const mockModels = [
        {
          id: "anthropic/claude-sonnet-4-5",
          name: "Claude Sonnet 4.5",
          provider: "Anthropic",
          contextLimit: 200_000,
          outputLimit: 64_000,
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockModels,
      } as Response);

      await fetchModelLimits(TEST_WORKSPACE_ID);

      expect(getModelLimit("unknown-model")).toBeUndefined();
    });

    test("should return undefined before fetchModelLimits is called", () => {
      expect(getModelLimit("claude-sonnet-4-5")).toBeUndefined();
      expect(getModelLimit("unknown-model")).toBeUndefined();
    });
  });
});
