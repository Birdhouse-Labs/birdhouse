// ABOUTME: Renders read, write, and edit file operation tool calls as minimal one-line collapsibles
// ABOUTME: Shows file path and operation summary, with expandable content display

import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, FileText } from "lucide-solid";
import { type Component, createEffect, createMemo, createSignal, Show } from "solid-js";
import { resolvedCodeTheme } from "../../../theme";
import type { ToolBlock } from "../../../types/messages";
import CodeBlock from "../CodeBlock";
import EditDiffViewer from "../EditDiffViewer";

export interface FileOperationCardProps {
  block: ToolBlock;
}

interface FileDiffMetadata {
  before: string;
  after: string;
  file: string;
  additions: number;
  deletions: number;
}

const FileOperationCard: Component<FileOperationCardProps> = (props) => {
  // Persist expand state in sessionStorage (survives tab switches and page refreshes)
  // Use callID (from server) instead of id (client-generated, changes on remount)
  const storageKey = `birdhouse:toolExpanded:${props.block.callID}`;
  const savedState = sessionStorage.getItem(storageKey);

  const [isExpanded, setIsExpanded] = createSignal(savedState === "true");

  // Save expand state to sessionStorage (store on expand, delete on collapse)
  createEffect(() => {
    const expanded = isExpanded();

    if (expanded) {
      sessionStorage.setItem(storageKey, "true");
    } else {
      sessionStorage.removeItem(storageKey);
    }
  });

  // Determine operation type
  const isRead = () => props.block.name === "read";
  const isWrite = () => props.block.name === "write";
  const isEdit = () => props.block.name === "edit";

  // Extract file path from input
  const filePath = createMemo(() => {
    return (props.block.input["filePath"] as string) || "";
  });

  // Get workspace-relative path by stripping common workspace patterns
  const workspaceRelativePath = createMemo((): string => {
    const path = filePath();

    // Try to find workspace root by looking for common patterns
    // Match: /path/to/workspace/... -> keep everything after workspace name
    const workspaceMatch = path.match(/^(.*\/)([^/]+(?:-workspace|workspace))\/(.*)/);
    if (workspaceMatch?.[3]) {
      return workspaceMatch[3]; // Return path after workspace directory
    }

    // Fallback: If path has many segments, show last 3 (dir/subdir/file.ext)
    const parts = path.split("/").filter((p) => p.length > 0);
    if (parts.length > 3) {
      return parts.slice(-3).join("/");
    }

    return path;
  });

  // Display file path with tail truncation for long paths
  const displayFilePath = createMemo(() => {
    const path = workspaceRelativePath();
    const maxLength = 60;

    if (path.length <= maxLength) {
      return path;
    }

    // Truncate from the beginning and show tail
    return `...${path.slice(-(maxLength - 3))}`;
  });

  // Extract language from file extension for syntax highlighting
  const language = createMemo(() => {
    const path = filePath();
    const ext = path.split(".").pop()?.toLowerCase();

    const langMap: Record<string, string> = {
      ts: "typescript",
      tsx: "tsx",
      js: "javascript",
      jsx: "jsx",
      py: "python",
      rb: "ruby",
      go: "go",
      rs: "rust",
      java: "java",
      c: "c",
      cpp: "cpp",
      cs: "csharp",
      php: "php",
      sh: "bash",
      bash: "bash",
      zsh: "bash",
      yaml: "yaml",
      yml: "yaml",
      json: "json",
      md: "markdown",
      html: "html",
      css: "css",
      scss: "scss",
      sql: "sql",
      xml: "xml",
    };

    return langMap[ext || ""] || "text";
  });

  // Get operation-specific metadata
  const metadata = createMemo(() => {
    if (isRead()) {
      // For read operations, show file size and line count
      const output = props.block.output || "";
      const lines = output.split("\n");
      const fileSize = props.block.metadata?.["fileSize"] as number | undefined;

      return {
        lines: lines.length,
        fileSize,
        preview: lines.slice(0, 10).join("\n"),
      };
    }

    if (isWrite()) {
      // For write operations, show content size
      const content = (props.block.input["content"] as string) || "";
      return {
        size: content.length,
        lines: content.split("\n").length,
      };
    }

    if (isEdit()) {
      // For edit operations, show changes
      const oldString = (props.block.input["oldString"] as string) || "";
      const newString = (props.block.input["newString"] as string) || "";
      const replaceAll = props.block.input["replaceAll"] as boolean | undefined;

      return {
        oldString,
        newString,
        replaceAll,
        oldLines: oldString.split("\n").length,
        newLines: newString.split("\n").length,
      };
    }

    return null;
  });

  // Extract filediff from metadata for edit operations
  const fileDiffData = createMemo(() => {
    if (!isEdit() || !props.block.metadata) return null;
    const filediff = props.block.metadata["filediff"] as FileDiffMetadata | undefined;

    // Debug logging
    if (filediff) {
    }

    return filediff;
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

  // Operation label
  const operationLabel = () => {
    if (isRead()) return "Read from";
    if (isWrite()) return "Write to";
    if (isEdit()) return "Edit";
    return "";
  };

  // Summary for collapsed state
  const summary = createMemo(() => {
    if (isRead()) {
      const meta = metadata();
      if (meta?.fileSize) {
        return `${meta.lines} lines, ${formatBytes(meta.fileSize)}`;
      }
      return `${meta?.lines || 0} lines`;
    }

    if (isWrite()) {
      const meta = metadata();
      return `${meta?.lines || 0} lines, ${formatBytes(meta?.size || 0)}`;
    }

    if (isEdit()) {
      const meta = metadata();
      if (meta?.replaceAll) {
        return "Replace all occurrences";
      }
      const added = Math.max(0, (meta?.newLines || 0) - (meta?.oldLines || 0));
      const removed = Math.max(0, (meta?.oldLines || 0) - (meta?.newLines || 0));
      if (added > 0 && removed > 0) {
        return `+${added}, -${removed} lines`;
      }
      if (added > 0) {
        return `+${added} lines`;
      }
      if (removed > 0) {
        return `-${removed} lines`;
      }
      return "Modified";
    }

    return "";
  });

  // Format bytes for display
  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
  }

  // Get content for expanded view
  const expandedContent = createMemo(() => {
    if (isRead()) {
      return props.block.output || "";
    }

    if (isWrite()) {
      return (props.block.input["content"] as string) || "";
    }

    if (isEdit()) {
      // Return both old and new for diff display
      const meta = metadata();
      return {
        oldString: meta?.oldString || "",
        newString: meta?.newString || "",
      };
    }

    return "";
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
        {/* Icon: FileText normally, Chevron on hover */}
        <div class="flex-shrink-0 relative w-4 h-4">
          <div class="absolute inset-0 opacity-100 group-hover/toolcard:opacity-0 transition-opacity flex items-center justify-center">
            <FileText size={16} class="text-accent" />
          </div>
          <div class="absolute inset-0 opacity-0 group-hover/toolcard:opacity-100 transition-opacity flex items-center justify-center">
            {isExpanded() ? (
              <ChevronUp size={16} class="text-text-secondary" />
            ) : (
              <ChevronDown size={16} class="text-text-secondary" />
            )}
          </div>
        </div>

        {/* Operation type */}
        <span class="text-sm font-medium text-accent">{operationLabel()}</span>

        {/* File path */}
        <span class="text-sm text-text-primary truncate font-mono">{displayFilePath()}</span>

        {/* Summary - for edit operations show -/+ counts, for others show old summary */}
        <Show when={isEdit() && fileDiffData()}>
          <span class="text-xs">
            <span class="text-red-600 dark:text-red-400">-{fileDiffData()?.deletions}</span>{" "}
            <span class="text-green-600 dark:text-green-400">+{fileDiffData()?.additions}</span>
          </span>
        </Show>
        <Show when={!isEdit() && summary()}>
          <span class="text-xs text-text-muted">{summary()}</span>
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
          {/* Read operation: show full file content */}
          <Show when={isRead()}>
            <div class="border-l-4 border-accent/40 pl-3 py-1">
              <div class="text-xs text-text-secondary font-medium uppercase tracking-wide mb-2">File Content</div>
              <div class="rounded-md overflow-hidden border border-border">
                <div class="max-h-96 overflow-y-auto">
                  <CodeBlock code={expandedContent() as string} language={language()} theme={resolvedCodeTheme()} />
                </div>
              </div>
            </div>
          </Show>

          {/* Write operation: show content written */}
          <Show when={isWrite()}>
            <div class="border-l-4 border-accent/40 pl-3 py-1">
              <div class="text-xs text-text-secondary font-medium uppercase tracking-wide mb-2">Content Written</div>
              <div class="rounded-md overflow-hidden border border-border">
                <div class="max-h-96 overflow-y-auto">
                  <CodeBlock code={expandedContent() as string} language={language()} theme={resolvedCodeTheme()} />
                </div>
              </div>
            </div>
          </Show>

          {/* Edit operation: show before/after diff */}
          <Show when={isEdit()}>
            <Show
              when={
                props.block.status === "completed" &&
                fileDiffData() &&
                typeof fileDiffData()?.before === "string" &&
                typeof fileDiffData()?.after === "string"
              }
              fallback={
                // Fallback to old/new string display if full file diff not available
                <div class="border-l-4 border-accent/40 pl-3 py-1">
                  <div class="text-xs text-text-secondary font-medium uppercase tracking-wide mb-2">Changes</div>

                  {/* Old string (removed) */}
                  <div class="mb-3">
                    <div class="text-xs text-red-600 dark:text-red-400 font-medium mb-1">- Removed</div>
                    <div class="rounded-md overflow-hidden border border-red-500/30 bg-red-500/5">
                      <div class="max-h-48 overflow-y-auto">
                        <CodeBlock
                          code={(expandedContent() as { oldString: string; newString: string }).oldString}
                          language={language()}
                          theme={resolvedCodeTheme()}
                        />
                      </div>
                    </div>
                  </div>

                  {/* New string (added) */}
                  <div>
                    <div class="text-xs text-green-600 dark:text-green-400 font-medium mb-1">+ Added</div>
                    <div class="rounded-md overflow-hidden border border-green-500/30 bg-green-500/5">
                      <div class="max-h-48 overflow-y-auto">
                        <CodeBlock
                          code={(expandedContent() as { oldString: string; newString: string }).newString}
                          language={language()}
                          theme={resolvedCodeTheme()}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Replace all indicator */}
                  <Show when={metadata()?.replaceAll}>
                    <div class="text-xs text-text-muted mt-2">
                      <span class="font-medium">Note:</span> All occurrences replaced
                    </div>
                  </Show>
                </div>
              }
            >
              {/* Use EditDiffViewer for full file diff */}
              {/* biome-ignore lint/style/noNonNullAssertion: fileDiffData() is guaranteed non-null within Show block */}
              <EditDiffViewer before={fileDiffData()!.before} after={fileDiffData()!.after} filePath={filePath()} />

              {/* Replace all indicator */}
              <Show when={metadata()?.replaceAll}>
                <div class="text-xs text-text-muted mt-2">
                  <span class="font-medium">Note:</span> All occurrences replaced
                </div>
              </Show>
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

export default FileOperationCard;
