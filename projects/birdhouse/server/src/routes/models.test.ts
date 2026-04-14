// ABOUTME: Unit tests for model routes.
// ABOUTME: Tests that the models endpoint reshapes harness provider data correctly.

import { describe, expect, test } from "bun:test";
import { createTestDeps, withDeps } from "../dependencies";
import { withWorkspaceContext } from "../test-utils";
import { createModelRoutes } from "./models";

describe("GET /api/models", () => {
  test("should extract contextLimit from harness provider response", async () => {
    const mockProviders = {
      providers: [
        {
          id: "anthropic",
          name: "Anthropic",
          models: {
            "claude-sonnet-4-5": {
              id: "claude-sonnet-4-5",
              name: "Claude Sonnet 4.5",
              limit: {
                context: 200000,
                output: 64000,
              },
            },
            "claude-opus-4-5": {
              id: "claude-opus-4-5",
              name: "Claude Opus 4.5",
              limit: {
                context: 200000,
                output: 64000,
              },
            },
          },
        },
      ],
    };

    const deps = await createTestDeps();
    deps.harness.getProviders = async () => mockProviders as never;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createModelRoutes);
      const req = new Request("http://localhost/");
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const models = (await res.json()) as Array<{
        id: string;
        name: string;
        provider: string;
        contextLimit: number;
        outputLimit: number;
      }>;
      expect(models).toHaveLength(2);

      expect(models[0]).toEqual({
        id: "anthropic/claude-sonnet-4-5",
        name: "Claude Sonnet 4.5",
        provider: "Anthropic",
        contextLimit: 200000,
        outputLimit: 64000,
      });

      expect(models[1]).toEqual({
        id: "anthropic/claude-opus-4-5",
        name: "Claude Opus 4.5",
        provider: "Anthropic",
        contextLimit: 200000,
        outputLimit: 64000,
      });
    });
  });

  test("should use contextLimit of 0 when limit is missing (unknown limit)", async () => {
    // Models without a limit from opencode get contextLimit=0, meaning unknown.
    // The frontend hides the context indicator when limit=0.
    const mockProviders = {
      providers: [
        {
          id: "custom-provider",
          name: "Custom Provider",
          models: {
            "custom-model": {
              id: "custom-model",
              name: "Custom Model",
            },
          },
        },
      ],
    };

    const deps = await createTestDeps();
    deps.harness.getProviders = async () => mockProviders as never;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createModelRoutes);
      const req = new Request("http://localhost/");
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const models = (await res.json()) as Array<{
        id: string;
        name: string;
        provider: string;
        contextLimit: number;
        outputLimit: number;
      }>;
      expect(models).toHaveLength(1);

      expect(models[0]).toEqual({
        id: "custom-provider/custom-model",
        name: "Custom Model",
        provider: "Custom Provider",
        contextLimit: 0,
        outputLimit: 0,
      });
    });
  });

  test("should use contextLimit of 0 when opencode reports limit.context=0 (unknown limit)", async () => {
    // opencode returns limit.context=0 for models it has no context data for.
    // We treat this the same as missing — 0 means unknown, not actually 0 tokens.
    const mockProviders = {
      providers: [
        {
          id: "some-provider",
          name: "Some Provider",
          models: {
            "some-model": {
              id: "some-model",
              name: "Some Model",
              limit: { context: 0, output: 0 },
            },
          },
        },
      ],
    };

    const deps = await createTestDeps();
    deps.harness.getProviders = async () => mockProviders as never;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createModelRoutes);
      const req = new Request("http://localhost/");
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const models = (await res.json()) as Array<{ contextLimit: number }>;
      expect(models[0].contextLimit).toBe(0);
    });
  });

  test("should handle multiple providers with different context limits", async () => {
    const mockProviders = {
      providers: [
        {
          id: "anthropic",
          name: "Anthropic",
          models: {
            "claude-sonnet-4-5": {
              id: "claude-sonnet-4-5",
              name: "Claude Sonnet 4.5",
              limit: { context: 1_000_000, output: 64000 },
            },
          },
        },
        {
          id: "openai",
          name: "OpenAI",
          models: {
            "gpt-4": {
              id: "gpt-4",
              name: "GPT-4",
              limit: { context: 128_000, output: 4096 },
            },
          },
        },
      ],
    };

    const deps = await createTestDeps();
    deps.harness.getProviders = async () => mockProviders as never;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createModelRoutes);
      const req = new Request("http://localhost/");
      const res = await app.fetch(req);

      expect(res.status).toBe(200);

      const models = (await res.json()) as Array<{
        id: string;
        name: string;
        provider: string;
        contextLimit: number;
        outputLimit: number;
      }>;
      expect(models).toHaveLength(2);

      expect(models[0].contextLimit).toBe(1_000_000);
      expect(models[0].outputLimit).toBe(64000);
      expect(models[1].contextLimit).toBe(128_000);
      expect(models[1].outputLimit).toBe(4096);
    });
  });

  test("should handle harness provider errors gracefully", async () => {
    const deps = await createTestDeps();
    deps.harness.getProviders = async () => {
      throw new Error("Provider lookup failed");
    };

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createModelRoutes);
      const req = new Request("http://localhost/");
      const res = await app.fetch(req);

      expect(res.status).toBe(500);

      const error = (await res.json()) as { error: string };
      expect(error).toHaveProperty("error");
      expect(error.error).toBe("Provider lookup failed");
    });
  });
});
