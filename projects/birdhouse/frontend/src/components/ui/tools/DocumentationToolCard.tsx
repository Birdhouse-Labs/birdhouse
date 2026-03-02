// ABOUTME: Renders context7_resolve-library-id and context7_query-docs tool calls as collapsible cards
// ABOUTME: Shows library matching and documentation query results with code snippets

import { AlertCircle, BookOpen, CheckCircle2, ChevronDown, ChevronUp } from "lucide-solid";
import { type Component, createMemo, createSignal, For, Show } from "solid-js";
import { resolvedCodeTheme } from "../../../theme";
import type { ToolBlock } from "../../../types/messages";
import CodeBlock from "../CodeBlock";

export interface DocumentationToolCardProps {
  block: ToolBlock;
}

// ============================================================================
// Type definitions for Context7 API responses
// ============================================================================

interface LibraryMatch {
  id: string;
  name: string;
  description?: string;
  reputation?: "High" | "Medium" | "Low";
  benchmarkScore?: number;
  codeSnippetCount?: number;
}

interface ResolveLibraryOutput {
  libraries?: LibraryMatch[];
  selectedLibrary?: LibraryMatch;
  message?: string;
}

interface DocumentationResult {
  title?: string;
  description?: string;
  code?: string;
  language?: string;
  signature?: string;
  url?: string;
}

interface QueryDocsOutput {
  results?: DocumentationResult[];
  resultCount?: number;
  message?: string;
}

// ============================================================================
// Component
// ============================================================================

