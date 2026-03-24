// ABOUTME: Workspace booting screen shown while OpenCode is starting up
// ABOUTME: Shows elapsed time and provides restart/settings actions

import Dialog from "corvu/dialog";
import { AlertTriangle, Copy, Settings } from "lucide-solid";
import { type Component, createSignal, onCleanup, onMount, Show } from "solid-js";
import { useModalRoute } from "../lib/routing";
import { restartWorkspace } from "../services/workspaces-api";
import LogViewer from "./LogViewer";
import Button from "./ui/Button";

export interface WorkspaceBootingProps {
  workspaceId: string;
  workspaceTitle: string | null;
  error?: string | null;
  /** Set when OpenCode has an invalid configuration — shows a distinct error UI */
  configError?: string | null;
}

// How long before we show the "taking longer than expected" message (ms)
const SLOW_THRESHOLD_MS = 15_000;

// How long before we show the Restart button (ms)
const RESTART_THRESHOLD_MS = 20_000;

const WorkspaceBooting: Component<WorkspaceBootingProps> = (props) => {
  const { openModal } = useModalRoute();
  const [elapsedMs, setElapsedMs] = createSignal(0);
  const [restarting, setRestarting] = createSignal(false);
  const [errorDetailsOpen, setErrorDetailsOpen] = createSignal(false);
  const [copied, setCopied] = createSignal(false);

  const isSlow = () => elapsedMs() >= SLOW_THRESHOLD_MS;
  // Don't show Restart when there's a config error — restarting won't help
  const showRestart = () => !props.configError && elapsedMs() >= RESTART_THRESHOLD_MS;

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

  const handleCopyError = () => {
    if (!props.configError) return;
    navigator.clipboard.writeText(props.configError).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  onMount(() => {
    const startTime = Date.now();

    // Elapsed time ticker
    const elapsedInterval = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 1000);

    onCleanup(() => {
      clearInterval(elapsedInterval);
    });
  });

  return (
    <div class="flex flex-col items-center justify-center h-full gap-6 p-8 max-w-2xl mx-auto">
      {/* Config error state — distinct from normal booting */}
      <Show when={props.configError}>
        {/* No spinner — this is a terminal error state, not loading */}
        <div class="flex flex-col items-center gap-4 text-center">
          <div class="flex items-center justify-center w-14 h-14 rounded-full bg-danger/10">
            <AlertTriangle size={28} class="text-danger" />
          </div>
          <div class="flex flex-col gap-1">
            <h2 class="text-xl font-semibold text-text-primary">Workspace failed to boot</h2>
            <Show when={props.workspaceTitle}>
              <p class="text-sm text-text-muted">{props.workspaceTitle}</p>
            </Show>
          </div>
          <p class="text-sm text-text-secondary">
            Click &lsquo;Open Workspace Settings&rsquo; below to fix the configuration.
          </p>
          <button
            type="button"
            class="text-xs text-text-muted underline underline-offset-2 hover:text-text-secondary transition-colors"
            onClick={() => setErrorDetailsOpen(true)}
          >
            Show error details
          </button>
        </div>

        {/* Prominent Settings CTA */}
        <Button
          variant="primary"
          leftIcon={<Settings size={14} />}
          onClick={() => openModal("workspace_config", props.workspaceId)}
        >
          Open Workspace Settings
        </Button>

        <LogViewer workspaceId={props.workspaceId} buttonLabel="View Startup Logs" buttonVariant="tertiary" />

        {/* Error details dialog */}
        <Dialog open={errorDetailsOpen()} onOpenChange={setErrorDetailsOpen}>
          <Dialog.Portal>
            <Dialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
            <Dialog.Content class="fixed left-1/2 top-1/2 z-50 w-full max-w-lg rounded-2xl p-6 border shadow-2xl -translate-x-1/2 -translate-y-1/2 bg-surface-raised border-border">
              <div class="flex items-center justify-between mb-4">
                <Dialog.Label class="text-lg font-semibold text-heading">Error Details</Dialog.Label>
                <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors focus:outline-none rounded p-1 w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <span class="text-xl leading-none select-none">×</span>
                </Dialog.Close>
              </div>
              <pre class="font-mono text-xs text-text-secondary bg-surface rounded-lg p-4 overflow-auto max-h-48 whitespace-pre-wrap break-all border border-border">
                {props.configError}
              </pre>
              <div class="flex justify-end mt-4">
                <Button variant="secondary" leftIcon={<Copy size={13} />} onClick={handleCopyError}>
                  {copied() ? "Copied!" : "Copy"}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog>
      </Show>

      {/* Normal booting state */}
      <Show when={!props.configError}>
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

        {/* Action buttons */}
        <div class="flex items-center gap-3">
          <Button
            variant="secondary"
            leftIcon={<Settings size={14} />}
            onClick={() => openModal("workspace_config", props.workspaceId)}
          >
            Workspace Settings
          </Button>
          <LogViewer workspaceId={props.workspaceId} buttonLabel="View Startup Logs" buttonVariant="tertiary" />
          <Show when={showRestart()}>
            <Button variant="tertiary" disabled={restarting()} onClick={handleRestart}>
              {restarting() ? "Restarting..." : "Restart"}
            </Button>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default WorkspaceBooting;
