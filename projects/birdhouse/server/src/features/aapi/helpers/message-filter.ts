// ABOUTME: Message filtering for plugin/agent consumption - removes internal IDs and metadata
// ABOUTME: Keeps only information useful for agents learning from other agents' work

import type { Message } from "../../../lib/opencode-client";

export type FilterView = "default" | "full" | "tool_call";

interface FilteredDiffSummary {
  file?: string;
  status?: string;
  additions?: number;
  deletions?: number;
}

interface FilteredMessageSummary {
  diffs?: FilteredDiffSummary[];
}

/**
 * Filtered message info - removes IDs, cost, tokens, mode, agent
 */
export interface FilteredMessageInfo {
  role: "user" | "assistant";
  time: { created: number; completed?: number };
  modelID?: string;
  providerID?: string;
  model?: { providerID: string; modelID: string };
  finish?: string;
  path?: { cwd: string; root: string };
  summary?: FilteredMessageSummary;
  error?: { name: string; message?: string; data?: { message: string } };
}

/**
 * Filtered message part - removes IDs, metadata, step markers
 */
export interface FilteredMessagePart {
  type: string;
  callID?: string;
  summary?: string;
  text?: string;
  time?: { start: number; end: number };
  tool?: string;
  state?: Record<string, unknown>;
  mime?: string;
  filename?: string;
  url?: string;
}

/**
 * Filtered message structure for plugin/agent consumption
 */
export interface FilteredMessage {
  info: FilteredMessageInfo;
  parts: FilteredMessagePart[];
}

const FULL_VIEW_OMIT_PART_TYPES = new Set(["reasoning", "patch"]);
const NOISY_TOOL_INPUT_KEYS = new Set(["prompt", "system", "message", "patchText", "command"]);
const FULL_OUTPUT_PREVIEW_MAX_CHARS = 400;

function truncateString(value: string, maxLength = 280): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function summarizeToolInputValue(value: unknown): unknown {
  if (typeof value === "string") {
    return truncateString(value);
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    const summarizedItems = value
      .map(summarizeToolInputValue)
      .filter((item) => item !== undefined);

    return summarizedItems.length > 0 ? summarizedItems : undefined;
  }

  if (typeof value !== "object") {
    return undefined;
  }

  const summarizedEntries = Object.entries(value)
    .filter(([key]) => !NOISY_TOOL_INPUT_KEYS.has(key))
    .map(([key, itemValue]) => [key, summarizeToolInputValue(itemValue)] as const)
    .filter(([, itemValue]) => itemValue !== undefined);

  return summarizedEntries.length > 0 ? Object.fromEntries(summarizedEntries) : undefined;
}

function filterToolStateForFull(part: Record<string, unknown>): Record<string, unknown> | undefined {
  if (typeof part.state !== "object" || part.state === null) {
    return undefined;
  }

  const state = part.state as Record<string, unknown>;
  const filteredState: Record<string, unknown> = {};

  if (typeof state.status === "string") {
    filteredState.status = state.status;
  }

  if (typeof state.title === "string" && state.title.length > 0) {
    filteredState.title = state.title;
  }

  const summarizedInput = summarizeToolInputValue(state.input);
  if (summarizedInput !== undefined) {
    filteredState.input = summarizedInput;
  }

  if (typeof state.error === "string" && state.error.length > 0) {
    filteredState.error = truncateString(state.error);
  }

  if (state.output !== undefined) {
    const summarizedOutput = summarizeToolOutput(state.output);
    if (summarizedOutput !== undefined) {
      filteredState.output = summarizedOutput.value;
      filteredState.outputTruncated = summarizedOutput.truncated;
    }
  }

  return Object.keys(filteredState).length > 0 ? filteredState : undefined;
}

function summarizeToolOutput(output: unknown): { value: unknown; truncated: boolean } | undefined {
  if (typeof output === "string") {
    return {
      value: truncateString(output, FULL_OUTPUT_PREVIEW_MAX_CHARS),
      truncated: output.length > FULL_OUTPUT_PREVIEW_MAX_CHARS,
    };
  }

  if (output === null || typeof output === "number" || typeof output === "boolean") {
    return { value: output, truncated: false };
  }

  if (typeof output === "object") {
    const json = JSON.stringify(output, null, 2);
    return {
      value: truncateString(json, FULL_OUTPUT_PREVIEW_MAX_CHARS),
      truncated: json.length > FULL_OUTPUT_PREVIEW_MAX_CHARS,
    };
  }

  return undefined;
}

function formatModeLabel(input: Record<string, unknown>): string {
  if (input.full === true) return "full";
  if (input.all === true) return "all";
  if (input.latest_turn === true) return "latest turn";
  return "last";
}

function buildToolSummary(tool: string | undefined, state: Record<string, unknown> | undefined): string | undefined {
  if (!tool || !state || typeof state.input !== "object" || state.input === null) {
    return typeof state?.title === "string" && state.title.length > 0 ? state.title : undefined;
  }

  const input = state.input as Record<string, unknown>;

  if (tool === "agent_create") {
    const title = typeof input.title === "string" ? input.title : undefined;
    return title ? `Create agent: ${title}` : "Create agent";
  }

  if (tool === "agent_read") {
    const agentId = typeof input.agent_id === "string" ? input.agent_id : "unknown";
    return `Read agent ${agentId} (${formatModeLabel(input)})`;
  }

  if (tool === "bash") {
    if (typeof input.description === "string" && input.description.length > 0) {
      return input.description;
    }
    if (typeof state.title === "string" && state.title.length > 0) {
      return state.title;
    }
    return "Run bash command";
  }

  if (tool === "read") {
    const filePath = typeof input.filePath === "string" ? input.filePath : "file";
    const offset = typeof input.offset === "number" ? `offset ${input.offset}` : undefined;
    const limit = typeof input.limit === "number" ? `limit ${input.limit}` : undefined;
    const suffix = [offset, limit].filter(Boolean).join(", ");
    return suffix ? `Read ${filePath} (${suffix})` : `Read ${filePath}`;
  }

  return typeof state.title === "string" && state.title.length > 0 ? state.title : undefined;
}

