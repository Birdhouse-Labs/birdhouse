// ABOUTME: Type definitions for chat messages and content blocks
// ABOUTME: Shared across all apps - supports text, tools, reasoning, files, errors, and system events

import type { Message as OpencodeMessage } from "@opencode-ai/sdk";
import type { EventType } from "../../../server/src/types/agent-events";

// ============================================================================
// Content Block Types
// ============================================================================

/**
 * Base interface all content blocks share
 */
export interface ContentBlockBase {
  id: string;
  type: string;
}

/**
 * Text content block - standard message text with markdown support
 * Streams character-by-character as LLM generates response
 */
export interface TextBlock extends ContentBlockBase {
  type: "text";
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
  time?: {
    start: number;
    end?: number;
  };
  synthetic?: boolean;
  ignored?: boolean;
  metadata?: {
    sent_by_agent_id?: string;
    sent_by_agent_title?: string;
    [key: string]: unknown;
  };
}

/**
 * LLM reasoning/thinking block
 * Contains model's internal reasoning before generating response
 * Examples: Claude's <thinking> tags, o1's reasoning chains
 */
export interface ReasoningBlock extends ContentBlockBase {
  type: "reasoning";
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
  time?: {
    start: number;
    end?: number;
  };
}

/**
 * Tool/function call execution block
 * Shows tool invocation with input, output, and streaming execution status
 */
export interface ToolBlock extends ContentBlockBase {
  type: "tool";
  callID: string; // Tool invocation ID (for matching streaming updates)
  name: string; // "bash", "read", "edit", "grep", "task"
  status: "pending" | "running" | "completed" | "error";
  title?: string; // Human-readable description: "Install dependencies"
  input: Record<string, unknown>; // Tool input parameters
  output?: string; // Tool output (only present when status is "completed")
  error?: string; // Error message if status is "error"
  metadata?: Record<string, unknown>; // Tool-specific data: { output: string } during running, exitCode/diff/etc when completed
  timestamp?: Date;
  time?: {
    start: number;
    end?: number;
  };
}

/**
 * File/attachment block
 * Represents images, PDFs, or other file content
 */
export interface FileBlock extends ContentBlockBase {
  type: "file";
  mimeType: string; // "image/png", "application/pdf", "text/plain"
  url: string; // URL to fetch file content
  filename?: string; // Optional filename for display
}

/**
 * Error block for rendering errors inline
 * Can represent message-level errors or tool-level errors
 */
export interface ErrorBlock extends ContentBlockBase {
  type: "error";
  errorType: "auth" | "api" | "length" | "aborted" | "unknown";
  message: string;
  statusCode?: number; // HTTP status code for API errors
  isRetryable?: boolean; // Whether error can be retried
}

/**
 * Agent event block - represents a system timeline event
 * Used for clone operations and other agent lifecycle events
 * Uses action-centric model with explicit actor roles
 */
export interface AgentEventBlock extends ContentBlockBase {
  type: "agent_event";
  event_type: EventType;

  /** Who performed the action (null if human-initiated) */
  actor_agent_id: string | null;
  actor_agent_title: string;

  /** Source agent (where it came from) */
  source_agent_id: string | null;
  source_agent_title: string;

  /** Target agent (what was created/affected) */
  target_agent_id: string | null;
  target_agent_title: string;

  timestamp: number;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Union type of all renderable content blocks
 */
export type ContentBlock = TextBlock | ReasoningBlock | ToolBlock | FileBlock | ErrorBlock | AgentEventBlock;

// ============================================================================
// Message Types
// ============================================================================

/**
 * Token usage data for assistant messages
 */
export interface TokenUsage {
  input: number;
  output: number;
  reasoning: number;
  cache: {
    read: number;
    write: number;
  };
}

/**
 * Base message structure for chat UI
 * Supports user messages, assistant messages, and system events
 */
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";

  // Optional - only present for real OpenCode messages (not system events)
  opencodeMessage?: OpencodeMessage | undefined;

  model?: string;
  provider?: string;

  // Simple string content for backward compatibility
  // Empty string for system events
  content: string;

  // Content blocks for rich LLM responses (text, tools, reasoning, files)
  // For system messages: contains AgentEventBlock
  blocks?: ContentBlock[];

  // Message-level error (if message generation failed)
  error?: ErrorBlock;

  // Whether this message is currently streaming
  isStreaming?: boolean;

  // Token usage (only present for assistant messages)
  tokens?: TokenUsage;

  timestamp: Date;
}

// ============================================================================
// Streaming Event Types
// ============================================================================

/**
 * Event when a content block is updated during streaming
 */
export interface BlockUpdateEvent {
  messageId: string;
  blockId: string;
  block: ContentBlock;
  delta?: string; // For text/reasoning: new characters only
}

/**
 * Event when a message completes streaming
 */
export interface MessageCompleteEvent {
  messageId: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a content block is a TextBlock
 */
export function isTextBlock(block: ContentBlock): block is TextBlock {
  return block.type === "text";
}

/**
 * Type guard to check if a content block is a ToolBlock
 */
export function isToolBlock(block: ContentBlock): block is ToolBlock {
  return block.type === "tool";
}

/**
 * Type guard to check if a content block is a ReasoningBlock
 */
export function isReasoningBlock(block: ContentBlock): block is ReasoningBlock {
  return block.type === "reasoning";
}

/**
 * Type guard to check if a content block is a FileBlock
 */
export function isFileBlock(block: ContentBlock): block is FileBlock {
  return block.type === "file";
}

/**
 * Type guard to check if a content block is an ErrorBlock
 */
export function isErrorBlock(block: ContentBlock): block is ErrorBlock {
  return block.type === "error";
}

/**
 * Type guard to check if a message is an assistant message
 */
export function isAssistantMessage(message: Message): message is Message & { role: "assistant" } {
  return message.role === "assistant";
}

/**
 * Type guard to check if a message is a user message
 */
export function isUserMessage(message: Message): message is Message & { role: "user" } {
  return message.role === "user";
}

/**
 * Type guard to check if a message is a system event message
 */
export function isSystemMessage(message: Message): message is Message & { role: "system" } {
  return message.role === "system";
}

/**
 * Type guard to check if a content block is an AgentEventBlock
 */
export function isAgentEventBlock(block: ContentBlock): block is AgentEventBlock {
  return block.type === "agent_event";
}
