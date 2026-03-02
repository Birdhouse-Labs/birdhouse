// ABOUTME: Context for workspace state and operations
// ABOUTME: Provides workspace details and refetch capability to child components

import { type Accessor, createContext, createEffect, createSignal, type ParentComponent, useContext } from "solid-js";
import { log } from "../lib/logger";
import { useWorkspaceId } from "../lib/routing";
import { fetchWorkspace } from "../services/workspaces-api";
import { fetchModelLimits } from "../stores/model-limits";
import type { Workspace } from "../types/workspace";

interface WorkspaceContextValue {
  /**
   * The current workspace ID (always defined inside provider)
   */
  workspaceId: string;

  /**
   * Workspace details (undefined while loading or on error)
   */
  workspace: Accessor<Workspace | undefined>;

  /**
   * Whether workspace details are loading
   */
  isLoading: Accessor<boolean>;

  /**
   * Error from fetching workspace details
   */
  error: Accessor<Error | null>;

  /**
   * Refetch workspace details
   */
  refetch: () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue>();

/**
 * Hook to access workspace context
 * Must be used within a WorkspaceProvider
 *
 * @throws Error if used outside WorkspaceProvider
 */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}

/**
 * Provider component that fetches and provides workspace details
 * Reads workspaceId from route params and fetches workspace data
 */
export const WorkspaceProvider: ParentComponent = (props) => {
  const workspaceIdAccessor = useWorkspaceId();
  const [workspace, setWorkspace] = createSignal<Workspace>();
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<Error | null>(null);

  // Track current workspace ID to detect changes
  let currentWorkspaceId: string | undefined;

  const fetchData = async (workspaceId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchWorkspace(workspaceId);
      setWorkspace(data);

      // Fetch model limits for this workspace (populates cache for token calculations)
      // Don't block on this - token stats will show 0 until cache is populated
      fetchModelLimits(workspaceId).catch((err) => {
        log.api.error("Failed to fetch model limits for workspace", { workspaceId }, err);
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch workspace"));
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch workspace details when workspaceId changes
  createEffect(() => {
    const wsId = workspaceIdAccessor();

    // Wait for route params to load
    if (!wsId) {
      return;
    }

    // Only refetch if workspace ID actually changed
    if (wsId !== currentWorkspaceId) {
      currentWorkspaceId = wsId;
      fetchData(wsId);
    }
  });

  // Refetch function for manual refresh
  const refetch = () => {
    const wsId = workspaceIdAccessor();
    if (wsId) {
      fetchData(wsId);
    }
  };

  // Ensure we have a workspace ID before providing context
  const wsId = workspaceIdAccessor();
  if (!wsId) {
    // Route params not loaded yet - render nothing
    return null;
  }

  const value: WorkspaceContextValue = {
    workspaceId: wsId,
    workspace,
    isLoading,
    error,
    refetch,
  };

  return <WorkspaceContext.Provider value={value}>{props.children}</WorkspaceContext.Provider>;
};
