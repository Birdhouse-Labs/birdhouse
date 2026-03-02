// ABOUTME: Renders glob and grep search tool calls as minimal one-line collapsibles
// ABOUTME: Shows search pattern, match count, and preview, with expandable results

import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Search } from "lucide-solid";
import { type Component, createMemo, createSignal, For, Show } from "solid-js";
import type { ToolBlock } from "../../../types/messages";

export interface SearchToolCardProps {
  block: ToolBlock;
}

// ============================================================================
// Result Parsing Types
// ============================================================================

interface GlobResult {
  pattern: string;
  files: string[];
  matchCount: number;
}

interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

interface GrepResult {
  pattern: string;
  matches: GrepMatch[];
  matchCount: number;
  fileCount: number;
}

// ============================================================================
// Component
// ============================================================================

const SearchToolCard: Component<SearchToolCardProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false);

  const isGlob = () => props.block.name === "glob";
  const isGrep = () => props.block.name === "grep";

  // ============================================================================
  // Output Parsing - Glob
  // ============================================================================

  const globResult = createMemo((): GlobResult | null => {
    if (!isGlob()) return null;

    const input = props.block.input;
    const pattern = (input["pattern"] as string) || "";

    // Parse output to extract file list
    const output = props.block.output || "";
    const files = output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return {
      pattern,
      files,
      matchCount: files.length,
    };
  });

  // ============================================================================
  // Output Parsing - Grep
  // ============================================================================

  const grepResult = createMemo((): GrepResult | null => {
    if (!isGrep()) return null;

    const input = props.block.input;
    const pattern = (input["pattern"] as string) || "";

    // Parse output to extract matches
    // Expected format: "file:line:content" or just "file" for file-only matches
    const output = props.block.output || "";
    const matches: GrepMatch[] = [];
    const fileSet = new Set<string>();

    const lines = output.split("\n").filter((line) => line.trim().length > 0);

    for (const line of lines) {
      // Try to parse "file:line:content" format
      const colonMatch = line.match(/^(.+?):(\d+):(.*)$/);
      if (colonMatch) {
        const [, file, lineNum, content] = colonMatch;
        // Ensure all destructured values are defined
        if (file && lineNum && content !== undefined) {
          matches.push({
            file,
            line: Number.parseInt(lineNum, 10),
            content: content.trim(),
          });
          fileSet.add(file);
        }
      } else {
        // Fallback: treat whole line as a file path
        const trimmed = line.trim();
        if (trimmed) {
          fileSet.add(trimmed);
        }
      }
    }

    return {
      pattern,
      matches,
      matchCount: matches.length,
      fileCount: fileSet.size,
    };
  });

  // ============================================================================
  // Display Helpers
  // ============================================================================

  // Get search type label
  const searchType = () => {
    if (isGlob()) return "Glob";
    if (isGrep()) return "Grep";
    return "Search";
  };

  // Get search pattern
  const searchPattern = () => {
    if (isGlob()) return globResult()?.pattern || "";
    if (isGrep()) return grepResult()?.pattern || "";
    return "";
  };

  // Get match count for display
  const matchCount = () => {
    if (isGlob()) return globResult()?.matchCount || 0;
    if (isGrep()) {
      const result = grepResult();
      return result?.matchCount || result?.fileCount || 0;
    }
    return 0;
  };

  // Get preview text (first few matches)
  const matchPreview = () => {
    if (isGlob()) {
      const result = globResult();
      if (!result || result.files.length === 0) return "No matches";

      const preview = result.files.slice(0, 3).join(", ");
      const remaining = result.files.length - 3;

      if (remaining > 0) {
        return `${preview}, +${remaining} more`;
      }
      return preview;
    }

    if (isGrep()) {
      const result = grepResult();
      if (!result || result.matches.length === 0) {
        return result?.fileCount ? `${result.fileCount} files` : "No matches";
      }

      const firstMatch = result.matches[0];
      if (!firstMatch) return "No matches";

      const preview = `${firstMatch.file}:${firstMatch.line}`;

      if (result.matches.length > 1) {
        return `${preview}, +${result.matches.length - 1} more`;
      }
      return preview;
    }

    return "";
  };

  // Status icon
  const statusIcon = () => {
    switch (props.block.status) {
      case "pending":
      case "running":
        return <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-accent" />;
      case "completed":
        return <CheckCircle2 size={16} class="text-green-600 dark:text-green-400" />;
      case "error":
        return <AlertCircle size={16} class="text-red-600 dark:text-red-400" />;
      default:
        return null;
    }
  };

  // Duration from metadata
  const duration = createMemo(() => {
    const ms = props.block.metadata?.["duration"] as number | undefined;
    return ms ? `${(ms / 1000).toFixed(1)}s` : undefined;
  });

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      class="my-2 overflow-hidden rounded-lg border group/toolcard transition-colors"
      classList={{
        "border-border": isExpanded(),
        "border-transparent hover:border-border": !isExpanded(),
      }}
    >
      {/* Header - one line */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded())}
        class="w-full px-3 py-2 flex items-center gap-2 bg-transparent hover:bg-surface-overlay/50 border-b border-transparent hover:border-border transition-colors"
        aria-expanded={isExpanded()}
      >
        {/* Icon: Search normally, Chevron on hover */}
        <div class="flex-shrink-0 relative w-4 h-4">
          <div class="absolute inset-0 opacity-100 group-hover/toolcard:opacity-0 transition-opacity flex items-center justify-center">
            <Search size={16} class="text-accent" />
          </div>
          <div class="absolute inset-0 opacity-0 group-hover/toolcard:opacity-100 transition-opacity flex items-center justify-center">
            {isExpanded() ? (
              <ChevronUp size={16} class="text-text-secondary" />
            ) : (
              <ChevronDown size={16} class="text-text-secondary" />
            )}
          </div>
        </div>

        {/* Type label */}
        <span class="text-sm font-medium text-accent">{searchType()}</span>

        {/* Search pattern */}
        <code class="text-sm text-text-primary font-mono bg-surface-overlay px-1.5 py-0.5 rounded">
          {searchPattern()}
        </code>

        {/* Match count badge */}
        <Show when={props.block.status === "completed"}>
          <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
            {matchCount()} {matchCount() === 1 ? "match" : "matches"}
          </span>
        </Show>

        {/* Match preview */}
        <Show when={!isExpanded() && props.block.status === "completed"}>
          <span class="text-xs text-text-muted truncate ml-2 font-mono max-w-[300px]">{matchPreview()}</span>
        </Show>

        {/* Duration and status on the right */}
        <div class="ml-auto flex items-center gap-2">
          <Show when={duration()}>
            <span class="text-xs text-text-muted">{duration()}</span>
          </Show>
          <span class="text-sm">{statusIcon()}</span>
        </div>
      </button>

      {/* Expanded content */}
      <Show when={isExpanded()}>
        <div class="px-3 py-3 space-y-3 bg-surface-raised max-h-96 overflow-y-auto">
          {/* Glob results - file list */}
          <Show when={isGlob() && globResult()}>
            {(result) => (
              <>
                <Show when={result().files.length > 0}>
                  <div class="border-l-4 border-accent/40 pl-3 py-1">
                    <div class="text-xs text-text-secondary font-medium uppercase tracking-wide mb-2">
                      Matched Files ({result().files.length})
                    </div>
                    <div class="space-y-1">
                      <For each={result().files}>
                        {(file) => <div class="text-sm font-mono text-text-primary">{file}</div>}
                      </For>
                    </div>
                  </div>
                </Show>
                <Show when={result().files.length === 0}>
                  <div class="text-sm text-text-muted italic">No files matched pattern "{result().pattern}"</div>
                </Show>
              </>
            )}
          </Show>

          {/* Grep results - matches with line numbers */}
          <Show when={isGrep() && grepResult()}>
            {(result) => (
              <>
                <Show when={result().matches.length > 0}>
                  <div class="border-l-4 border-accent/40 pl-3 py-1">
                    <div class="text-xs text-text-secondary font-medium uppercase tracking-wide mb-2">
                      Matches ({result().matches.length} in {result().fileCount}{" "}
                      {result().fileCount === 1 ? "file" : "files"})
                    </div>
                    <div class="space-y-2">
                      <For each={result().matches}>
                        {(match) => (
                          <div class="text-sm">
                            <div class="font-mono text-text-secondary">
                              <span class="text-accent">{match.file}</span>
                              <span class="text-text-muted">:</span>
                              <span class="text-accent">{match.line}</span>
                            </div>
                            <Show when={match.content}>
                              <div class="font-mono text-text-primary ml-2 mt-0.5">{match.content}</div>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
                <Show when={result().matches.length === 0 && result().fileCount === 0}>
                  <div class="text-sm text-text-muted italic">No matches found for pattern "{result().pattern}"</div>
                </Show>
                <Show when={result().matches.length === 0 && result().fileCount > 0}>
                  <div class="text-sm text-text-muted italic">
                    {result().fileCount} {result().fileCount === 1 ? "file" : "files"} matched (no line details
                    available)
                  </div>
                </Show>
              </>
            )}
          </Show>

          {/* Error message if present */}
          <Show when={props.block.error}>
            <div class="text-sm text-red-600 dark:text-red-400">
              <span class="font-medium">Error: </span>
              {props.block.error}
            </div>
          </Show>

          {/* Raw output fallback for other statuses */}
          <Show when={props.block.status === "running" && props.block.output}>
            <div class="border-l-4 border-accent/40 pl-3 py-1">
              <div class="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">
                Output (streaming...)
              </div>
              <div class="text-sm font-mono text-text-primary whitespace-pre-wrap break-words">
                {props.block.output}
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default SearchToolCard;