function filterSummaryForFull(summary: unknown): FilteredMessageSummary | undefined {
  if (typeof summary !== "object" || summary === null) {
    return undefined;
  }

  const diffs = Array.isArray((summary as { diffs?: unknown }).diffs)
    ? (summary as { diffs: unknown[] }).diffs
    : undefined;

  if (!diffs) {
    return undefined;
  }

  const filteredDiffs = diffs
    .filter((diff): diff is Record<string, unknown> => typeof diff === "object" && diff !== null)
    .map((diff) => {
      const filteredDiff: FilteredDiffSummary = {};

      if (typeof diff.file === "string") filteredDiff.file = diff.file;
      if (typeof diff.status === "string") filteredDiff.status = diff.status;
      if (typeof diff.additions === "number") filteredDiff.additions = diff.additions;
      if (typeof diff.deletions === "number") filteredDiff.deletions = diff.deletions;

      return filteredDiff;
    })
    .filter((diff) => Object.keys(diff).length > 0);

  return filteredDiffs.length > 0 ? { diffs: filteredDiffs } : undefined;
}

/**
 * Filter a single message to remove internal IDs, cost data, and UI-only metadata.
 *
 * Removes:
 * - All IDs (sessionID, messageID, parentID, callID)
 * - Cost and token data
 * - Mode and agent fields
 * - Step markers (step-start, step-finish)
 * - Tool metadata field
 *
 * Keeps:
 * - Role, time, model info
 * - Finish reason, path, summary
 * - Text, reasoning, tool calls (with input/output)
 * - File attachments
 */
export function filterMessage(message: Message, view: FilterView = "default"): FilteredMessage {
  // Filter info object - keep useful fields, remove internal IDs and cost data
  const filteredInfo: FilteredMessageInfo = {
    role: message.info.role,
    time: message.info.time,
  };

  // Add model info for assistant messages
  if ("modelID" in message.info) {
    filteredInfo.modelID = message.info.modelID;
    filteredInfo.providerID = message.info.providerID;
  }

  // Add model info for user messages (nested structure)
  if ("model" in message.info) {
    filteredInfo.model = message.info.model;
  }

  // Include optional fields if present (but not mode, agent, cost, tokens)
  if ("finish" in message.info) filteredInfo.finish = message.info.finish as string | undefined;
  if ("path" in message.info) filteredInfo.path = message.info.path as { cwd: string; root: string } | undefined;
  if ("summary" in message.info) {
    const summary = view === "full" ? filterSummaryForFull(message.info.summary) : message.info.summary;
    if (summary) {
      filteredInfo.summary = summary as FilteredMessageSummary;
    }
  }
  if ("error" in message.info)
    filteredInfo.error = message.info.error as
      | { name: string; message?: string; data?: { message: string } }
      | undefined;

  // Filter parts array
  const filteredParts = message.parts
    .filter((p) => {
      // Remove step markers (UI only) - these exist in DB but not in typed MessagePart
      const partType = (p as Record<string, unknown>).type;
      if (partType === "step-start" || partType === "step-finish") return false;
      if (view === "full" && FULL_VIEW_OMIT_PART_TYPES.has(String(partType))) return false;
      return true;
    })
    .map((p): FilteredMessagePart => {
      // Treat part as a generic record to access fields that may or may not exist
      const part = p as Record<string, unknown>;
      const filtered: FilteredMessagePart = {
        type: part.type as string,
      };

      if ((view === "full" || view === "tool_call") && typeof part.callID === "string") {
        filtered.callID = part.callID as string;
      }

      // Include relevant fields based on part type
      if ("text" in part) filtered.text = part.text as string;
      if ("time" in part) filtered.time = part.time as { start: number; end: number };
      if ("tool" in part) filtered.tool = part.tool as string;

      // Filter tool state - keep everything except metadata
      if ("state" in part && typeof part.state === "object" && part.state !== null) {
        if (view === "full") {
          const filteredToolState = filterToolStateForFull(part);
          if (filteredToolState) {
            filtered.state = filteredToolState;
          }
          const summary = buildToolSummary(filtered.tool, part.state as Record<string, unknown>);
          if (summary) {
            filtered.summary = summary;
          }
        } else {
          const { metadata, ...stateWithoutMetadata } = part.state as Record<string, unknown> & {
            metadata?: unknown;
          };
          filtered.state = stateWithoutMetadata;
        }
      }

      // Include other content types
      if ("mime" in part) filtered.mime = part.mime as string;
      if ("filename" in part) filtered.filename = part.filename as string;
      if ("url" in part) filtered.url = part.url as string;

      return filtered;
    });

  return {
    info: filteredInfo,
    parts: filteredParts,
  };
}

/**
 * Filter an array of messages for plugin consumption
 */
export function filterMessages(messages: Message[]): FilteredMessage[] {
  return messages.map((message) => filterMessage(message));
}

export function filterMessagesForView(messages: Message[], view: FilterView): FilteredMessage[] {
  return messages.map((message) => filterMessage(message, view));
}
