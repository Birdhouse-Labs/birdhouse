// ABOUTME: Utilities for determining if messages are queued (waiting for assistant to complete)
// ABOUTME: A user message is "queued" if it was sent while an assistant message is still processing

import type { Message } from "../types/messages";

/**
 * Find the pending (incomplete) assistant message, if any.
 *
 * A pending assistant message is the latest assistant message when it does not
 * have a completed timestamp (time.completed is undefined).
 *
 * @param messages Array of messages (newest-first order expected)
 * @returns The pending assistant message, or undefined if none
 */
export function findPendingAssistant(messages: Message[]): Message | undefined {
  // Messages are newest-first, so the first assistant message is the latest one.
  const latestAssistant = messages.find((m) => {
    if (m.role !== "assistant") return false;
    const messageInfo = m.messageInfo;
    if (!messageInfo || messageInfo.role !== "assistant") return false;
    return true;
  });

  if (!latestAssistant?.messageInfo || latestAssistant.messageInfo.role !== "assistant") {
    return undefined;
  }

  return latestAssistant.messageInfo.time.completed ? undefined : latestAssistant;
}

/**
 * Determine if a user message is queued (waiting for assistant to complete).
 *
 * A user message is queued if:
 * - It is a user message
 * - There is a pending assistant message
 * - The user message was created after the pending assistant started processing
 *
 * @param message The message to check
 * @param pendingAssistant The pending assistant message (from findPendingAssistant)
 * @returns true if the message is queued
 */
export function isMessageQueued(message: Message, pendingAssistant: Message | undefined): boolean {
  if (!pendingAssistant) return false;
  if (message.role !== "user") return false;

  return message.timestamp.getTime() > pendingAssistant.timestamp.getTime();
}
