// ABOUTME: Agent navigation utility that tracks recently viewed agents
// ABOUTME: Maintains list of last 20 viewed agents in localStorage

const STORAGE_KEY = "birdhouse:recent-agents";
const MAX_RECENT_AGENTS = 20;

/**
 * Record of an agent view with timestamp
 */
export interface AgentViewRecord {
  agentId: string;
  viewedAt: number; // Unix milliseconds timestamp
}

/**
 * Get all recently viewed agents, sorted by most recent first
 * @returns Array of agent view records (most recent first)
 */
export function getRecentlyViewedAgents(): AgentViewRecord[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  const records: AgentViewRecord[] = JSON.parse(stored);
  // Validate format - ensure it's an array of objects with required fields
  if (!Array.isArray(records)) return [];

  return records.filter((r) => r.agentId).sort((a, b) => b.viewedAt - a.viewedAt);
}

/**
 * Record that an agent was viewed and update the recently viewed list
 * Maintains the list at exactly MAX_RECENT_AGENTS entries, removing duplicates
 * @param agentId The ID of the agent being viewed
 */
export function recordAgentView(agentId: string): void {
  const current = getRecentlyViewedAgents();

  const filtered = current.filter((r) => r.agentId !== agentId);

  const updated: AgentViewRecord[] = [{ agentId, viewedAt: Date.now() }, ...filtered].slice(0, MAX_RECENT_AGENTS);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Clear all recently viewed agent records
 */
export function clearRecentlyViewed(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if an agent ID is in the recently viewed list
 * @param agentId The agent ID to check
 * @returns True if the agent has been recently viewed
 */
export function isRecentlyViewed(agentId: string): boolean {
  return getRecentlyViewedAgents().some((r) => r.agentId === agentId);
}

/**
 * Get the timestamp when an agent was last viewed
 * @param agentId The agent ID
 * @returns Timestamp in milliseconds, or undefined if not in recent list
 */
export function getLastViewedTime(agentId: string): number | undefined {
  return getRecentlyViewedAgents().find((r) => r.agentId === agentId)?.viewedAt;
}
