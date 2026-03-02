// ABOUTME: Context for managing z-index values in nested dialogs and popovers
// ABOUTME: Provides base z-index that increases with nesting depth to prevent layering issues

import { type Accessor, createContext, type ParentComponent, useContext } from "solid-js";

interface ZIndexContextValue {
  /**
   * Base z-index for overlays and dialogs at this nesting level
   * Default: 50 (root level)
   * Increases by 10 for each level of modal nesting
   */
  baseZIndex: Accessor<number>;
}

const ZIndexContext = createContext<ZIndexContextValue>();

/**
 * Hook to access z-index context
 * Returns base z-index for current nesting level
 * Safe to use outside provider - returns default value of 50
 */
export function useZIndex(): number {
  const ctx = useContext(ZIndexContext);
  // Return default if used outside provider (root level)
  return ctx?.baseZIndex() ?? 50;
}

export interface ZIndexProviderProps {
  /**
   * Base z-index value for this level
   * Typically: 50 (root), 60 (depth 1), 70 (depth 2), etc.
   */
  baseZIndex: number;
}

/**
 * Provider component that sets z-index level for child components
 * Used by AgentModal to increase z-index for nested modals
 */
export const ZIndexProvider: ParentComponent<ZIndexProviderProps> = (props) => {
  const value: ZIndexContextValue = {
    baseZIndex: () => props.baseZIndex,
  };

  return <ZIndexContext.Provider value={value}>{props.children}</ZIndexContext.Provider>;
};
