// ABOUTME: Provider metadata and registry for AI model providers
// ABOUTME: Defines supported providers and coming soon list

/**
 * Metadata for an AI model provider
 */
export interface ProviderMetadata {
  id: string; // "anthropic", "openai", etc.
  label: string; // "Anthropic", "OpenAI", etc.
  docUrl?: string; // Link to get API key
}

/**
 * List of supported AI model providers
 */
export const PROVIDERS: ProviderMetadata[] = [
  { id: "anthropic", label: "Anthropic", docUrl: "https://console.anthropic.com/" },
  { id: "openai", label: "OpenAI", docUrl: "https://platform.openai.com/api-keys" },
  { id: "google", label: "Google AI", docUrl: "https://makersuite.google.com/app/apikey" },
  { id: "openrouter", label: "OpenRouter", docUrl: "https://openrouter.ai/keys" },
  { id: "groq", label: "Groq", docUrl: "https://console.groq.com/keys" },
  { id: "perplexity", label: "Perplexity", docUrl: "https://www.perplexity.ai/settings/api" },
  { id: "xai", label: "xAI", docUrl: "https://console.x.ai/" },
  { id: "mistral", label: "Mistral", docUrl: "https://console.mistral.ai/" },
  { id: "cohere", label: "Cohere", docUrl: "https://dashboard.cohere.com/api-keys" },
  { id: "deepinfra", label: "DeepInfra", docUrl: "https://deepinfra.com/dash/api_keys" },
  { id: "cerebras", label: "Cerebras", docUrl: "https://cloud.cerebras.ai/api-keys" },
  { id: "together", label: "Together AI", docUrl: "https://api.together.xyz/settings/api-keys" },
];

/**
 * Providers coming in future releases
 */
export const COMING_SOON_PROVIDERS = [
  "AWS Bedrock",
  "Azure OpenAI",
  "Google Vertex AI",
  "GitHub Copilot",
  "Cloudflare AI Gateway",
  "SAP AI Core",
];
