// ABOUTME: Time and date utility functions for message adapters and UI display
// ABOUTME: Handles timestamp parsing, duration formatting, and smart date/time display

/**
 * Convert Unix timestamp (milliseconds) to Date object
 */
export function parseTimestamp(unixMs: number): Date {
  return new Date(unixMs);
}

/**
 * Format timestamp as ISO string for UI display
 */
export function formatTimestamp(unixMs: number): string {
  return new Date(unixMs).toISOString();
}

/**
 * Calculate duration between start and end timestamps
 * Returns formatted string like "2.45s" or "In progress" if no end
 */
export function formatDuration(start: number, end?: number): string {
  if (!end) return "In progress";
  const durationSeconds = (end - start) / 1000;
  return `${durationSeconds.toFixed(2)}s`;
}

/**
 * Create time range object from start/end timestamps
 */
export function createTimeRange(start: number, end?: number): { start: number; end?: number } {
  const range: { start: number; end?: number } = { start };
  if (end !== undefined) {
    range.end = end;
  }
  return range;
}

/**
 * Format a timestamp with smart date inclusion based on relative date.
 *
 * If the timestamp is on the same day as relativeDate, shows just time (e.g., "1:48pm").
 * If different day in same year, includes month and day (e.g., "Dec 12 1:48pm").
 * If different year, includes year (e.g., "Dec 12 '25 1:48pm").
 *
 * @param timestamp - The Date to format
 * @param relativeDate - The date to compare against (e.g., section header date)
 * @returns Formatted string optimized for human scanning
 */
export function formatSmartTime(timestamp: Date, relativeDate: Date): string {
  const hours = timestamp.getHours();
  const minutes = timestamp.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  const displayHours = hours % 12 || 12;
  const timeStr = `${displayHours}:${minutes.toString().padStart(2, "0")}${ampm}`;

  // Check if same day
  const isSameDay =
    timestamp.getFullYear() === relativeDate.getFullYear() &&
    timestamp.getMonth() === relativeDate.getMonth() &&
    timestamp.getDate() === relativeDate.getDate();

  if (isSameDay) {
    return timeStr;
  }

  // Different day - include date
  const month = timestamp.toLocaleDateString("en-US", { month: "short" });
  const day = timestamp.getDate();

  // Check if same year
  const isSameYear = timestamp.getFullYear() === relativeDate.getFullYear();

  if (isSameYear) {
    return `${month} ${day} ${timeStr}`;
  }

  // Different year - include abbreviated year
  const year = timestamp.getFullYear().toString().slice(-2);
  return `${month} ${day} '${year} ${timeStr}`;
}
