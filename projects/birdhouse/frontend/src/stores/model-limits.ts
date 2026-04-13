// ABOUTME: Model context limits cache fetched from backend API
// ABOUTME: Provides dynamic lookup of model context limits - no fallbacks, fails if data unavailable

import { API_ENDPOINT_BASE } from "../config/api";

interface Model {
  id: string;
  name: string;
  provider: string;
  contextLimit: number;
  outputLimit: number;
}

/**
 * In-memory cache of model context limits
 */
const modelLimitsCache = new Map<string, number>();

/**
 * Fetch model limits from backend API and populate cache
 * @param workspaceId Workspace ID to fetch models for
 */
export async function fetchModelLimits(workspaceId: string): Promise<void> {
  const response = await fetch(`${API_ENDPOINT_BASE}/workspace/${workspaceId}/models`);

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const models: Model[] = await response.json();

  modelLimitsCache.clear();
  for (const model of models) {
    // Store by full "provider/model" ID
    modelLimitsCache.set(model.id, model.contextLimit);
    // Also store by bare model name so lookups with just the model ID work
    // (message.modelID from opencode is the bare name, not the full provider/model ID)
    if (model.id.includes("/")) {
      const bareName = model.id.split("/")[1];
      if (bareName) {
        modelLimitsCache.set(bareName, model.contextLimit);
      }
    }
  }
}

/**
 * Get context limit for a model
 * Returns undefined if model not found in cache
 *
 * @param modelId Model identifier (can be "provider/model" or just "model")
 * @returns Context limit in tokens, or undefined if not found
 */
export function getModelLimit(modelId: string): number | undefined {
  return modelLimitsCache.get(modelId);
}

/**
 * Clear the model limits cache (for testing)
 */
export function clearModelLimitsCache(): void {
  modelLimitsCache.clear();
}
