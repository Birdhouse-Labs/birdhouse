// ABOUTME: Model validation helper - validates model IDs and provides helpful error messages
// ABOUTME: Uses deps.harness.getProviders for testability

import type { Deps } from "../dependencies";

/**
 * Parse a model ID string into providerID and modelID parts
 * Splits on the first "/" only — modelID may contain further slashes
 *
 * @param model - Model string e.g. "anthropic/claude-sonnet-4" or "fireworks-ai/accounts/fireworks/models/kimi-k2p5"
 * @throws Error if either part is empty or the separator is missing
 */
export function parseModelId(model: string): { providerID: string; modelID: string } {
  const slashIndex = model.indexOf("/");
  if (slashIndex === -1) {
    throw new Error(`Invalid model format: "${model}" — expected "providerID/modelID"`);
  }
  const providerID = model.slice(0, slashIndex);
  const modelID = model.slice(slashIndex + 1);
  if (!providerID || !modelID) {
    throw new Error(`Invalid model format: "${model}" — providerID and modelID must both be non-empty`);
  }
  return { providerID, modelID };
}

/**
 * Validate model ID and return error message if invalid
 * Returns null if model is valid
 *
 * @param modelId - Model ID to validate (e.g., 'anthropic/claude-sonnet-4')
 * @param harness - Agent harness from deps (for testing)
 */
export async function validateModel(
  modelId: string,
  harness: Pick<Deps["harness"], "getProviders">,
): Promise<string | null> {
  try {
    const { providers } = await harness.getProviders();

    // Build list of available models
    const availableModels: string[] = [];
    for (const provider of providers) {
      for (const modelKey of Object.keys(provider.models)) {
        availableModels.push(`${provider.id}/${modelKey}`);
      }
    }

    if (!availableModels.includes(modelId)) {
      const modelList = availableModels.map((m) => `  - ${m}`).join("\n");

      return `Invalid model: ${modelId}

Available models:
${modelList}`;
    }

    return null;
  } catch (error) {
    // If we can't fetch models, don't block creation
    // Log error but allow through
    console.error("Failed to validate model:", error);
    return null;
  }
}
