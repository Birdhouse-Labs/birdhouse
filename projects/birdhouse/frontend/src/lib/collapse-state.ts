// ABOUTME: Tab-specific persistence for tree node collapse state using sessionStorage
// ABOUTME: Each browser tab maintains its own independent collapse state that survives page refreshes

const STORAGE_KEY = "birdhouse:collapseState";

/**
 * Loads the collapse state from sessionStorage.
 * Returns an empty object if no saved state exists.
 *
 * @returns Record mapping agent IDs to their collapsed state (true = collapsed)
 */
export function loadCollapseState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};

  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return {};

    const parsed = JSON.parse(saved);
    // Validate it's an object with boolean values
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, boolean>;
    }
    return {};
  } catch {
    // Failed to parse - return empty state
    return {};
  }
}

/**
 * Saves the collapse state to sessionStorage.
 * This persists across page refreshes within the same browser tab.
 *
 * @param state - Record mapping agent IDs to their collapsed state
 */
export function saveCollapseState(state: Record<string, boolean>): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silently fail - storage quota exceeded or disabled
  }
}

/**
 * Clears all collapse state from sessionStorage.
 * Useful for reset functionality.
 */
export function clearCollapseState(): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently fail - storage disabled
  }
}