const DocumentationToolCard: Component<DocumentationToolCardProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false);

  const isResolveLibrary = () => props.block.name === "context7_resolve-library-id";
  const isQueryDocs = () => props.block.name === "context7_query-docs";

  // Extract metadata from input
  const metadata = createMemo(() => {
    const input = props.block.input;

    if (isResolveLibrary()) {
      return {
        libraryName: (input["libraryName"] as string) || "",
        query: (input["query"] as string) || "",
      };
    }

    if (isQueryDocs()) {
      return {
        libraryId: (input["libraryId"] as string) || "",
        query: (input["query"] as string) || "",
      };
    }

    return null;
  });

  // Parse output for resolve-library-id
  const resolveOutput = createMemo<ResolveLibraryOutput | null>(() => {
    if (!isResolveLibrary() || !props.block.output) return null;

    try {
      const parsed = JSON.parse(props.block.output);
      return parsed;
    } catch {
      // If not JSON, try to extract info from text
      const output = props.block.output;
      const match = output.match(/Selected library: (.+)/);
      if (match) {
        return {
          message: output,
          selectedLibrary: { id: match[1], name: match[1] },
        };
      }
      return { message: output };
    }
  });

  // Parse output for query-docs
  const queryOutput = createMemo<QueryDocsOutput | null>(() => {
    if (!isQueryDocs() || !props.block.output) return null;

    try {
      const parsed = JSON.parse(props.block.output);
      return parsed;
    } catch {
      // If not JSON, return as message
      return { message: props.block.output };
    }
  });

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

  // Get reputation color
  const getReputationColor = (reputation?: string) => {
    switch (reputation) {
      case "High":
        return "text-green-600 dark:text-green-400";
      case "Medium":
        return "text-accent";
      case "Low":
        return "text-text-muted";
      default:
        return "text-text-muted";
    }
  };

  // Header preview text
  const headerPreview = createMemo(() => {
    if (isResolveLibrary()) {
      const output = resolveOutput();
      if (output?.selectedLibrary) {
        return `→ ${output.selectedLibrary.id}`;
      }
      if (output?.libraries && output.libraries.length > 0) {
        return `${output.libraries.length} match${output.libraries.length === 1 ? "" : "es"}`;
      }
    }

    if (isQueryDocs()) {
      const output = queryOutput();
      if (output?.resultCount) {
        return `${output.resultCount} result${output.resultCount === 1 ? "" : "s"}`;
      }
      if (output?.results && output.results.length > 0) {
        return `${output.results.length} result${output.results.length === 1 ? "" : "s"}`;
      }
    }

    return null;
  });

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
        {/* Icon: BookOpen normally, Chevron on hover */}
        <div class="flex-shrink-0 relative w-4 h-4">
          <div class="absolute inset-0 opacity-100 group-hover/toolcard:opacity-0 transition-opacity flex items-center justify-center">
            <BookOpen size={16} class="text-accent" />
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
        <span class="text-sm font-medium text-accent">{isResolveLibrary() ? "Library ID" : "Query Docs"}</span>

        {/* Library name or ID */}
        <Show when={isResolveLibrary()}>
          <span class="text-sm text-text-primary truncate">{metadata()?.libraryName}</span>
        </Show>
        <Show when={isQueryDocs()}>
          <span class="text-sm text-text-primary truncate">{metadata()?.libraryId}</span>
        </Show>

        {/* Preview info */}
        <Show when={headerPreview()}>
          <span class="text-xs text-text-secondary ml-auto">{headerPreview()}</span>
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
        <div class="px-3 py-3 space-y-3 bg-surface-raised">
          {/* Query string (for both tools) */}
          <Show when={metadata()?.query}>
            <div class="border-l-4 border-accent/40 pl-3 py-1">
              <div class="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Query</div>
              <div class="text-sm text-text-primary whitespace-pre-wrap break-words">{metadata()?.query}</div>
            </div>
          </Show>

          {/* Resolve Library Results */}
          <Show when={isResolveLibrary() && resolveOutput()}>
            {/* Selected Library */}
            <Show when={resolveOutput()?.selectedLibrary}>
              <div class="border-l-4 border-green-500/40 pl-3 py-1">
                <div class="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Selected Library</div>
                <div class="space-y-2">
                  <div class="text-sm font-medium text-text-primary">{resolveOutput()?.selectedLibrary?.name}</div>
                  <div class="text-xs font-mono text-accent">{resolveOutput()?.selectedLibrary?.id}</div>
                  <Show when={resolveOutput()?.selectedLibrary?.description}>
                    <div class="text-sm text-text-secondary">{resolveOutput()?.selectedLibrary?.description}</div>
                  </Show>
                  <div class="flex gap-3 text-xs">
                    <Show when={resolveOutput()?.selectedLibrary?.reputation}>
                      <span class={getReputationColor(resolveOutput()?.selectedLibrary?.reputation)}>
                        Reputation: {resolveOutput()?.selectedLibrary?.reputation}
                      </span>
                    </Show>
                    <Show when={resolveOutput()?.selectedLibrary?.benchmarkScore !== undefined}>
                      <span class="text-text-muted">Score: {resolveOutput()?.selectedLibrary?.benchmarkScore}</span>
                    </Show>
                    <Show when={resolveOutput()?.selectedLibrary?.codeSnippetCount !== undefined}>
                      <span class="text-text-muted">
                        {resolveOutput()?.selectedLibrary?.codeSnippetCount} code snippet
                        {resolveOutput()?.selectedLibrary?.codeSnippetCount === 1 ? "" : "s"}
                      </span>
                    </Show>
                  </div>
                </div>
              </div>
            </Show>

            {/* All matched libraries */}
            <Show when={resolveOutput()?.libraries && (resolveOutput()?.libraries?.length ?? 0) > 0}>
              <div class="border-l-4 border-accent/40 pl-3 py-1">
                <div class="text-xs text-text-secondary font-medium uppercase tracking-wide mb-2">
                  All Matches ({resolveOutput()?.libraries?.length})
                </div>
                <div class="space-y-3 max-h-96 overflow-y-auto">
                  <For each={resolveOutput()?.libraries}>
                    {(library) => (
                      <div class="p-2 rounded bg-surface-overlay/50 space-y-1">
                        <div class="text-sm font-medium text-text-primary">{library.name}</div>
                        <div class="text-xs font-mono text-accent">{library.id}</div>
                        <Show when={library.description}>
                          <div class="text-xs text-text-secondary">{library.description}</div>
                        </Show>
                        <div class="flex gap-3 text-xs">
                          <Show when={library.reputation}>
                            <span class={getReputationColor(library.reputation)}>{library.reputation}</span>
                          </Show>
                          <Show when={library.benchmarkScore !== undefined}>
                            <span class="text-text-muted">Score: {library.benchmarkScore}</span>
                          </Show>
                          <Show when={library.codeSnippetCount !== undefined}>
                            <span class="text-text-muted">{library.codeSnippetCount} snippets</span>
                          </Show>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Message fallback */}
            <Show when={resolveOutput()?.message && !resolveOutput()?.selectedLibrary && !resolveOutput()?.libraries}>
              <div class="border-l-4 border-accent/40 pl-3 py-1">
                <div class="text-sm text-text-primary whitespace-pre-wrap break-words">{resolveOutput()?.message}</div>
              </div>
            </Show>
          </Show>

          {/* Query Docs Results */}
          <Show when={isQueryDocs() && queryOutput()}>
            {/* Documentation results */}
            <Show when={queryOutput()?.results && (queryOutput()?.results?.length ?? 0) > 0}>
              <div class="border-l-4 border-accent/40 pl-3 py-1">
                <div class="text-xs text-text-secondary font-medium uppercase tracking-wide mb-2">
                  Documentation ({queryOutput()?.results?.length} result
                  {queryOutput()?.results?.length === 1 ? "" : "s"})
                </div>
                <div class="space-y-4 max-h-96 overflow-y-auto">
                  <For each={queryOutput()?.results}>
                    {(result) => (
                      <div class="space-y-2">
                        {/* Title */}
                        <Show when={result.title}>
                          <div class="text-sm font-medium text-text-primary">{result.title}</div>
                        </Show>

                        {/* Signature */}
                        <Show when={result.signature}>
                          <div class="text-xs font-mono text-accent bg-surface-overlay/50 px-2 py-1 rounded">
                            {result.signature}
                          </div>
                        </Show>

                        {/* Description */}
                        <Show when={result.description}>
                          <div class="text-sm text-text-secondary">{result.description}</div>
                        </Show>

                        {/* Code snippet */}
                        <Show when={result.code}>
                          <div class="rounded border border-border overflow-hidden">
                            <CodeBlock
                              code={result.code || ""}
                              language={result.language || "typescript"}
                              theme={resolvedCodeTheme()}
                            />
                          </div>
                        </Show>

                        {/* External link */}
                        <Show when={result.url}>
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-xs text-accent hover:underline"
                          >
                            View documentation →
                          </a>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Message fallback */}
            <Show when={queryOutput()?.message && (!queryOutput()?.results || queryOutput()?.results?.length === 0)}>
              <div class="border-l-4 border-accent/40 pl-3 py-1">
                <div class="text-sm text-text-primary whitespace-pre-wrap break-words">{queryOutput()?.message}</div>
              </div>
            </Show>
          </Show>

          {/* Error message if present */}
          <Show when={props.block.error}>
            <div class="text-sm text-red-600 dark:text-red-400">
              <span class="font-medium">Error: </span>
              {props.block.error}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default DocumentationToolCard;
