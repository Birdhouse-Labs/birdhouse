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
import { StreamingProvider } from "../contexts/StreamingContext";
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
  // Only surface errors after a grace period to avoid flashing errors during normal startup
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

  onMount(() => {
    const id = workspaceId();
    if (!id) return;

    // Kick off the spawn in the background
    startWorkspace(id).catch(() => {
      // Ignore — health poll will surface the error
    });

    // Poll health every 2s until ready
    const pollHealth = async () => {
      try {
        const health = await fetchWorkspaceHealth(id);
        if (health.opencodeRunning) {
          setIsReady(true);
          setHealthError(null);
          errorSince = null;
          clearInterval(pollInterval);
        } else {
          // health.error while opencodeRunning=false is a normal transient state
          // during cold start (e.g. "not started yet") — not a real failure, clear any error
          errorSince = null;
          setHealthError(null);
        }
      } catch (error) {
        // Surface genuine errors (network failures, etc.) only after grace period
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

    onCleanup(() => clearInterval(pollInterval));
  });

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

export default WorkspaceLayout;
