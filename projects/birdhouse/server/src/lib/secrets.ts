// ABOUTME: Type definitions and utilities for workspace secrets (provider API keys and MCP config)
// ABOUTME: Provides validation plus OpenCode config and environment mappings for provider credentials

/**
 * MCP servers configuration (matches OpenCode format)
 */
export interface McpServers {
  [serverName: string]: McpServerConfig;
}

export interface McpServerConfig {
  type: "local" | "remote";
  command?: string; // For local servers
  args?: string[]; // For local servers
  url?: string; // For remote servers
  env?: Record<string, string>;
  enabled?: boolean;
}

/**
 * Provider API key configurations
 * Tier 1: Simple single-key providers (12 total)
 * Tier 2: Complex multi-key providers (6 total)
 */
export interface ProviderCredentials {
  // Tier 1: Simple single-key providers
  anthropic?: { api_key: string; extended_context?: boolean };
  openai?: { api_key: string };
  google?: { api_key: string };
  openrouter?: { api_key: string };
  groq?: { api_key: string };
  perplexity?: { api_key: string };
  xai?: { api_key: string };
  mistral?: { api_key: string };
  cohere?: { api_key: string };
  deepinfra?: { api_key: string };
  cerebras?: { api_key: string };
  together?: { api_key: string };
  zai?: { api_key: string };
  fireworks?: { api_key: string };

  // Tier 2: Complex multi-key providers
  aws?: {
    access_key_id: string;
    secret_access_key: string;
    region?: string;
    session_token?: string;
    profile?: string;
  };
  azure?: {
    resource_name: string;
    api_key: string;
  };
  vertex?: {
    project: string;
    location: string;
    credentials_path?: string;
  };
  github?: {
    github_token: string;
  };
  cloudflare?: {
    account_id: string;
    gateway_id: string;
    api_token: string;
  };
  sap?: {
    service_key: string;
    deployment_id: string;
    resource_group?: string;
  };
}

/**
 * Workspace secrets structure (plain JSON)
 */
export interface WorkspaceSecretsDecrypted {
  providers?: ProviderCredentials;
  mcp?: McpServers;
}

interface OpenCodeProviderConfigEntry {
  options?: Record<string, unknown>;
}

export interface OpenCodeProviderConfig {
  enabledProviders: string[];
  provider: Record<string, OpenCodeProviderConfigEntry>;
}

/**
 * Validate secrets structure (basic type checking)
 */
export function validateSecrets(secrets: unknown): secrets is WorkspaceSecretsDecrypted {
  if (!secrets || typeof secrets !== "object" || Array.isArray(secrets)) {
    return false;
  }

  const s = secrets as Record<string, unknown>;

  // Optional fields must be correct type if present
  if (
    s.providers !== undefined &&
    (typeof s.providers !== "object" || s.providers === null || Array.isArray(s.providers))
  ) {
    return false;
  }
  if (s.mcp !== undefined && (typeof s.mcp !== "object" || s.mcp === null || Array.isArray(s.mcp))) {
    return false;
  }

  return true;
}

export function buildOpenCodeProviderConfig(providers: ProviderCredentials): OpenCodeProviderConfig {
  const enabledProviders: string[] = [];
  const provider: Record<string, OpenCodeProviderConfigEntry> = {};

  function addApiKeyProvider(providerId: string, apiKey: string | undefined) {
    if (!apiKey) return;
    enabledProviders.push(providerId);
    provider[providerId] = {
      options: {
        apiKey,
      },
    };
  }

  addApiKeyProvider("anthropic", providers.anthropic?.api_key);
  addApiKeyProvider("openai", providers.openai?.api_key);
  addApiKeyProvider("google", providers.google?.api_key);
  addApiKeyProvider("openrouter", providers.openrouter?.api_key);
  addApiKeyProvider("groq", providers.groq?.api_key);
  addApiKeyProvider("perplexity", providers.perplexity?.api_key);
  addApiKeyProvider("xai", providers.xai?.api_key);
  addApiKeyProvider("mistral", providers.mistral?.api_key);
  addApiKeyProvider("cohere", providers.cohere?.api_key);
  addApiKeyProvider("deepinfra", providers.deepinfra?.api_key);
  addApiKeyProvider("cerebras", providers.cerebras?.api_key);
  addApiKeyProvider("togetherai", providers.together?.api_key);
  addApiKeyProvider("zai", providers.zai?.api_key);
  addApiKeyProvider("fireworks-ai", providers.fireworks?.api_key);

  if (providers.aws) {
    enabledProviders.push("amazon-bedrock");
  }
  if (providers.azure) {
    enabledProviders.push("azure");
  }
  if (providers.vertex) {
    enabledProviders.push("google-vertex");
  }
  if (providers.cloudflare) {
    enabledProviders.push("cloudflare-ai-gateway");
  }
  if (providers.sap) {
    enabledProviders.push("sap-ai-core");
  }

  return {
    enabledProviders,
    provider,
  };
}

/**
 * Convert provider credentials to OpenCode environment variables for providers
 * that still rely on environment-based configuration.
 */
export function providersToEnv(providers: ProviderCredentials): Record<string, string> {
  const env: Record<string, string> = {};

  if (providers.aws) {
    env.AWS_ACCESS_KEY_ID = providers.aws.access_key_id;
    env.AWS_SECRET_ACCESS_KEY = providers.aws.secret_access_key;
    if (providers.aws.region) env.AWS_REGION = providers.aws.region;
    if (providers.aws.session_token) env.AWS_SESSION_TOKEN = providers.aws.session_token;
    if (providers.aws.profile) env.AWS_PROFILE = providers.aws.profile;
  }
  if (providers.azure) {
    env.AZURE_RESOURCE_NAME = providers.azure.resource_name;
    env.AZURE_API_KEY = providers.azure.api_key;
  }
  if (providers.vertex) {
    env.GOOGLE_VERTEX_PROJECT = providers.vertex.project;
    env.GOOGLE_VERTEX_LOCATION = providers.vertex.location;
    env.VERTEX_PROJECT = providers.vertex.project;
    env.VERTEX_LOCATION = providers.vertex.location;
    if (providers.vertex.credentials_path) {
      env.GOOGLE_APPLICATION_CREDENTIALS = providers.vertex.credentials_path;
    }
  }
  if (providers.cloudflare) {
    env.CLOUDFLARE_ACCOUNT_ID = providers.cloudflare.account_id;
    env.CLOUDFLARE_GATEWAY_ID = providers.cloudflare.gateway_id;
    env.CLOUDFLARE_API_TOKEN = providers.cloudflare.api_token;
  }
  if (providers.sap) {
    env.SAP_SERVICE_KEY = providers.sap.service_key;
    env.SAP_DEPLOYMENT_ID = providers.sap.deployment_id;
    if (providers.sap.resource_group) {
      env.SAP_RESOURCE_GROUP = providers.sap.resource_group;
    }
  }

  return env;
}
