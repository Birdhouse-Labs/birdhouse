// ABOUTME: Context for agent tree interactions (selection, collapse, etc.)
// ABOUTME: Provides clean API to avoid prop drilling through TreeView component

import { createContext, type ParentComponent, useContext } from "solid-js";

/**
 * Actions available for agent tree interactions.
 * These are provided at the LiveApp level and consumed by AgentTreeItem.
 */
interface AgentTreeContextValue {
  /**
   * Select an agent and navigate to it.
   * This updates the URL which triggers reactivity throughout the app.
   */
  selectAgent: (id: string) => void;

  /**
   * Toggle the collapsed state of an agent node.
   * Collapsed nodes hide their children in the tree view.
   * @param id The ID of the node to toggle
   * @param recursive If true, applies the toggle to all descendants recursively
   */
  toggleCollapse: (id: string, recursive?: boolean) => void;

  /**
   * Getter function for matched agent IDs (when searching with includeTrees=true).
   * Returns a Set of agent IDs that matched the search query.
   * Used to visually highlight matching agents in the tree.
   * This is a getter to preserve reactivity through context.
   */
  matchedAgentIds: () => Set<string> | undefined;

  /**
   * Whether to render items as a flat list (no indentation).
   * Used when searching without "include trees" to show all results at root level.
   */
  flatMode: () => boolean;
}

const AgentTreeContext = createContext<AgentTreeContextValue>();

/**
 * Props accepted by AgentTreeProvider component.
 * Pass signals as-is, they will be wrapped in getters internally.
 */
interface AgentTreeProviderProps {
  selectAgent: (id: string) => void;
  toggleCollapse: (id: string, recursive?: boolean) => void;
  matchedAgentIds?: () => Set<string>;
  flatMode?: () => boolean;
}

/**
 * Provider component that makes agent tree actions available to all descendants.
 *
 * Usage:
 * ```tsx
 * <AgentTreeProvider
 *   selectAgent={handleSelectAgent}
 *   toggleCollapse={handleToggleCollapse}
 *   matchedAgentIds={matchedAgentIdsSignal}
 * >
 *   <TreeView ... />
 * </AgentTreeProvider>
 * ```
 */
export const AgentTreeProvider: ParentComponent<AgentTreeProviderProps> = (props) => {
  const value: AgentTreeContextValue = {
    selectAgent: props.selectAgent,
    toggleCollapse: props.toggleCollapse,
    // Wrap in getter to preserve reactivity through context
    matchedAgentIds: () => props.matchedAgentIds?.(),
    flatMode: () => props.flatMode?.() ?? false,
  };

  return <AgentTreeContext.Provider value={value}>{props.children}</AgentTreeContext.Provider>;
};

/**
 * Hook to access agent tree actions.
 * Must be used within an AgentTreeProvider.
 *
 * @throws Error if used outside of AgentTreeProvider
 *
 * @example
 * ```tsx
 * const { selectAgent, toggleCollapse } = useAgentTree();
 * onClick={() => selectAgent(agentId)}
 * ```
 */
export function useAgentTree(): AgentTreeContextValue {
  const context = useContext(AgentTreeContext);
  if (!context) {
    throw new Error("useAgentTree must be used within AgentTreeProvider");
  }
  return context;
}
