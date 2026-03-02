// ABOUTME: Metadata and JSON parsing utilities for adapters
// ABOUTME: Safely extracts and parses metadata from API responses

/**
 * Safely parse JSON string, returning undefined on failure
 */
export function safeParseJSON<T>(jsonString: string): T | undefined {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return undefined;
  }
}

/**
 * Extract metadata object from unknown data
 * Returns empty object if not a valid object
 */
export function extractMetadata(data: unknown): Record<string, unknown> {
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
}
