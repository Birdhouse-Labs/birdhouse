// ABOUTME: Model validation helper - validates model IDs and provides helpful error messages
// ABOUTME: Uses deps.opencode.getProviders for testability

import type { Deps } from "../dependencies";

/**
 * Validate model ID and return error message if invalid
 * Returns null if model is valid
 *
 * @param modelId - Model ID to validate (e.g., 'anthropic/claude-sonnet-4')
 * @param opencode - OpenCode client from deps (for testing)
 */
export async function validateModel(
  modelId: string,
  opencode: Pick<Deps["opencode"], "getProviders">,
): Promise<string | null> {
  try {
    const { providers } = await opencode.getProviders();

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
