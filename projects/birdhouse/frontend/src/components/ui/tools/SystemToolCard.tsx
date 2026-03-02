// ABOUTME: Renders bash and webfetch tool calls as minimal one-line collapsibles
// ABOUTME: Shows command/URL with status codes, expandable to full input/output with syntax highlighting

import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Globe, Terminal } from "lucide-solid";
import { type Component, createMemo, createSignal, Show } from "solid-js";
import type { ToolBlock } from "../../../types/messages";
import CopyButton from "../CopyButton";

export interface SystemToolCardProps {
  block: ToolBlock;
}

const SystemToolCard: Component<SystemToolCardProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false);

  const isBash = () => props.block.name === "bash";
  const isWebfetch = () => props.block.name === "webfetch";

  // ============================================================================
  // BASH TOOL METADATA
  // ============================================================================

  // Extract bash command from input
  const bashCommand = createMemo(() => {
    if (!isBash()) return "";
    return (props.block.input["command"] as string) || "";
  });

  // Extract bash description (optional)
  const bashDescription = createMemo(() => {
    if (!isBash()) return "";
    return (props.block.input["description"] as string) || "";
  });

  // Extract exit code from metadata or parse from output
  const exitCode = createMemo(() => {
    if (!isBash()) return null;

    // Try metadata first
    const metadata = props.block.metadata;
    if (metadata?.["exitCode"] !== undefined) {
      return metadata["exitCode"] as number;
    }

    // If completed but no exit code in metadata, assume success
    if (props.block.status === "completed") {
      return 0;
    }

    // If error, assume non-zero exit
    if (props.block.status === "error") {
      return 1;
    }

    return null;
  });

  // Get bash output (use streaming output if running, final output if completed)
  const bashOutput = createMemo(() => {
    if (!isBash()) return "";

    // During running, check metadata.output for streaming updates
    if (props.block.status === "running" && props.block.metadata?.["output"]) {
      return props.block.metadata["output"] as string;
    }

    // When completed, use block.output
    return props.block.output || "";
  });

  // Preview: first 20 chars of output
  const _bashOutputPreview = createMemo(() => {
    const output = bashOutput();
    if (!output) return "";
    const firstLine = output.split("\n")[0];
    if (!firstLine) return "";
    return firstLine.length > 20 ? `${firstLine.substring(0, 17)}...` : firstLine;
  });

  // ============================================================================
  // WEBFETCH TOOL METADATA
  // ============================================================================

  // Extract URL from input
  const webfetchUrl = createMemo(() => {
    if (!isWebfetch()) return "";
    return (props.block.input["url"] as string) || "";
  });

  // Extract format from input
  const webfetchFormat = createMemo(() => {
    if (!isWebfetch()) return "markdown";
    return (props.block.input["format"] as string) || "markdown";
  });

  // Extract HTTP status code from metadata
  const httpStatusCode = createMemo(() => {
    if (!isWebfetch()) return null;

    const metadata = props.block.metadata;
    if (metadata?.["statusCode"] !== undefined) {
      return metadata["statusCode"] as number;
    }

    // If completed without status code, assume 200
    if (props.block.status === "completed") {
      return 200;
    }

    return null;
  });

  // Extract content type from metadata
  const contentType = createMemo(() => {
    if (!isWebfetch()) return null;

    const metadata = props.block.metadata;
    if (metadata?.["contentType"]) {
      return metadata["contentType"] as string;
    }

    return null;
  });

  // Get webfetch response body
  const webfetchResponse = createMemo(() => {
    if (!isWebfetch()) return "";

    // During running, check metadata for streaming updates
    if (props.block.status === "running" && props.block.metadata?.["output"]) {
      return props.block.metadata["output"] as string;
    }

    // When completed, use block.output
    return props.block.output || "";
  });

  // Preview: first 100 chars of response
  const webfetchResponsePreview = createMemo(() => {
    const response = webfetchResponse();
    if (!response) return "";
    return response.length > 100 ? `${response.substring(0, 97)}...` : response;
  });

  // Detect syntax highlighting language for response
  const syntaxLanguage = createMemo(() => {
    if (!isWebfetch()) return "text";

    const format = webfetchFormat();
    const ct = contentType();

    // Use format if specified
    if (format === "json") return "json";
    if (format === "html") return "html";
    if (format === "markdown") return "markdown";

    // Fall back to content type detection
    if (ct?.includes("json")) return "json";
    if (ct?.includes("html")) return "html";
    if (ct?.includes("markdown")) return "markdown";

    return "text";
  });

  // ============================================================================
  // SHARED METADATA
  // ============================================================================

  // Status icon (shared between bash and webfetch)
  const statusIcon = () => {
    // For bash, use exit code to determine success/failure
    if (isBash()) {
      const code = exitCode();
      if (code === null) {
        // Still running or pending
        if (props.block.status === "running") {
          return <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-accent" />;
        }
        return null;
      }
      // Exit code 0 = success, non-zero = failure
      return code === 0 ? (
        <CheckCircle2 size={16} class="text-green-600 dark:text-green-400" />
      ) : (
        <AlertCircle size={16} class="text-red-600 dark:text-red-400" />
      );
    }

    // For webfetch and others, use block.status
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
  // STATUS BADGE COMPONENTS
  // ============================================================================

  // Exit code badge for bash (green for 0, red for non-zero)
  const _ExitCodeBadge = () => {
    const code = exitCode();
    if (code === null) return null;

    const isSuccess = code === 0;
    return (
      <span
        class="px-1.5 py-0.5 text-xs font-mono rounded"
        classList={{
          "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400": isSuccess,
          "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400": !isSuccess,
        }}
      >
        exit {code}
      </span>
    );
  };

  // HTTP status code badge for webfetch (color coded by status class)
  const HttpStatusBadge = () => {
    const status = httpStatusCode();
    if (status === null) return null;

    // Determine color based on status code class
    const is2xx = status >= 200 && status < 300;
    const is3xx = status >= 300 && status < 400;
    const is4xx = status >= 400 && status < 500;
    const is5xx = status >= 500;

    return (
      <span
        class="px-1.5 py-0.5 text-xs font-mono rounded"
        classList={{
          "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400": is2xx,
          "bg-accent/10 text-accent": is3xx || is4xx,
          "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400": is5xx,
        }}
      >
        {status}
      </span>
    );
  };

  // ============================================================================
  // MAIN COMPONENT RENDER
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
        {/* Icon: Terminal/Globe normally, Chevron on hover */}
        <div class="flex-shrink-0 relative w-4 h-4">
          <div class="absolute inset-0 opacity-100 group-hover/toolcard:opacity-0 transition-opacity flex items-center justify-center">
            <Show when={isBash()}>
              <Terminal size={16} class="text-accent" />
            </Show>
            <Show when={isWebfetch()}>
              <Globe size={16} class="text-accent" />
            </Show>
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
        <span class="text-sm font-medium text-accent">{isBash() ? "bash" : "webfetch"}</span>

        {/* Command/URL */}
        <Show when={isBash()}>
          <span class="text-sm text-text-primary font-mono truncate">$ {bashCommand()}</span>
        </Show>
        <Show when={isWebfetch()}>
          <span class="text-sm text-text-primary truncate">{webfetchUrl()}</span>
        </Show>

        {/* Status badge (webfetch only) */}
        <Show when={isWebfetch()}>
          <HttpStatusBadge />
        </Show>

        {/* Content type (webfetch only) */}
        <Show when={isWebfetch() && contentType()}>
          <span class="text-xs text-text-muted">{contentType()}</span>
        </Show>

        {/* Response preview (webfetch only) */}
        <Show when={isWebfetch() && webfetchResponsePreview()}>
          <span class="text-xs text-text-muted truncate ml-2">{webfetchResponsePreview()}</span>
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
          {/* BASH: Input section (command) */}
          <Show when={isBash()}>
            <div class="border-l-4 border-accent/40 pl-3 py-1">
              <div class="flex items-center justify-between mb-1">
                <div class="text-xs text-text-secondary font-medium uppercase tracking-wide">Command</div>
                <CopyButton
                  text={bashCommand()}
                  label="Copy command"
                  data-ph-capture-attribute-button-type="copy-bash-command"
                  data-ph-capture-attribute-tool-name="bash"
                />
              </div>
              <div class="text-sm text-text-primary font-mono whitespace-pre-wrap break-words bg-surface-overlay p-2 rounded">
                {bashCommand()}
              </div>
              <Show when={bashDescription()}>
                <div class="text-xs text-text-muted mt-1 italic">{bashDescription()}</div>
              </Show>
            </div>
          </Show>

          {/* BASH: Output section */}
          <Show when={isBash() && bashOutput()}>
            <div class="border-l-4 border-accent/40 pl-3 py-1">
              <div class="flex items-center justify-between mb-1">
                <div class="text-xs text-text-secondary font-medium uppercase tracking-wide">
                  Output
                  <Show when={props.block.status === "running"}>
                    <span class="ml-2 text-accent">streaming...</span>
                  </Show>
                </div>
                <CopyButton
                  text={bashOutput()}
                  label="Copy output"
                  data-ph-capture-attribute-button-type="copy-bash-output"
                  data-ph-capture-attribute-tool-name="bash"
                />
              </div>
              <div class="text-sm text-text-primary font-mono whitespace-pre-wrap break-words bg-surface-overlay p-2 rounded max-h-96 overflow-y-auto">
                {bashOutput()}
              </div>
            </div>
          </Show>

          {/* WEBFETCH: URL section */}
          <Show when={isWebfetch()}>
            <div class="border-l-4 border-accent/40 pl-3 py-1">
              <div class="flex items-center justify-between mb-1">
                <div class="text-xs text-text-secondary font-medium uppercase tracking-wide">URL</div>
                <CopyButton
                  text={webfetchUrl()}
                  label="Copy URL"
                  data-ph-capture-attribute-button-type="copy-webfetch-url"
                  data-ph-capture-attribute-tool-name="webfetch"
                />
              </div>
              <div class="text-sm text-text-primary font-mono whitespace-pre-wrap break-words bg-surface-overlay p-2 rounded">
                {webfetchUrl()}
              </div>
              <div class="flex items-center gap-2 mt-1">
                <Show when={httpStatusCode()}>
                  <HttpStatusBadge />
                </Show>
                <Show when={contentType()}>
                  <span class="text-xs text-text-muted">{contentType()}</span>
                </Show>
                <Show when={webfetchFormat()}>
                  <span class="text-xs text-text-muted">format: {webfetchFormat()}</span>
                </Show>
              </div>
            </div>
          </Show>

          {/* WEBFETCH: Response section */}
          <Show when={isWebfetch() && webfetchResponse()}>
            <div class="border-l-4 border-accent/40 pl-3 py-1">
              <div class="flex items-center justify-between mb-1">
                <div class="text-xs text-text-secondary font-medium uppercase tracking-wide">
                  Response
                  <Show when={props.block.status === "running"}>
                    <span class="ml-2 text-accent">loading...</span>
                  </Show>
                </div>
                <CopyButton
                  text={webfetchResponse()}
                  label="Copy response"
                  data-ph-capture-attribute-button-type="copy-webfetch-response"
                  data-ph-capture-attribute-tool-name="webfetch"
                />
              </div>
              <div
                class="text-sm text-text-primary whitespace-pre-wrap break-words bg-surface-overlay p-2 rounded max-h-96 overflow-y-auto"
                data-language={syntaxLanguage()}
              >
                {webfetchResponse()}
              </div>
            </div>
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

export default SystemToolCard;
