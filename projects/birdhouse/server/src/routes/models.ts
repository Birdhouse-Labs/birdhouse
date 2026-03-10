// ABOUTME: Model routes for fetching available AI models
// ABOUTME: Proxies requests to OpenCode's provider endpoints and transforms responses

import { Hono } from "hono";
import "../types/context";

interface Provider {
  id: string;
  name: string;
  models: Record<string, { id: string; name: string; limit?: { context: number; output: number } }>;
}

interface Model {
  id: string;
  name: string;
  provider: string;
  contextLimit: number;
  outputLimit: number;
}

// Flagship and small/fast models pinned to the top of the model list, in display order.
// These are the models users are most likely to reach for in March 2026.
const PINNED_MODEL_IDS: string[] = [
  // Anthropic — flagship
  "anthropic/claude-opus-4-6",
  "anthropic/claude-sonnet-4-6",
  // Anthropic — small/fast
  "anthropic/claude-haiku-4-5",
  // OpenAI — flagship GPT
  "openai/gpt-5.4",
  "openai/gpt-5.4-pro",
  // OpenAI — reasoning
  "openai/o3",
  "openai/o4-mini",
  // Google — flagship
  "google/gemini-3.1-pro-preview",
  "google/gemini-2.5-pro",
  // Google — small/fast
  "google/gemini-2.5-flash",
];

// Provider priority for models that aren't pinned (lower = higher priority)
const PROVIDER_PRIORITY: Record<string, number> = { anthropic: 0, openai: 1, google: 2 };
const getProviderPriority = (id: string) => PROVIDER_PRIORITY[id] ?? 3;

export function createModelRoutes() {
  const app = new Hono();

  // GET /api/models - Get list of available models
  app.get("/", async (c) => {
    try {
      const opencodeBase = c.get("opencodeBase");
      // Fetch providers from OpenCode
      const response = await fetch(`${opencodeBase}/config/providers`);

      if (!response.ok) {
        throw new Error(`Model provider API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { providers: Provider[] };
      const providers: Provider[] = data.providers || [];

      // Transform to simple model list
      const models: Model[] = [];
      for (const provider of providers) {
        for (const [modelId, modelInfo] of Object.entries(provider.models)) {
          models.push({
            id: `${provider.id}/${modelId}`,
            name: modelInfo.name || modelId,
            provider: provider.name || provider.id,
            contextLimit: modelInfo.limit?.context ?? 200_000,
            outputLimit: modelInfo.limit?.output ?? 0,
          });
        }
      }

      // Sort: pinned models first (in defined order), then by provider priority
      const pinnedIndex = (id: string) => {
        const i = PINNED_MODEL_IDS.indexOf(id);
        return i === -1 ? Infinity : i;
      };
      models.sort((a, b) => {
        const aPinned = pinnedIndex(a.id);
        const bPinned = pinnedIndex(b.id);
        if (aPinned !== bPinned) return aPinned - bPinned;
        // Both unpinned: sort by provider priority
        return getProviderPriority(a.id.split("/")[0]) - getProviderPriority(b.id.split("/")[0]);
      });

      return c.json(models);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  return app;
}
