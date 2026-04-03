// ABOUTME: Shared timeline item types for system events and Birdhouse-owned harness messages.
// ABOUTME: Defines the message-plus-event union returned by agent timeline endpoints.

import type { BirdhouseMessage } from "../harness";

/**
 * Event type discriminator for system timeline events (action-centric model)
 */
export type EventType = "clone_created"; // A clone was created (replaces all 4 old clone event types)

/**
 * System event representing timeline activity (cloning, etc.)
 * These are stored in the agent_events table and merged with server messages
 * Uses action-centric model with explicit actor roles
 */
export interface SystemEvent {
  /** Unique event ID */
  id: string;

  /** Type of event that occurred */
  event_type: EventType;

  /** Unix timestamp in milliseconds when event occurred */
  timestamp: number;

  /** Who performed the action (null if human, null if deleted via ON DELETE SET NULL) */
  actor_agent_id: string | null;

  /** Cached title of actor agent (always present, even if agent deleted) */
  actor_agent_title: string;

  /** Source agent (where it came from, null if deleted via ON DELETE SET NULL) */
  source_agent_id: string | null;

  /** Cached title of source agent (always present, even if agent deleted) */
  source_agent_title: string;

  /** Target agent (what was created/affected, null if deleted via ON DELETE SET NULL) */
  target_agent_id: string | null;

  /** Cached title of target agent (always present, even if agent deleted) */
  target_agent_title: string;

  /** Optional metadata for future extensibility (matches metadata TEXT column) */
  metadata?: Record<string, unknown>;
}

/**
 * Server message structure using Birdhouse-owned harness message types.
 */
export type ServerMessage = BirdhouseMessage;

/**
 * Timeline item - discriminated union of messages and events
 * Returned by GET /agents/:id/messages endpoint
 */
export type TimelineItem =
  | { item_type: "message"; message: ServerMessage }
  | { item_type: "event"; event: SystemEvent };
