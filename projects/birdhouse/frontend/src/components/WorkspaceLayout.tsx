// ABOUTME: Full-page layout for workspace-scoped routes
// ABOUTME: Provides Header, full-height container, and workspace context to all workspace pages

import { Navigate, useMatch } from "@solidjs/router";
import { type Component, createEffect, createSignal, Match, Show, Switch } from "solid-js";
import { SkillCacheProvider } from "../contexts/SkillCacheContext";
import { StreamingProvider } from "../contexts/StreamingContext";
import { WorkspaceProvider } from "../contexts/WorkspaceContext";
import LiveApp from "../LiveApp";
import { useModalRoute, useWorkspaceId } from "../lib/routing";
import Playground from "../Playground";
import { createMediaQuery } from "../theme/createMediaQuery";
import WorkspaceConfigDialog from "../workspace-config/components/WorkspaceConfigDialog";
import Header from "./Header";
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
