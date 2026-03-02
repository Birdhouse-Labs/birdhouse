// ABOUTME: Renders tool/function call execution with separate input and output sections
// ABOUTME: Shows tool name, status icon, input parameters, streaming output, and copy buttons

import { type Component, createMemo, createSignal, Show, Suspense } from "solid-js";
import { borderColor, cardSurface } from "../../styles/containerStyles";
import { codeTheme, isDark } from "../../theme";
import { resolveCodeTheme } from "../../theme/codeThemes";
import type { ToolBlock } from "../../types/messages";
import Button from "./Button";
import CodeBlock from "./CodeBlock";
import ContentDialog from "./ContentDialog";
import CopyButton from "./CopyButton";
import EditDiffViewer from "./EditDiffViewer";

export interface ToolCallCardProps {
  block: ToolBlock;
}

const ToolCallCard: Component<ToolCallCardProps> = (props) => {
  // Dialog state
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [dialogTitle, setDialogTitle] = createSignal("");
  const [dialogContent, setDialogContent] = createSignal("");
  const [dialogLanguage, setDialogLanguage] = createSignal("text");

  const openDialog = (title: string, content: string, language: string) => {
    setDialogTitle(title);
    setDialogContent(content);
    setDialogLanguage(language);
    setDialogOpen(true);
  };

  const statusIcons = {
    pending: <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-accent" />,
    running: <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-accent" />,
    completed: "✅",
    error: "❌",
  };

  const duration = createMemo(() => {
    const ms = props.block.metadata?.["duration"] as number | undefined;
    return ms ? `${(ms / 1000).toFixed(1)}s` : undefined;
  });

  // Format input for display based on tool type
  const formattedInput = createMemo(() => {
    if (props.block.name === "bash") {
      // For bash, show command
      const cmd = props.block.input["command"] as string;
      return { text: `$ ${cmd}`, language: "bash" };
    }
    // For other tools, show relevant params as JSON
    return {
      text: JSON.stringify(props.block.input, null, 2),
      language: "json",
    };
  });

  // Input display info (first 10 lines - start of command is most important)
  const inputDisplayInfo = createMemo(() => {
    const inputLines = formattedInput().text.split("\n");
    const totalLines = inputLines.length;
    const displayLines = inputLines.slice(0, 10);

    return {
      displayText: displayLines.join("\n"),
      totalLines,
      hasMore: totalLines > 10,
      moreCount: Math.max(0, totalLines - 10),
    };
  });

  // Get current output - check metadata.output during running, output when completed
  const currentOutput = createMemo(() => {
    // During running, output streams into metadata.output
    if (props.block.status === "running") {
      const metadataOutput = props.block.metadata?.["output"];
      if (typeof metadataOutput === "string") {
        return metadataOutput;
      }
    }
    // When completed, output is in the output field
    return props.block.output || "";
  });

  // Output display info (last 10 lines)
  const outputDisplayInfo = createMemo(() => {
    const output = currentOutput();
    const outputLines = output.split("\n");
    const totalLines = outputLines.length;
    const displayLines = outputLines.slice(-10);

    return {
      displayText: displayLines.join("\n"),
      totalLines,
      hasMore: totalLines > 10,
      moreCount: Math.max(0, totalLines - 10),
    };
  });

  const resolvedTheme = createMemo(() => resolveCodeTheme(codeTheme(), isDark()));

  const hasOutput = createMemo(() => {
    return currentOutput().trim().length > 0;
  });

  // Check if input has actual data (not just empty object)
  const hasInput = createMemo(() => {
    return Object.keys(props.block.input).length > 0;
  });

  // Check if this is an edit tool with diff data
  const hasDiffData = createMemo(() => {
    if (props.block.name !== "edit" || props.block.status !== "completed") {
      return false;
    }
    const filediff = props.block.metadata?.["filediff"] as { before: string; after: string; file: string } | undefined;
    return filediff && typeof filediff.before === "string" && typeof filediff.after === "string";
  });

  // Extract diff data for rendering
  const diffData = createMemo(() => {
    if (!hasDiffData()) return null;
    const filediff = props.block.metadata?.["filediff"] as {
      before: string;
      after: string;
      file: string;
      additions: number;
      deletions: number;
    };
    return filediff;
  });

  return (
    <div class={`my-2 rounded-lg ${cardSurface} overflow-hidden`}>
      {/* Header: tool name on left, status icon + duration on right */}
      <div class="px-3 py-2 bg-surface-overlay border-b border-accent flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="font-mono text-sm text-accent font-medium">{props.block.name}</span>
          <Show when={props.block.title}>
            <span class="text-sm text-text-secondary">{props.block.title}</span>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <Show when={duration()}>
            <span class="text-xs text-text-muted">{duration()}</span>
          </Show>
          <span class="text-sm">{statusIcons[props.block.status]}</span>
        </div>
      </div>

      {/* Input Section - only show if there's input */}
      <Show when={hasInput()}>
        <div class={`border-b ${borderColor}`}>
          <div class="px-3 py-1 bg-surface-overlay flex items-center justify-between">
            <span class="text-xs text-text-muted font-medium">
              Input{inputDisplayInfo().hasMore && ` (first 10 lines)`}
            </span>
            <CopyButton text={formattedInput().text} />
          </div>
          <div class="overflow-hidden">
            <Suspense fallback={<div class="h-20 bg-surface-raised animate-pulse" />}>
              <CodeBlock
                code={inputDisplayInfo().displayText}
                language={formattedInput().language}
                theme={resolvedTheme()}
                highlightingEnabled={props.block.status !== "running"}
              />
            </Suspense>
          </div>
          {/* View full input button */}
          <Show when={inputDisplayInfo().hasMore}>
            <div class={`px-3 py-2 border-t ${borderColor}`}>
              <Button
                variant="tertiary"
                onClick={() => openDialog("Input", formattedInput().text, formattedInput().language)}
              >
                View full input ({inputDisplayInfo().moreCount} more{" "}
                {inputDisplayInfo().moreCount === 1 ? "line" : "lines"})
              </Button>
            </div>
          </Show>
        </div>
      </Show>

      {/* Diff Section - show visual diff for edit tools */}
      <Show when={hasDiffData() && diffData()}>
        {(data) => (
          <div class={`border-b ${borderColor}`}>
            <div class="px-3 py-1 bg-surface-overlay flex items-center justify-between">
              <span class="text-xs text-text-muted font-medium">
                Changes
                <span class="ml-2 text-green-600 dark:text-green-400">+{data().additions}</span>
                <span class="ml-1 text-red-600 dark:text-red-400">-{data().deletions}</span>
              </span>
            </div>
            <div class="overflow-hidden">
              <Suspense fallback={<div class="h-40 bg-surface-raised animate-pulse" />}>
                <EditDiffViewer before={data().before} after={data().after} filePath={data().file} />
              </Suspense>
            </div>
          </div>
        )}
      </Show>

      {/* Output Section - only show if there's output */}
      <Show when={hasOutput()}>
        <div class={`border-b ${borderColor}`}>
          <div class="px-3 py-1 bg-surface-overlay flex items-center justify-between">
            <span class="text-xs text-text-muted font-medium">
              Output (last 10 lines)
              {props.block.status === "running" && " - Streaming..."}
            </span>
            <CopyButton text={currentOutput()} />
          </div>
          <div class="overflow-hidden">
            <Suspense fallback={<div class="h-20 bg-surface-raised animate-pulse" />}>
              <CodeBlock
                code={outputDisplayInfo().displayText}
                language="text"
                theme={resolvedTheme()}
                highlightingEnabled={props.block.status !== "running"}
              />
            </Suspense>
          </div>
        </div>
      </Show>

      {/* Error Section */}
      <Show when={props.block.error}>
        <div class="px-3 py-2 bg-red-500/5 border-b border-red-500/20">
          <div class="text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
            <span class="flex-shrink-0">⚠️</span>
            <span class="break-words">{props.block.error}</span>
          </div>
        </div>
      </Show>

      {/* Footer - View full output button */}
      <Show when={outputDisplayInfo().hasMore && props.block.status === "completed"}>
        <div class="px-3 py-2">
          <Button variant="tertiary" onClick={() => openDialog("Output", currentOutput(), "text")}>
            View full output ({outputDisplayInfo().moreCount} more{" "}
            {outputDisplayInfo().moreCount === 1 ? "line" : "lines"})
          </Button>
        </div>
      </Show>

      {/* Content Dialog */}
      <ContentDialog
        open={dialogOpen()}
        onOpenChange={setDialogOpen}
        title={dialogTitle()}
        content={dialogContent()}
        language={dialogLanguage()}
      />
    </div>
  );
};

export default ToolCallCard;
