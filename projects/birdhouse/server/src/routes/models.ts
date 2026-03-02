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

      return c.json(models);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  return app;
}
