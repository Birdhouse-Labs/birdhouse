// ABOUTME: Utilities for finding safe clone points when cloning agents
// ABOUTME: Determines the message ID to clone from to avoid incomplete assistant responses

import type { Message } from "../lib/opencode-client";

/**
 * Check if a conversation turn (starting at a user message) has a completed assistant response.
 *
 * A conversation turn can span multiple assistant messages when tools are involved:
 * - User → Assistant(tool-calls) → Assistant(tool-calls) → Assistant(stop)
 *
 * The turn is complete when we find an assistant message with a finish reason that is NOT:
 * - undefined (still streaming)
 * - "tool-calls" (waiting for tool results)
 * - "unknown" (indeterminate state)
 *
 * Valid completion finish reasons include: "stop", "end_turn", "length", "content-filter", "error"
 *
 * @param messages All messages in the conversation
 * @param userMessageIndex Index of the user message that starts this turn
 * @returns true if the conversation turn is complete
 */
function isConversationTurnComplete(messages: Message[], userMessageIndex: number): boolean {
  // Look at all messages after this user message until we hit another user message
  for (let i = userMessageIndex + 1; i < messages.length; i++) {
    const msg = messages[i];

    // Hit another user message - turn never completed
    if (msg.info.role === "user") {
      return false;
    }

    // Found an assistant message
    if (msg.info.role === "assistant") {
      const finish = msg.info.finish;

      // No finish = still streaming
      if (!finish) return false;

      // tool-calls or unknown = keep looking for final finish
      if (finish === "tool-calls" || finish === "unknown") {
        continue;
      }

      // Any other finish reason = turn is complete
      return true;
    }
  }

  // Reached end without finding completion
  return false;
}

/**
 * Find the safe clone point message ID for cloning an agent.
 *
 * When cloning an agent (especially one that's actively working), we need to
 * find a safe point to clone from that excludes any incomplete work. OpenCode's
 * fork behavior is:
 * - Clone from user message ID → excludes that message (and everything after)
 * - Clone from assistant message ID → includes that message
 *
 * Any incomplete work will be at the END of the conversation, so we only need to
 * check the most recent user message. If it has a completed response, clone everything.
 * If not, clone from that message (excluding it and all incomplete work after).
 *
 * @param messages Array of messages in chronological order (oldest-first)
 * @returns The message ID to clone from, or undefined if entire conversation should be copied
 *
 * @example
 * // Messages: [User1, Assistant1(stop), User2, Assistant2(undefined)]
 * // Returns: User2's ID (last user message has incomplete response)
 *
 * @example
 * // Messages: [User1, Assistant1(tool-calls), Assistant2(stop)]
 * // Returns: undefined (last user message has completed response)
 *
 * @example
 * // Messages: [User1, Assistant1(tool-calls), User2]
 * // Returns: User2's ID (last user message, no response yet)
 */
export function findSafeClonePoint(messages: Message[]): string | undefined {
  // Find the last (most recent) user message by iterating backwards
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];

    if (msg.info.role === "user") {
      // Found the last user message - check if it has a completed response
      if (!isConversationTurnComplete(messages, i)) {
        // Incomplete response - clone from this message (excluding it)
        return msg.info.id;
      }

      // Last user message has completed response - clone everything
      return undefined;
    }
  }

  // No user messages in conversation (shouldn't happen, but handle it)
  return undefined;
}
