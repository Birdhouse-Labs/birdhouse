// ABOUTME: Tests for workspace secrets validation and provider credential mapping
// ABOUTME: Verifies validateSecrets type checking and providersToEnv environment variable mapping

import { describe, expect, test } from "bun:test";
import {
  buildOpenCodeProviderConfig,
  type ProviderCredentials,
  providersToEnv,
  validateSecrets,
  type WorkspaceSecretsDecrypted,
} from "./secrets";

describe("validateSecrets", () => {
  test("accepts valid empty secrets", () => {
    const valid: WorkspaceSecretsDecrypted = {};
    expect(validateSecrets(valid)).toBe(true);
  });

  test("accepts valid secrets with providers", () => {
    const valid: WorkspaceSecretsDecrypted = {
      providers: {
        anthropic: { api_key: "test" },
      },
    };
    expect(validateSecrets(valid)).toBe(true);
  });

  test("accepts valid secrets with MCP", () => {
    const valid: WorkspaceSecretsDecrypted = {
      mcp: {
        test: { type: "local", command: "test" },
      },
    };
    expect(validateSecrets(valid)).toBe(true);
  });

  test("rejects null", () => {
    expect(validateSecrets(null)).toBe(false);
  });

  test("rejects non-object types", () => {
    expect(validateSecrets("string")).toBe(false);
    expect(validateSecrets(123)).toBe(false);
    expect(validateSecrets(true)).toBe(false);
    expect(validateSecrets([])).toBe(false);
  });

  test("rejects invalid providers type", () => {
    expect(validateSecrets({ providers: "not an object" })).toBe(false);
    expect(validateSecrets({ providers: null })).toBe(false);
    expect(validateSecrets({ providers: 123 })).toBe(false);
  });

  test("rejects invalid mcp type", () => {
    expect(validateSecrets({ mcp: "not an object" })).toBe(false);
    expect(validateSecrets({ mcp: null })).toBe(false);
    expect(validateSecrets({ mcp: 123 })).toBe(false);
  });
});

