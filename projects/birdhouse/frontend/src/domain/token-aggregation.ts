// ABOUTME: Token aggregation logic for calculating context usage statistics.
// ABOUTME: Shows current context window state from the last assistant message in the timeline.

import { getModelLimit } from "../stores/model-limits";
import type { Message } from "../types/messages";

/**
 * Aggregated token statistics for an agent conversation
 * Shows the last assistant message's token usage.
 */
export interface TokenStats {
  used: number; // Current context usage from last message (input + output + reasoning + cache.read + cache.write)
  limit: number; // Model-specific context limit
  model: string;
}

/**
 * Aggregate token statistics from last assistant message
 * Shows current context window state from the last assistant message.
 * @param messages Array of messages in newest-first order (reversed by message-adapter)
 * @param modelName Model identifier for determining context limit
 * @returns Token statistics from last assistant message
 */
export function aggregateTokenStats(messages: Message[], modelName: string): TokenStats {
  // Find last assistant message with tokens > 0
  // NOTE: messages array is reversed (newest-first), so use find() not findLast()
  const lastAssistant = messages.find(
    (m) =>
      m.role === "assistant" &&
      m.tokens &&
      m.tokens.input + m.tokens.output + m.tokens.reasoning + m.tokens.cache.read + m.tokens.cache.write > 0,
  );

  // No assistant messages with tokens found
  if (!lastAssistant || !lastAssistant.tokens) {
    return {
      used: 0,
      limit: getModelLimit(modelName) ?? 0,
      model: modelName,
    };
  }

  // Current context usage = last message's full token consumption.
  const used =
    lastAssistant.tokens.input +
    lastAssistant.tokens.output +
    lastAssistant.tokens.reasoning +
    lastAssistant.tokens.cache.read +
    lastAssistant.tokens.cache.write;

  return {
    used,
    limit: getModelLimit(modelName) ?? 0,
    model: modelName,
  };
}
