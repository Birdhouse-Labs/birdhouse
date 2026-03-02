// ABOUTME: UUID generation utility for content blocks
// ABOUTME: Uses nanoid for short, unique, URL-safe identifiers

import { nanoid } from "nanoid";

/**
 * Generates a unique ID for content blocks (text, tool, reasoning, etc.).
 *
 * Uses nanoid which:
 * - Works in all contexts (HTTP/HTTPS, no crypto API needed)
 * - Generates short, URL-safe IDs (21 chars by default)
 * - More collision-resistant than Math.random
 * - Consistent with backend agent ID generation
 *
 * @returns A unique ID string (e.g., "V1StGXR8_Z5jdHi6B-myT")
 */
export function generateUUID(): string {
  return nanoid();
}
