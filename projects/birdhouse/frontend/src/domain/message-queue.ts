// ABOUTME: Utilities for determining if messages are queued (waiting for assistant to complete)
// ABOUTME: A user message is "queued" if it was sent while an assistant message is still processing

import type { Message } from "../types/messages";

/**
 * Find the ID of the pending (incomplete) assistant message, if any.
 *
 * A pending assistant message is one that:
 * - Has role "assistant"
 * - Does not have a completed timestamp (time.completed is undefined)
 *
 * @param messages Array of messages (newest-first order expected)
 * @returns The ID of the pending assistant message, or undefined if none
 */
export function findPendingAssistantId(messages: Message[]): string | undefined {
  // Messages are newest-first, so find the first incomplete assistant message
  const pending = messages.find((m) => {
    if (m.role !== "assistant") return false;
    // Check if the OpenCode message has a completed timestamp
    const ocMessage = m.opencodeMessage;
    if (!ocMessage || ocMessage.role !== "assistant") return false;
    return !ocMessage.time?.completed;
  });

  return pending?.id;
}

/**
 * Determine if a user message is queued (waiting for assistant to complete).
 *
 * A user message is queued if:
 * - It is a user message
 * - There is a pending assistant message
 * - The user message's ID is greater than the pending assistant message's ID
 *   (meaning it was sent after the assistant started processing)
 *
 * @param message The message to check
 * @param pendingAssistantId The ID of the pending assistant message (from findPendingAssistantId)
 * @returns true if the message is queued
 */
export function isMessageQueued(message: Message, pendingAssistantId: string | undefined): boolean {
  if (!pendingAssistantId) return false;
  if (message.role !== "user") return false;

  // Message IDs are lexicographically comparable (OpenCode generates them this way)
  return message.id > pendingAssistantId;
}
