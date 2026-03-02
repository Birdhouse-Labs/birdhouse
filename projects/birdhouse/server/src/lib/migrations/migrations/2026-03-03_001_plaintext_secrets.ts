// ABOUTME: Migration to replace encrypted BLOB secrets with plain JSON TEXT
// ABOUTME: Decrypts any existing secrets inline using AES-256-GCM, then drops the encrypted column

import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type Kysely, sql } from "kysely";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getDataDir(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return join(homedir(), "Library/Application Support/Birdhouse");
  }
  if (platform === "win32") {
    return join(homedir(), "AppData/Roaming/Birdhouse");
  }
  const xdgDataHome = process.env.XDG_DATA_HOME || join(homedir(), ".local/share");
  return join(xdgDataHome, "birdhouse");
}

/**
 * Attempt to load the master key from disk.
 * Returns null if the key file does not exist or is invalid.
 */
function tryLoadMasterKey(): Buffer | null {
  const keyPath = join(getDataDir(), "master.key");
  if (!existsSync(keyPath)) {
    return null;
  }
  try {
    const keyHex = readFileSync(keyPath, "utf-8").trim();
    const key = Buffer.from(keyHex, "hex");
    if (key.length !== KEY_LENGTH) {
      return null;
    }
    return key;
  } catch {
    return null;
  }
}

/**
 * Decrypt a secrets BLOB using AES-256-GCM.
 * Returns the plaintext JSON string, or null on any failure.
 * Format: [IV (16 bytes)][Auth Tag (16 bytes)][Ciphertext]
 */
function tryDecryptBlob(encrypted: Buffer, masterKey: Buffer): string | null {
  try {
    if (encrypted.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      return null;
    }
    const iv = encrypted.subarray(0, IV_LENGTH);
    const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = encrypted.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
  } catch {
    return null;
  }
}

export async function up(db: Kysely<Record<string, never>>): Promise<void> {
  // Add new plain-text column (nullable during migration)
  await sql`ALTER TABLE workspace_secrets ADD COLUMN secrets TEXT`.execute(db);

  // Attempt to decrypt existing rows and write plain JSON
  const masterKey = tryLoadMasterKey();

  const rows = await sql<{
    workspace_id: string;
    secrets_encrypted: Buffer;
  }>`SELECT workspace_id, secrets_encrypted FROM workspace_secrets`.execute(db);

  for (const row of rows.rows) {
    let plaintext: string | null = null;

    if (masterKey) {
      const decrypted = tryDecryptBlob(row.secrets_encrypted, masterKey);
      if (decrypted !== null) {
        // Validate it is JSON before storing
        try {
          JSON.parse(decrypted);
          plaintext = decrypted;
        } catch {
          // Corrupted JSON — treat as lost
        }
      }
    }
    // If master.key is missing or decryption failed, secrets are lost — store NULL

    await sql`UPDATE workspace_secrets SET secrets = ${plaintext} WHERE workspace_id = ${row.workspace_id}`.execute(db);
  }

  // Recreate table without secrets_encrypted (SQLite cannot drop columns before 3.35)
  await sql`
    CREATE TABLE workspace_secrets_new (
      workspace_id TEXT PRIMARY KEY,
      secrets TEXT,
      config_updated_at INTEGER,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id) ON DELETE CASCADE
    )
  `.execute(db);

  await sql`
    INSERT INTO workspace_secrets_new (workspace_id, secrets, config_updated_at)
    SELECT workspace_id, secrets, config_updated_at FROM workspace_secrets
  `.execute(db);

  await sql`DROP TABLE workspace_secrets`.execute(db);

  await sql`ALTER TABLE workspace_secrets_new RENAME TO workspace_secrets`.execute(db);
}

export async function down(db: Kysely<Record<string, never>>): Promise<void> {
  // Restore the encrypted BLOB column structure (data cannot be recovered)
  await sql`
    CREATE TABLE workspace_secrets_old (
      workspace_id TEXT PRIMARY KEY,
      secrets_encrypted BLOB NOT NULL,
      config_updated_at INTEGER,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id) ON DELETE CASCADE
    )
  `.execute(db);

  await sql`DROP TABLE workspace_secrets`.execute(db);

  await sql`ALTER TABLE workspace_secrets_old RENAME TO workspace_secrets`.execute(db);
}
