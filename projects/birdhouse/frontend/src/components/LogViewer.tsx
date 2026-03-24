// ABOUTME: Self-contained log viewer component with a trigger button and dialog
// ABOUTME: Polls /api/logs/recent while open, supports search, source filtering, and raw expansion

import Dialog from "corvu/dialog";
import { Check, ClipboardCopy, RefreshCw, ScrollText, X } from "lucide-solid";
import { type Component, createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { useZIndex } from "../contexts/ZIndexContext";
import { fetchRecentLogs } from "../services/workspaces-api";
import type { LogLine } from "../types/workspace";
import type { ButtonVariant } from "./ui/Button";
import Button from "./ui/Button";

// How often to poll for new logs while the dialog is open (ms)
const POLL_INTERVAL_MS = 5_000;

export interface LogViewerProps {
  workspaceId?: string;
  buttonLabel?: string;
  buttonVariant?: "secondary" | "tertiary";
}

type SourceFilter = "all" | "birdhouse" | "opencode";

/** Format an ISO timestamp string as HH:MM:SS */
export function formatTime(isoTime: string): string {
  try {
    const d = new Date(isoTime);
    return d.toTimeString().slice(0, 8);
  } catch {
    return isoTime;
  }
}

/** Filter log lines by search text and source. Exported for testing. */
export function filterLines(lines: LogLine[], search: string, source: SourceFilter): LogLine[] {
  const q = search.toLowerCase();
  return lines.filter((line) => {
    if (source !== "all" && line.source !== source) return false;
    if (q && !line.msg.toLowerCase().includes(q) && !line.raw.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Return Tailwind class for a log level dot */
function levelColorClass(level: string): string {
  switch (level.toLowerCase()) {
    case "error":
    case "fatal":
      return "bg-danger";
    case "warn":
      return "bg-warning";
    case "info":
      return "bg-text-secondary";
    case "debug":
    case "trace":
    default:
      return "bg-text-muted";
  }
}

const LogViewer: Component<LogViewerProps> = (props) => {
  const baseZIndex = useZIndex();

  const [open, setOpen] = createSignal(false);
  const [lines, setLines] = createSignal<LogLine[]>([]);
  const [truncated, setTruncated] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [search, setSearch] = createSignal("");
  const [sourceFilter, setSourceFilter] = createSignal<SourceFilter>("all");
  const [expandedKeys, setExpandedKeys] = createSignal<Set<string>>(new Set());
  const [copied, setCopied] = createSignal(false);
  const [autoScroll, setAutoScroll] = createSignal(true);

  // Ref for the log list container — used to scroll to bottom after updates
  let listRef: HTMLDivElement | undefined;

  const loadLogs = async () => {
    try {
      setError(null);
      const result = await fetchRecentLogs(props.workspaceId);
      setLines(result.lines);
      setTruncated(result.truncated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
      // Scroll to bottom only when auto-scroll is enabled
      if (autoScroll()) {
        queueMicrotask(() => {
          if (listRef) {
            listRef.scrollTop = listRef.scrollHeight;
          }
        });
      }
    }
  };

  // Start/stop polling based on dialog open state
  createEffect(() => {
    if (!open()) return;

    setLoading(true);
    setExpandedKeys(new Set<string>());
    setAutoScroll(true);
    loadLogs();

    const interval = setInterval(loadLogs, POLL_INTERVAL_MS);
    onCleanup(() => clearInterval(interval));
  });

  // Reset filter/search when dialog closes
  createEffect(() => {
    if (!open()) {
      setSearch("");
      setSourceFilter("all");
    }
  });

  const filteredLines = createMemo(() => filterLines(lines(), search(), sourceFilter()));

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleCopyAll = () => {
    const text = filteredLines()
      .map((l) => `${formatTime(l.time)} [${l.level.toUpperCase()}] [${l.subsystem}] ${l.msg}`)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const buttonLabel = () => props.buttonLabel ?? "View Logs";
  const buttonVariant = (): ButtonVariant => props.buttonVariant ?? "secondary";

  return (
    <>
      <Button variant={buttonVariant()} leftIcon={<ScrollText size={14} />} onClick={() => setOpen(true)}>
        {buttonLabel()}
      </Button>

      <Dialog open={open()} onOpenChange={setOpen} preventScroll={false} restoreScrollPosition={false}>
        <Dialog.Portal>
          <Dialog.Overlay class="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ "z-index": baseZIndex }} />
          <Dialog.Content
            class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col rounded-2xl bg-surface-raised border border-border shadow-2xl w-[80vw] h-[70vh] max-w-5xl"
            style={{ "z-index": baseZIndex }}
          >
            {/* Header */}
            <div class="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
              <Dialog.Label class="text-base font-semibold text-heading">Logs</Dialog.Label>
              <div class="flex items-center gap-2">
                {/* Copy all */}
                <button
                  type="button"
                  title="Copy all"
                  class="text-text-muted hover:text-text-primary transition-colors rounded p-1 w-8 h-8 flex items-center justify-center"
                  onClick={handleCopyAll}
                >
                  <Show when={copied()} fallback={<ClipboardCopy size={15} />}>
                    <Check size={15} class="text-success" />
                  </Show>
                </button>
                {/* Refresh */}
                <button
                  type="button"
                  title="Refresh"
                  class="text-text-muted hover:text-text-primary transition-colors rounded p-1 w-8 h-8 flex items-center justify-center"
                  onClick={() => {
                    setLoading(true);
                    loadLogs();
                  }}
                >
                  <RefreshCw size={15} />
                </button>
                {/* Close */}
                <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors rounded p-1 w-8 h-8 flex items-center justify-center">
                  <X size={15} />
                </Dialog.Close>
              </div>
            </div>

            {/* Toolbar: search + source chips + auto-scroll toggle */}
            <div class="flex items-center gap-3 px-5 py-2.5 border-b border-border flex-shrink-0">
              <input
                type="text"
                placeholder="Search logs..."
                class="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
              />
              <div class="flex items-center gap-1.5">
                <SourceChip label="All" active={sourceFilter() === "all"} onClick={() => setSourceFilter("all")} />
                <SourceChip
                  label="Birdhouse"
                  active={sourceFilter() === "birdhouse"}
                  onClick={() => setSourceFilter("birdhouse")}
                />
                <Show when={props.workspaceId}>
                  <SourceChip
                    label="OpenCode"
                    active={sourceFilter() === "opencode"}
                    onClick={() => setSourceFilter("opencode")}
                  />
                </Show>
              </div>
              {/* Auto-scroll toggle */}
              <label class="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer select-none flex-shrink-0">
                <input
                  type="checkbox"
                  checked={autoScroll()}
                  onChange={(e) => setAutoScroll(e.currentTarget.checked)}
                  class="w-3 h-3 accent-accent"
                />
                Auto-scroll
              </label>
            </div>

            {/* Log list */}
            <div ref={listRef} class="flex-1 overflow-y-auto font-mono text-xs">
              <Show when={loading() && lines().length === 0}>
                <div class="flex items-center justify-center h-full text-text-muted">Loading...</div>
              </Show>

              <Show when={error()}>
                <div class="flex items-center justify-center h-full text-danger">Failed to load logs: {error()}</div>
              </Show>

              <Show when={!loading() && !error() && filteredLines().length === 0 && lines().length > 0}>
                <div class="flex items-center justify-center h-full text-text-muted">No logs match your filter.</div>
              </Show>

              <Show when={!loading() && !error() && lines().length === 0}>
                <div class="flex items-center justify-center h-full text-text-muted">No logs available.</div>
              </Show>

              <For each={filteredLines()}>
                {(line) => (
                  <LogRow
                    line={line}
                    expanded={expandedKeys().has(line.raw)}
                    onToggleExpand={() => toggleExpanded(line.raw)}
                  />
                )}
              </For>
            </div>

            {/* Footer: truncation notice */}
            <Show when={truncated()}>
              <div class="px-5 py-2 border-t border-border flex-shrink-0 text-xs text-text-muted text-center">
                Showing last {lines().length} lines — older logs may have been truncated.
              </div>
            </Show>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
};

/** A single log row with hover-copy, and expand-to-raw for Birdhouse lines only */
const LogRow: Component<{ line: LogLine; expanded: boolean; onToggleExpand: () => void }> = (props) => {
  const [rowCopied, setRowCopied] = createSignal(false);
  const canExpand = () => props.line.source === "birdhouse";

  const handleCopyRow = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(props.line.raw).then(() => {
      setRowCopied(true);
      setTimeout(() => setRowCopied(false), 2000);
    });
  };

  return (
    <div class="group border-b border-border/40 last:border-0">
      {/* Main row: expand trigger (Birdhouse only) + copy button side-by-side */}
      <div class={`flex items-baseline gap-0 ${canExpand() ? "hover:bg-surface/50" : ""}`}>
        {/* Clickable expand area — Birdhouse rows only */}
        <Show
          when={canExpand()}
          fallback={
            <div class="flex items-baseline gap-2.5 px-4 py-1.5 flex-1">
              <RowContent line={props.line} />
            </div>
          }
        >
          <button
            type="button"
            class="flex items-baseline gap-2.5 px-4 py-1.5 flex-1 text-left"
            onClick={props.onToggleExpand}
          >
            <RowContent line={props.line} />
          </button>
        </Show>
        {/* Per-row copy button — appears on hover, always on the right */}
        <button
          type="button"
          title="Copy raw"
          class="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 self-center text-text-muted hover:text-text-primary px-2 py-1.5"
          onClick={handleCopyRow}
        >
          <Show when={rowCopied()} fallback={<ClipboardCopy size={11} />}>
            <Check size={11} class="text-success" />
          </Show>
        </button>
      </div>
      {/* Expanded raw — only for Birdhouse lines */}
      <Show when={props.expanded && canExpand()}>
        <div class="px-4 pb-2">
          <pre class="bg-surface rounded-lg p-3 text-[10px] text-text-muted whitespace-pre-wrap break-all border border-border leading-relaxed overflow-x-auto">
            {props.line.raw}
          </pre>
        </div>
      </Show>
    </div>
  );
};

/** The inner content of a log row (level dot, timestamp, subsystem, message) */
const RowContent: Component<{ line: LogLine }> = (props) => (
  <>
    <span class={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${levelColorClass(props.line.level)}`} />
    <span class="text-text-muted flex-shrink-0 tabular-nums">{formatTime(props.line.time)}</span>
    <span class="text-text-muted/60 flex-shrink-0 text-[10px] uppercase tracking-wide">{props.line.subsystem}</span>
    <span class="text-text-secondary break-all leading-relaxed flex-1">{props.line.msg}</span>
  </>
);

/** Small source filter chip */
const SourceChip: Component<{ label: string; active: boolean; onClick: () => void }> = (props) => (
  <button
    type="button"
    class={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
      props.active
        ? "bg-accent/20 text-accent border border-accent/40"
        : "text-text-muted border border-border hover:text-text-secondary hover:border-border-muted"
    }`}
    onClick={props.onClick}
  >
    {props.label}
  </button>
);

export default LogViewer;
