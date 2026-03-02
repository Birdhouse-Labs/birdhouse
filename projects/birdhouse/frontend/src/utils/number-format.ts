// ABOUTME: Number formatting utilities for displaying large numbers in compact form
// ABOUTME: Used for token counts, context usage, and other metrics

/**
 * Format large numbers in compact form (K for thousands, M for millions)
 * @param num The number to format
 * @returns Formatted string (e.g., "1.5M", "184.2K", "379")
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
