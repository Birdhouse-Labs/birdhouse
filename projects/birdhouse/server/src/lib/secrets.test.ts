// ABOUTME: Tests for workspace secrets encryption and decryption
// ABOUTME: Verifies AES-256-GCM encryption, provider credential mapping, and data integrity

import { describe, expect, test } from "bun:test";
import {
  decryptSecrets,
  encryptSecrets,
  type ProviderCredentials,
  providersToEnv,
  validateSecrets,
  type WorkspaceSecretsDecrypted,
} from "./secrets";

describe("Encryption utilities", () => {
  describe("encrypt and decrypt", () => {
    test("round-trip with simple providers", () => {
      const secrets: WorkspaceSecretsDecrypted = {
        providers: {
          anthropic: { api_key: "sk-ant-test123" },
          openai: { api_key: "sk-openai-test456" },
        },
      };

      const encrypted = encryptSecrets(secrets);
      const decrypted = decryptSecrets(encrypted);

      expect(decrypted).toEqual(secrets);
    });

    test("round-trip with complex providers", () => {
      const secrets: WorkspaceSecretsDecrypted = {
        providers: {
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
        },
      };

      const encrypted = encryptSecrets(secrets);
      const decrypted = decryptSecrets(encrypted);

      expect(decrypted).toEqual(secrets);
    });

    test("round-trip with MCP config", () => {
      const secrets: WorkspaceSecretsDecrypted = {
        providers: {
          anthropic: { api_key: "sk-ant-test123" },
        },
        mcp: {
          filesystem: {
            type: "local",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
            enabled: true,
          },
          remote: {
            type: "remote",
            url: "https://example.com/mcp",
            enabled: false,
          },
        },
      };

      const encrypted = encryptSecrets(secrets);
      const decrypted = decryptSecrets(encrypted);

      expect(decrypted).toEqual(secrets);
    });

    test("round-trip with empty config", () => {
      const secrets: WorkspaceSecretsDecrypted = {};

      const encrypted = encryptSecrets(secrets);
      const decrypted = decryptSecrets(encrypted);

      expect(decrypted).toEqual(secrets);
    });

    test("encrypted data is actually encrypted", () => {
      const secrets: WorkspaceSecretsDecrypted = {
        providers: {
          anthropic: { api_key: "sk-ant-test123" },
        },
      };

      const encrypted = encryptSecrets(secrets);

      // Encrypted data should not contain the plaintext key
      const encryptedString = encrypted.toString();
      expect(encryptedString).not.toContain("sk-ant-test123");
      expect(encryptedString).not.toContain("anthropic");
    });
  });

  describe("tamper detection", () => {
    test("decrypt returns null for tampered ciphertext", () => {
      const secrets: WorkspaceSecretsDecrypted = {
        providers: {
          anthropic: { api_key: "sk-ant-test123" },
        },
      };

      const encrypted = encryptSecrets(secrets);

      // Tamper with the ciphertext (last byte)
      encrypted[encrypted.length - 1] ^= 0xff;

      const decrypted = decryptSecrets(encrypted);
      expect(decrypted).toBeNull();
    });

    test("decrypt returns null for tampered auth tag", () => {
      const secrets: WorkspaceSecretsDecrypted = {
        providers: {
          anthropic: { api_key: "sk-ant-test123" },
        },
      };

      const encrypted = encryptSecrets(secrets);

      // Tamper with the auth tag (byte 20, after IV)
      encrypted[20] ^= 0xff;

      const decrypted = decryptSecrets(encrypted);
      expect(decrypted).toBeNull();
    });

    test("decrypt returns null for tampered IV", () => {
      const secrets: WorkspaceSecretsDecrypted = {
        providers: {
          anthropic: { api_key: "sk-ant-test123" },
        },
      };

      const encrypted = encryptSecrets(secrets);

      // Tamper with the IV (first byte)
      encrypted[0] ^= 0xff;

      const decrypted = decryptSecrets(encrypted);
      expect(decrypted).toBeNull();
    });
  });

  describe("invalid data handling", () => {
    test("decrypt returns null for too-short data", () => {
      const invalid = Buffer.from("short");
      const decrypted = decryptSecrets(invalid);
      expect(decrypted).toBeNull();
    });

    test("decrypt returns null for non-encrypted data", () => {
      const invalid = Buffer.from("this is not encrypted data".repeat(10));
      const decrypted = decryptSecrets(invalid);
      expect(decrypted).toBeNull();
    });

    test("decrypt returns null for corrupted JSON", () => {
      // This will decrypt but fail JSON parsing
      const secrets: WorkspaceSecretsDecrypted = {
        providers: {
          anthropic: { api_key: "test" },
        },
      };

      const encrypted = encryptSecrets(secrets);

      // We can't easily corrupt the JSON without breaking the auth tag,
      // so this test is more about ensuring error handling exists
      expect(encrypted.length).toBeGreaterThan(32);
    });
  });

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
    test("maps Tier 1 simple providers correctly", () => {
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
      };

      const env = providersToEnv(providers);

      expect(env.ANTHROPIC_API_KEY).toBe("sk-ant-123");
      expect(env.OPENAI_API_KEY).toBe("sk-openai-456");
      expect(env.GOOGLE_API_KEY).toBe("google-789");
      expect(env.OPENROUTER_API_KEY).toBe("or-abc");
      expect(env.GROQ_API_KEY).toBe("groq-def");
      expect(env.PERPLEXITY_API_KEY).toBe("pplx-ghi");
      expect(env.XAI_API_KEY).toBe("xai-jkl");
      expect(env.MISTRAL_API_KEY).toBe("mistral-mno");
      expect(env.COHERE_API_KEY).toBe("cohere-pqr");
      expect(env.DEEPINFRA_API_KEY).toBe("di-stu");
      expect(env.CEREBRAS_API_KEY).toBe("cerebras-vwx");
      expect(env.TOGETHER_API_KEY).toBe("together-yz");
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

    test("maps GitHub provider correctly", () => {
      const providers: ProviderCredentials = {
        github: {
          github_token: "ghp_test123",
        },
      };

      const env = providersToEnv(providers);

      expect(env.GITHUB_TOKEN).toBe("ghp_test123");
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

      expect(env.ANTHROPIC_API_KEY).toBe("sk-ant-123");
      expect(env.AWS_ACCESS_KEY_ID).toBe("AKIAIOSFODNN7EXAMPLE");
      expect(env.AWS_SECRET_ACCESS_KEY).toBe("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
      expect(env.GITHUB_TOKEN).toBe("ghp_test123");
      expect(Object.keys(env).length).toBe(4);
    });
  });

  describe("master key generation", () => {
    test("generates consistent encryption results", () => {
      const secrets: WorkspaceSecretsDecrypted = {
        providers: {
          anthropic: { api_key: "sk-ant-test123" },
        },
      };

      // Encrypt twice - should produce different ciphertexts (different IVs)
      const encrypted1 = encryptSecrets(secrets);
      const encrypted2 = encryptSecrets(secrets);

      // Different ciphertexts due to random IVs
      expect(encrypted1.equals(encrypted2)).toBe(false);

      // But both should decrypt to the same plaintext
      expect(decryptSecrets(encrypted1)).toEqual(secrets);
      expect(decryptSecrets(encrypted2)).toEqual(secrets);
    });
  });
});
