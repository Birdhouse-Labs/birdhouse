// ABOUTME: Unit tests for model routes
// ABOUTME: Tests that models endpoint correctly extracts context limits from OpenCode API

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { withWorkspaceContext } from "../test-utils";
import { createModelRoutes } from "./models";

describe("GET /api/models", () => {
  let originalFetch: typeof global.fetch;
  let originalOpencodeBase: string | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalOpencodeBase = process.env.BIRDHOUSE_OPENCODE_BASE;
    process.env.BIRDHOUSE_OPENCODE_BASE = "http://127.0.0.1:99999"; // Set for tests
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.BIRDHOUSE_OPENCODE_BASE = originalOpencodeBase;
  });

  test("should extract contextLimit from OpenCode API response", async () => {
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

    global.fetch = (async (url: string | URL | Request) => {
      if (url.toString().includes("/config/providers")) {
        return new Response(JSON.stringify(mockProviders), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    }) as typeof global.fetch;

    const app = withWorkspaceContext(createModelRoutes);
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

  test("should use default contextLimit of 200_000 when limit is missing", async () => {
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

    global.fetch = (async (url: string | URL | Request) => {
      if (url.toString().includes("/config/providers")) {
        return new Response(JSON.stringify(mockProviders), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    }) as typeof global.fetch;

    const app = withWorkspaceContext(createModelRoutes);
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
      contextLimit: 200_000,
      outputLimit: 0,
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

    global.fetch = (async (url: string | URL | Request) => {
      if (url.toString().includes("/config/providers")) {
        return new Response(JSON.stringify(mockProviders), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    }) as typeof global.fetch;

    const app = withWorkspaceContext(createModelRoutes);
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

  test("should handle OpenCode API errors gracefully", async () => {
    global.fetch = (async (_url: string | URL | Request) => {
      return new Response("Internal Server Error", { status: 500 });
    }) as typeof global.fetch;

    const app = withWorkspaceContext(createModelRoutes);
    const req = new Request("http://localhost/");
    const res = await app.fetch(req);

    expect(res.status).toBe(500);

    const error = await res.json();
    expect(error).toHaveProperty("error");
  });
});