describe("providersToEnv", () => {
  test("keeps only env-backed providers", () => {
    const providers: ProviderCredentials = {
      anthropic: { api_key: "sk-ant-123" },
      openai: { api_key: "sk-openai-456" },
      google: { api_key: "google-789" },
      openrouter: { api_key: "or-abc" },
      groq: { api_key: "groq-def" },
      perplexity: { api_key: "pplx-ghi" },
      xai: { api_key: "xai-jkl" },
      mistral: { api_key: "mistral-mno" },
      cohere: { api_key: "cohere-pqr" },
      deepinfra: { api_key: "di-stu" },
      cerebras: { api_key: "cerebras-vwx" },
      together: { api_key: "together-yz" },
      zai: { api_key: "zai-abc" },
      fireworks: { api_key: "fw-xyz" },
      aws: {
        access_key_id: "AKIAIOSFODNN7EXAMPLE",
        secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "us-east-1",
        session_token: "test-token",
        profile: "default",
      },
      azure: {
        resource_name: "my-resource",
        api_key: "azure-key-123",
      },
      vertex: {
        project: "my-project",
        location: "us-central1",
        credentials_path: "/path/to/credentials.json",
      },
      cloudflare: {
        account_id: "account-123",
        gateway_id: "gateway-456",
        api_token: "token-789",
      },
      sap: {
        service_key: "service-key-123",
        deployment_id: "deployment-456",
        resource_group: "rg-789",
      },
    };

    const env = providersToEnv(providers);

    expect(env.AWS_ACCESS_KEY_ID).toBe("AKIAIOSFODNN7EXAMPLE");
    expect(env.AWS_SECRET_ACCESS_KEY).toBe("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    expect(env.AWS_REGION).toBe("us-east-1");
    expect(env.AWS_SESSION_TOKEN).toBe("test-token");
    expect(env.AWS_PROFILE).toBe("default");
    expect(env.AZURE_RESOURCE_NAME).toBe("my-resource");
    expect(env.AZURE_API_KEY).toBe("azure-key-123");
    expect(env.VERTEX_PROJECT).toBe("my-project");
    expect(env.VERTEX_LOCATION).toBe("us-central1");
    expect(env.GOOGLE_APPLICATION_CREDENTIALS).toBe("/path/to/credentials.json");
    expect(env.CLOUDFLARE_ACCOUNT_ID).toBe("account-123");
    expect(env.CLOUDFLARE_GATEWAY_ID).toBe("gateway-456");
    expect(env.CLOUDFLARE_API_TOKEN).toBe("token-789");
    expect(env.SAP_SERVICE_KEY).toBe("service-key-123");
    expect(env.SAP_DEPLOYMENT_ID).toBe("deployment-456");
    expect(env.SAP_RESOURCE_GROUP).toBe("rg-789");

    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.GOOGLE_GENERATIVE_AI_API_KEY).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
  });

  test("skips simple API-key providers", () => {
    const providers: ProviderCredentials = {
      zai: { api_key: "zhipu-key-123" },
      fireworks: { api_key: "fw-key-123" },
    };

    const env = providersToEnv(providers);

    expect(env.ZHIPU_API_KEY).toBeUndefined();
    expect(env.FIREWORKS_API_KEY).toBeUndefined();
  });

  test("maps AWS provider correctly", () => {
    const providers: ProviderCredentials = {
      aws: {
        access_key_id: "AKIAIOSFODNN7EXAMPLE",
        secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "us-east-1",
        session_token: "test-token",
        profile: "default",
      },
    };

    const env = providersToEnv(providers);

    expect(env.AWS_ACCESS_KEY_ID).toBe("AKIAIOSFODNN7EXAMPLE");
    expect(env.AWS_SECRET_ACCESS_KEY).toBe("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    expect(env.AWS_REGION).toBe("us-east-1");
    expect(env.AWS_SESSION_TOKEN).toBe("test-token");
    expect(env.AWS_PROFILE).toBe("default");
  });

  test("maps AWS provider with only required fields", () => {
    const providers: ProviderCredentials = {
      aws: {
        access_key_id: "AKIAIOSFODNN7EXAMPLE",
        secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      },
    };

    const env = providersToEnv(providers);

    expect(env.AWS_ACCESS_KEY_ID).toBe("AKIAIOSFODNN7EXAMPLE");
    expect(env.AWS_SECRET_ACCESS_KEY).toBe("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    expect(env.AWS_REGION).toBeUndefined();
    expect(env.AWS_SESSION_TOKEN).toBeUndefined();
    expect(env.AWS_PROFILE).toBeUndefined();
  });

  test("maps Azure provider correctly", () => {
    const providers: ProviderCredentials = {
      azure: {
        resource_name: "my-resource",
        api_key: "azure-key-123",
      },
    };

    const env = providersToEnv(providers);

    expect(env.AZURE_RESOURCE_NAME).toBe("my-resource");
    expect(env.AZURE_API_KEY).toBe("azure-key-123");
  });

  test("maps Vertex AI provider correctly", () => {
    const providers: ProviderCredentials = {
      vertex: {
        project: "my-project",
        location: "us-central1",
        credentials_path: "/path/to/credentials.json",
      },
    };

    const env = providersToEnv(providers);

    expect(env.VERTEX_PROJECT).toBe("my-project");
    expect(env.VERTEX_LOCATION).toBe("us-central1");
    expect(env.GOOGLE_APPLICATION_CREDENTIALS).toBe("/path/to/credentials.json");
  });

  test("skips GitHub provider", () => {
    const providers: ProviderCredentials = {
      github: {
        github_token: "ghp_test123",
      },
    };

    const env = providersToEnv(providers);

    expect(env.GITHUB_TOKEN).toBeUndefined();
  });

  test("maps Cloudflare provider correctly", () => {
    const providers: ProviderCredentials = {
      cloudflare: {
        account_id: "account-123",
        gateway_id: "gateway-456",
        api_token: "token-789",
      },
    };

    const env = providersToEnv(providers);

    expect(env.CLOUDFLARE_ACCOUNT_ID).toBe("account-123");
    expect(env.CLOUDFLARE_GATEWAY_ID).toBe("gateway-456");
    expect(env.CLOUDFLARE_API_TOKEN).toBe("token-789");
  });

  test("maps SAP provider correctly", () => {
    const providers: ProviderCredentials = {
      sap: {
        service_key: "service-key-123",
        deployment_id: "deployment-456",
        resource_group: "rg-789",
      },
    };

    const env = providersToEnv(providers);

    expect(env.SAP_SERVICE_KEY).toBe("service-key-123");
    expect(env.SAP_DEPLOYMENT_ID).toBe("deployment-456");
    expect(env.SAP_RESOURCE_GROUP).toBe("rg-789");
  });

  test("handles empty providers", () => {
    const providers: ProviderCredentials = {};
    const env = providersToEnv(providers);
    expect(Object.keys(env).length).toBe(0);
  });

  test("handles mixed providers", () => {
    const providers: ProviderCredentials = {
      anthropic: { api_key: "sk-ant-123" },
      aws: {
        access_key_id: "AKIAIOSFODNN7EXAMPLE",
        secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      },
      github: {
        github_token: "ghp_test123",
      },
    };

    const env = providersToEnv(providers);

    expect(env.AWS_ACCESS_KEY_ID).toBe("AKIAIOSFODNN7EXAMPLE");
    expect(env.AWS_SECRET_ACCESS_KEY).toBe("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(Object.keys(env).length).toBe(2);
  });
});

describe("buildOpenCodeProviderConfig", () => {
  test("builds enabled providers and config-based api keys for simple providers", () => {
    const providers: ProviderCredentials = {
      anthropic: { api_key: "sk-ant-123" },
      openai: { api_key: "sk-openai-456" },
      google: { api_key: "google-789" },
      together: { api_key: "together-yz" },
      fireworks: { api_key: "fw-xyz" },
      github: { github_token: "ghp_test123" },
      aws: {
        access_key_id: "AKIAIOSFODNN7EXAMPLE",
        secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      },
    };

    const result = buildOpenCodeProviderConfig(providers);

    expect(result.enabledProviders).toEqual([
      "anthropic",
      "openai",
      "google",
      "togetherai",
      "fireworks-ai",
      "amazon-bedrock",
    ]);
    expect(result.provider).toEqual({
      anthropic: { options: { apiKey: "sk-ant-123" } },
      openai: { options: { apiKey: "sk-openai-456" } },
      google: { options: { apiKey: "google-789" } },
      togetherai: { options: { apiKey: "together-yz" } },
      "fireworks-ai": { options: { apiKey: "fw-xyz" } },
    });
  });

  test("returns empty provider config when no supported providers are configured", () => {
    const result = buildOpenCodeProviderConfig({ github: { github_token: "ghp_test123" } });

    expect(result.enabledProviders).toEqual([]);
    expect(result.provider).toEqual({});
  });
});
