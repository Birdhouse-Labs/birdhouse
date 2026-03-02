// ABOUTME: Encryption utilities for workspace secrets using AES-256-GCM
// ABOUTME: Manages master key generation and provides encrypt/decrypt operations for multi-provider API keys

import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { log } from "./logger";

/**
 * Get platform-appropriate data directory for Birdhouse
 * - macOS: ~/Library/Application Support/Birdhouse
 * - Linux: ~/.local/share/birdhouse
 * - Windows: %APPDATA%/Birdhouse (via homedir)
 */
function getDataDir(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return join(homedir(), "Library/Application Support/Birdhouse");
  }
  if (platform === "win32") {
    return join(homedir(), "AppData/Roaming/Birdhouse");
  }
  // Linux and others: use XDG_DATA_HOME or default
  const xdgDataHome = process.env.XDG_DATA_HOME || join(homedir(), ".local/share");
  return join(xdgDataHome, "birdhouse");
}

const DATA_DIR = getDataDir();
const MASTER_KEY_PATH = join(DATA_DIR, "master.key");

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

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
 * Workspace secrets structure (decrypted JSON)
 */
export interface WorkspaceSecretsDecrypted {
  providers?: ProviderCredentials;
  mcp?: McpServers;
}

/**
 * Get or generate master encryption key
 */
function getMasterKey(): Buffer {
  try {
    // Try to load existing key
    if (existsSync(MASTER_KEY_PATH)) {
      const keyHex = readFileSync(MASTER_KEY_PATH, "utf-8").trim();
      const key = Buffer.from(keyHex, "hex");

      if (key.length !== KEY_LENGTH) {
        throw new Error(`Invalid key length: ${key.length} (expected ${KEY_LENGTH})`);
      }

      log.server.debug("Loaded master encryption key");
      return key;
    }

    // Generate new key
    const key = crypto.randomBytes(KEY_LENGTH);
    const keyHex = key.toString("hex");

    // Ensure directory exists before writing
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }

    writeFileSync(MASTER_KEY_PATH, keyHex, { mode: 0o600 });
    log.server.info({ path: MASTER_KEY_PATH }, "Generated new master encryption key");

    return key;
  } catch (error) {
    log.server.error({ error, path: MASTER_KEY_PATH }, "Failed to load/generate master key");
    throw new Error(`Master key error: ${error instanceof Error ? error.message : "Unknown"}`);
  }
}

/**
 * Encrypt workspace secrets to Buffer
 * Format: [IV (16 bytes)][Auth Tag (16 bytes)][Ciphertext]
 */
export function encryptSecrets(secrets: WorkspaceSecretsDecrypted): Buffer {
  try {
    const masterKey = getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

    const plaintext = JSON.stringify(secrets);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Prepend IV and auth tag to ciphertext
    return Buffer.concat([iv, authTag, ciphertext]);
  } catch (error) {
    log.server.error({ error }, "Failed to encrypt secrets");
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : "Unknown"}`);
  }
}

/**
 * Decrypt workspace secrets from Buffer
 * Returns null if decryption fails (corrupted data, wrong key, etc.)
 */
export function decryptSecrets(encrypted: Buffer): WorkspaceSecretsDecrypted | null {
  try {
    const masterKey = getMasterKey();

    if (encrypted.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error("Encrypted data too short");
    }

    // Extract IV, auth tag, and ciphertext
    const iv = encrypted.subarray(0, IV_LENGTH);
    const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = encrypted.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");

    return JSON.parse(plaintext) as WorkspaceSecretsDecrypted;
  } catch (error) {
    log.server.error({ error }, "Failed to decrypt secrets");
    return null;
  }
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

/**
 * Convert provider credentials to OpenCode environment variables
 * Maps our storage format to OpenCode's expected env var names
 */
export function providersToEnv(providers: ProviderCredentials): Record<string, string> {
  const env: Record<string, string> = {};

  // Tier 1: Simple single-key providers
  if (providers.anthropic?.api_key) {
    env.ANTHROPIC_API_KEY = providers.anthropic.api_key;
  }
  if (providers.openai?.api_key) {
    env.OPENAI_API_KEY = providers.openai.api_key;
  }
  if (providers.google?.api_key) {
    env.GOOGLE_API_KEY = providers.google.api_key;
  }
  if (providers.openrouter?.api_key) {
    env.OPENROUTER_API_KEY = providers.openrouter.api_key;
  }
  if (providers.groq?.api_key) {
    env.GROQ_API_KEY = providers.groq.api_key;
  }
  if (providers.perplexity?.api_key) {
    env.PERPLEXITY_API_KEY = providers.perplexity.api_key;
  }
  if (providers.xai?.api_key) {
    env.XAI_API_KEY = providers.xai.api_key;
  }
  if (providers.mistral?.api_key) {
    env.MISTRAL_API_KEY = providers.mistral.api_key;
  }
  if (providers.cohere?.api_key) {
    env.COHERE_API_KEY = providers.cohere.api_key;
  }
  if (providers.deepinfra?.api_key) {
    env.DEEPINFRA_API_KEY = providers.deepinfra.api_key;
  }
  if (providers.cerebras?.api_key) {
    env.CEREBRAS_API_KEY = providers.cerebras.api_key;
  }
  if (providers.together?.api_key) {
    env.TOGETHER_API_KEY = providers.together.api_key;
  }

  // Tier 2: Complex multi-key providers
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
    env.VERTEX_PROJECT = providers.vertex.project;
    env.VERTEX_LOCATION = providers.vertex.location;
    if (providers.vertex.credentials_path) {
      env.GOOGLE_APPLICATION_CREDENTIALS = providers.vertex.credentials_path;
    }
  }
  if (providers.github?.github_token) {
    env.GITHUB_TOKEN = providers.github.github_token;
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
