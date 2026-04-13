// ABOUTME: Model routes for fetching available AI models.
// ABOUTME: Reads provider/model data through the harness and reshapes it for the frontend.

import { Hono } from "hono";
import { getDefaultHarness } from "../dependencies";
import { getDepsFromContext } from "../lib/context-deps";
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
      const harness = getDefaultHarness(getDepsFromContext(c));
      const data = (await harness.getProviders()) as { providers: Provider[] };
      const providers: Provider[] = data.providers || [];

      // Transform to simple model list
      const models: Model[] = [];
      for (const provider of providers) {
        for (const [modelId, modelInfo] of Object.entries(provider.models)) {
          // Use opencode's limit when present and non-zero.
          // A context of 0 means opencode has no limit data for this model.
          const contextLimit =
            modelInfo.limit?.context != null && modelInfo.limit.context > 0 ? modelInfo.limit.context : 0;
          models.push({
            id: `${provider.id}/${modelId}`,
            name: modelInfo.name || modelId,
            provider: provider.name || provider.id,
            contextLimit,
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
