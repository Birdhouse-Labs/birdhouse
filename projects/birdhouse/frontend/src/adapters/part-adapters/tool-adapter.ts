// ABOUTME: Converts OpenCode tool parts to UI ToolBlock format
// ABOUTME: Parses tool state and maps to pending/running/completed/error status

import type { ToolPart } from "@opencode-ai/sdk";
import { generateUUID } from "../../lib/uuid";
import type { ToolBlock } from "../../types/messages";
import { extractMetadata } from "../utils/metadata-utils";

/**
 * Structure of OpenCode tool state (based on API observation)
 */
interface ToolState {
  status?: "pending" | "running" | "completed" | "error";
  title?: string;
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Map OpenCode tool part to UI ToolBlock
 * Handles all 4 tool states: pending, running, completed, error
 */
export function mapToolPart(part: ToolPart): ToolBlock {
  const state = extractMetadata(part.state) as ToolState;

  const block: ToolBlock = {
    id: generateUUID(),
    type: "tool",
    callID: part.callID,
    name: part.tool,
    status: state.status || "pending",
    input: state.input || {},
    timestamp: new Date(),
  };

  // Add optional fields only if they exist
  if (state.title !== undefined) block.title = state.title;
  if (state.output !== undefined) block.output = state.output;
  if (state.error !== undefined) block.error = state.error;
  if (state.metadata !== undefined) block.metadata = state.metadata;

  return block;
}
