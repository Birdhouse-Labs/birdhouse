// ABOUTME: Path manipulation utilities for display purposes
// ABOUTME: Provides functions to format file paths for UI display

/**
 * Shorten a path by replacing the user's home directory with ~
 */
export function shortenPath(path: string): string {
  // Common home directory patterns
  // macOS: /Users/username
  // Linux: /home/username
  const homeMatch = path.match(/^(\/Users\/[^/]+|\/home\/[^/]+)/);
  if (homeMatch?.[1]) {
    return path.replace(homeMatch[1], "~");
  }
  return path;
}
