// ABOUTME: Public API for OpenCode message adapters
// ABOUTME: Exports main adapter functions for converting API responses to UI types

// Main message adapters
export { mapMessage, mapMessages } from "./message-adapter";
export { mapFilePart } from "./part-adapters/file-adapter";
export { mapReasoningPart } from "./part-adapters/reasoning-adapter";
// Individual part adapters (for specialized use cases)
export { mapTextPart } from "./part-adapters/text-adapter";
export { mapToolPart } from "./part-adapters/tool-adapter";

// Utility functions (if needed externally)
export {
  formatDuration,
  formatTimestamp,
  parseTimestamp,
} from "./utils/time-utils";
