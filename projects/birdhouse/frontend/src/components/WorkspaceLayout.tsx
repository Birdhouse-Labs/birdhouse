// ABOUTME: Full-page layout for workspace-scoped routes
// ABOUTME: Provides Header, full-height container, and workspace context to all workspace pages

import { Navigate, useMatch } from "@solidjs/router";
import {
  type Component,
  createEffect,
  createResource,
  createSignal,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { SkillCacheProvider } from "../contexts/SkillCacheContext";
import { StreamingProvider, useStreaming } from "../contexts/StreamingContext";
import { WorkspaceProvider } from "../contexts/WorkspaceContext";
import LiveApp from "../LiveApp";
import { useModalRoute, useWorkspaceId } from "../lib/routing";
import Playground from "../Playground";
import { fetchWorkspace, fetchWorkspaceHealth, startWorkspace } from "../services/workspaces-api";
import { createMediaQuery } from "../theme/createMediaQuery";
import WorkspaceConfigDialog from "../workspace-config/components/WorkspaceConfigDialog";
import Header from "./Header";
import WorkspaceBooting from "./WorkspaceBooting";
import WorkspaceSettings from "./WorkspaceSettings";

/**
 * Full-page layout component for workspace-scoped routes
 * Provides Header, full-height container, and workspace context to all workspace pages including Playground
 */
const WorkspaceLayout: Component = () => {
  const workspaceId = useWorkspaceId();
  const isDesktop = createMediaQuery("(min-width: 768px)");
  const [sidebarOpen, setSidebarOpen] = createSignal(isDesktop());
  const { currentModal, isModalOpen, closeModal } = useModalRoute();

  // Workspace readiness state
  const [isReady, setIsReady] = createSignal(false);
  const [healthError, setHealthError] = createSignal<string | null>(null);
  const [configError, setConfigError] = createSignal<string | null>(null);
  // Only surface transient network errors after a grace period to avoid startup flicker
  const ERROR_GRACE_PERIOD_MS = 10_000;
  let errorSince: number | null = null;

  // Fetch workspace title for the booting screen (non-workspace-scoped endpoint)
  const [workspaceData] = createResource(workspaceId, (id) => fetchWorkspace(id).catch(() => null));

  // Route matching for conditional rendering
  const isSettings = useMatch(() => `/workspace/${workspaceId()}/settings`);
  const isPlayground = useMatch(() => `/workspace/${workspaceId()}/playground/*`);
  const isAgent = useMatch(() => `/workspace/${workspaceId()}/agent/*`);
  const isAgents = useMatch(() => `/workspace/${workspaceId()}/agents`);

  createEffect(() => {
    if (!isDesktop()) {
      setSidebarOpen(false);
    }
  });

  // Start health polling — returns a cleanup function to stop it
  const startHealthPolling = (id: string) => {
    errorSince = null;

    const pollHealth = async () => {
      try {
        const health = await fetchWorkspaceHealth(id);
        if (health.harnessRunning) {
          setIsReady(true);
          setHealthError(null);
          setConfigError(null);
          errorSince = null;
          clearInterval(pollInterval);
        } else if (health.configError) {
          // Config errors are definitive — surface immediately, no grace period
          setConfigError(health.configError);
          errorSince = null;
          setHealthError(null);
        } else {
          // health.error while harnessRunning=false is a normal transient state
          // during cold start (e.g. "not started yet") — clear any prior errors
          errorSince = null;
          setHealthError(null);
          setConfigError(null);
        }
      } catch (error) {
        // Surface genuine network errors only after grace period
        // to avoid flashing errors during normal startup sequencing
        const now = Date.now();
        if (errorSince === null) {
          errorSince = now;
        }
        if (now - errorSince >= ERROR_GRACE_PERIOD_MS) {
          setHealthError(error instanceof Error ? error.message : "Health check failed");
        }
      }
    };

    pollHealth();
    const pollInterval = setInterval(pollHealth, 2000);
    return () => clearInterval(pollInterval);
  };

  // Current poll cleanup — held so WorkspaceRestartWatcher can restart it
  let stopHealthPolling: (() => void) | null = null;

  onMount(() => {
    const id = workspaceId();
    if (!id) return;

    // Kick off the spawn in the background
    startWorkspace(id).catch(() => {
      // Ignore — health poll will surface the error
    });

    stopHealthPolling = startHealthPolling(id);
    onCleanup(() => stopHealthPolling?.());
  });

  // Called by WorkspaceRestartWatcher when a restart event arrives
  const handleWorkspaceRestarting = () => {
    const id = workspaceId();
    if (!id) return;
    stopHealthPolling?.();
    setIsReady(false);
    setHealthError(null);
    setConfigError(null);
    stopHealthPolling = startHealthPolling(id);
  };

  return (
    <div
      class="flex flex-col transition-colors duration-300 bg-gradient-to-br from-bg-from via-bg-via to-bg-to text-text-primary"
      style={{
        height: "100dvh",
        "padding-top": "var(--safe-top)",
        "padding-bottom": "var(--safe-bottom)",
        "padding-left": "var(--safe-left)",
        "padding-right": "var(--safe-right)",
      }}
    >
      <Header
        showMenuButton={true}
        menuButtonActive={sidebarOpen()}
        onMenuClick={() => setSidebarOpen(!sidebarOpen())}
      />
      <div class="flex-1 overflow-hidden">
        <Show
          when={isReady()}
          fallback={
            <Show when={workspaceId()} keyed>
              {(id) => (
                <WorkspaceBooting
                  workspaceId={id}
                  workspaceTitle={workspaceData()?.title ?? null}
                  error={healthError()}
                  configError={configError()}
                />
              )}
            </Show>
          }
        >
          <Switch fallback={<div>Loading workspace...</div>}>
            <Match when={workspaceId()} keyed>
              {(id) => (
                <WorkspaceProvider>
                  <StreamingProvider workspaceId={id}>
                    <WorkspaceRestartWatcher onRestarting={handleWorkspaceRestarting} />
                    <SkillCacheProvider>
                      <Switch fallback={<Navigate href={`/workspace/${id}/agents`} />}>
                        <Match when={isSettings()}>
                          <WorkspaceSettings />
                        </Match>
                        <Match when={isPlayground()}>
                          <Playground sidebarOpen={sidebarOpen()} setSidebarOpen={setSidebarOpen} />
                        </Match>
                        <Match when={isAgent() || isAgents()}>
                          <LiveApp sidebarOpen={sidebarOpen()} setSidebarOpen={setSidebarOpen} />
                        </Match>
                      </Switch>
                    </SkillCacheProvider>
                  </StreamingProvider>
                </WorkspaceProvider>
              )}
            </Match>
          </Switch>
        </Show>
      </div>

      {/* Workspace config dialog — responds to ?modals=workspace_config/... from anywhere in workspace */}
      <Show when={currentModal()?.type === "workspace_config" ? currentModal() : null} keyed>
        {(modal) => (
          <WorkspaceConfigDialog
            open={true}
            onOpenChange={(open) => {
              if (!open && isModalOpen("workspace_config", modal.id)) {
                closeModal();
              }
            }}
            workspaceId={modal.id}
          />
        )}
      </Show>
    </div>
  );
};

/**
 * Subscribes to workspace restarting SSE events and calls onRestarting.
 * Must be rendered inside StreamingProvider.
 */
const WorkspaceRestartWatcher: Component<{ onRestarting: () => void }> = (props) => {
  const streaming = useStreaming();

  createEffect(() => {
    const unsubscribe = streaming.subscribeToWorkspaceRestarting(() => {
      props.onRestarting();
    });
    onCleanup(unsubscribe);
  });

  return null;
};

export default WorkspaceLayout;
