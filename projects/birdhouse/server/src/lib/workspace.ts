// ABOUTME: Workspace ID generation utilities
// ABOUTME: Deterministic workspace IDs based on directory path for cross-environment consistency

import { createHash } from "node:crypto";
import { resolve } from "node:path";

/**
 * Generate a deterministic workspace ID based on directory path
 * Same directory will always generate the same ID across dev/prod environments
 * This ensures agent databases are shared while allowing separate OpenCode tracking
 *
 * Format: ws_<16-char-hex-hash>
 * Example: /path/to/workspaces → ws_a354f742e7b5040c
 */
export function generateWorkspaceId(directory: string): string {
  // Resolve to absolute path for consistency
  const absolutePath = resolve(directory);

  // Create SHA-256 hash of the path
  const hash = createHash("sha256").update(absolutePath).digest("hex").slice(0, 16); // Use first 16 chars for reasonable ID length

  return `ws_${hash}`;
}
