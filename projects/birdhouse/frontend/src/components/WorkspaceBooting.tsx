// ABOUTME: Workspace booting screen shown while OpenCode is starting up
// ABOUTME: Polls for log output, shows elapsed time, and provides restart/settings actions

import { Settings } from "lucide-solid";
import { type Component, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { useModalRoute } from "../lib/routing";
import { fetchWorkspaceLogs, restartWorkspace } from "../services/workspaces-api";
import Button from "./ui/Button";

export interface WorkspaceBootingProps {
  workspaceId: string;
  workspaceTitle: string | null;
  error?: string | null;
}

// How long before we show the "taking longer than expected" message (ms)
const SLOW_THRESHOLD_MS = 15_000;

// How long before we show the Restart button (ms)
const RESTART_THRESHOLD_MS = 20_000;

// Log level prefixes for coloring
const LEVEL_COLORS: Record<string, string> = {
  ERROR: "text-danger",
  WARN: "text-warning",
  WARNING: "text-warning",
  INFO: "text-text-secondary",
  DEBUG: "text-text-muted",
};

function getLineColor(line: string): string {
  const upper = line.trimStart().toUpperCase();
  for (const [level, color] of Object.entries(LEVEL_COLORS)) {
    if (upper.startsWith(level)) return color;
  }
  return "text-text-muted";
}

const WorkspaceBooting: Component<WorkspaceBootingProps> = (props) => {
  const { openModal } = useModalRoute();
  const [elapsedMs, setElapsedMs] = createSignal(0);
  const [logLines, setLogLines] = createSignal<string[]>([]);
  const [restarting, setRestarting] = createSignal(false);

  const isSlow = () => elapsedMs() >= SLOW_THRESHOLD_MS;
  const showRestart = () => elapsedMs() >= RESTART_THRESHOLD_MS;

  const handleRestart = async () => {
    if (restarting()) return;
    setRestarting(true);
    setElapsedMs(0);
    // Fire and forget — health polling in WorkspaceLayout will pick up readiness
    restartWorkspace(props.workspaceId).catch(() => {
      // Ignore errors — the health poll will surface any issues
    });
    // Keep restarting state to show feedback briefly, then reset
    setTimeout(() => setRestarting(false), 3000);
  };

  onMount(() => {
    const startTime = Date.now();

    // Elapsed time ticker
    const elapsedInterval = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 1000);

    // Log poller
    const pollLogs = async () => {
      try {
        const result = await fetchWorkspaceLogs(props.workspaceId);
        if (result.available && result.lines.length > 0) {
          // Show last 20 lines
          setLogLines(result.lines.slice(-20));
        }
      } catch {
        // Silently ignore log fetch errors
      }
    };

    // Poll immediately, then every 3s
    pollLogs();
    const logInterval = setInterval(pollLogs, 3000);

    onCleanup(() => {
      clearInterval(elapsedInterval);
      clearInterval(logInterval);
    });
  });

  return (
    <div class="flex flex-col items-center justify-center h-full gap-6 p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div class="flex flex-col items-center gap-3 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
        <h2 class="text-xl font-semibold text-text-primary">Starting workspace environment...</h2>
        <Show when={props.workspaceTitle}>
          <p class="text-sm text-text-muted">{props.workspaceTitle}</p>
        </Show>
      </div>

      {/* Slow / error messages */}
      <Show when={props.error}>
        <p class="text-sm text-danger text-center">{props.error}</p>
      </Show>
      <Show when={!props.error && isSlow()}>
        <p class="text-sm text-text-muted text-center">Taking longer than expected...</p>
      </Show>

      {/* Log output */}
      <Show when={logLines().length > 0}>
        <div class="w-full rounded-lg border border-border bg-surface overflow-hidden">
          <div class="px-3 py-2 border-b border-border">
            <span class="text-xs font-medium text-text-muted uppercase tracking-wide">Startup logs</span>
          </div>
          <div class="overflow-y-auto max-h-48 p-3">
            <For each={logLines()}>
              {(line) => (
                <div class={`font-mono text-xs leading-relaxed whitespace-pre-wrap break-all ${getLineColor(line)}`}>
                  {line}
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Action buttons */}
      <div class="flex items-center gap-3">
        <Button
          variant="secondary"
          leftIcon={<Settings size={14} />}
          onClick={() => openModal("workspace_config", props.workspaceId)}
        >
          Workspace Settings
        </Button>
        <Show when={showRestart()}>
          <Button variant="tertiary" disabled={restarting()} onClick={handleRestart}>
            {restarting() ? "Restarting..." : "Restart"}
          </Button>
        </Show>
      </div>
    </div>
  );
};

export default WorkspaceBooting;
