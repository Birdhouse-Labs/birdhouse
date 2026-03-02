// ABOUTME: Global pattern cache with SSE event listeners for real-time updates
// ABOUTME: Single source of truth for pattern metadata across the app

import {
  type Accessor,
  createContext,
  createEffect,
  createResource,
  onCleanup,
  type ParentComponent,
  useContext,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { log } from "../lib/logger";
import { adaptPatternGroupsMetadata } from "../patterns/adapters/pattern-groups-adapter";
import { fetchAllPatterns } from "../patterns/services/pattern-groups-api";
import type { PatternGroupsAPIMetadata } from "../patterns/types/pattern-groups-api-types";
import type { PatternGroupsMetadata } from "../patterns/types/pattern-groups-types";
import { useStreaming } from "./StreamingContext";
import { useWorkspace } from "./WorkspaceContext";

interface PatternCacheContextValue {
  /**
   * Cached pattern metadata (all patterns for workspace)
   */
  patterns: Accessor<PatternGroupsMetadata[]>;

  /**
   * Loading state for initial fetch
   */
  loading: Accessor<boolean>;

  /**
   * Error state for initial fetch
   */
  error: Accessor<Error | null>;

  /**
   * Manual refetch (used on mount, connection re-established)
   */
  refetch: () => Promise<void>;

  /**
   * Get single pattern by ID (from cache)
   */
  getPattern: (id: string) => PatternGroupsMetadata | undefined;
}

const PatternCacheContext = createContext<PatternCacheContextValue>();

export function usePatternCache(): PatternCacheContextValue {
  const ctx = useContext(PatternCacheContext);
  if (!ctx) {
    throw new Error("usePatternCache must be used within PatternCacheProvider");
  }
  return ctx;
}

export const PatternCacheProvider: ParentComponent = (props) => {
  const { workspaceId } = useWorkspace();
  const streaming = useStreaming();

  // Use SolidJS Store for in-place updates
  const [patternsStore, setPatternsStore] = createStore<PatternGroupsMetadata[]>([]);

  // Resource for initial fetch
  const [patternsResource, { refetch: resourceRefetch }] = createResource(workspaceId, fetchAllPatterns);

  // Sync resource data to store when it arrives
  createEffect(() => {
    const data = patternsResource();
    if (data) {
      setPatternsStore(data);
    }
  });

  // Manual refetch function
  const refetch = async () => {
    await resourceRefetch();
  };

  // Subscribe to pattern.created events
  createEffect(() => {
    const unsubscribe = streaming.subscribeToPatternCreated((payload) => {
      log.ui.info(`Pattern created: ${payload.patternId}`);

      // Adapt raw API data to UI type
      const apiPattern = payload.pattern as unknown as PatternGroupsAPIMetadata;
      const newPattern = adaptPatternGroupsMetadata(apiPattern);

      // Add to store
      setPatternsStore(
        produce((draft) => {
          // Check if pattern already exists (shouldn't, but be defensive)
          const existingIndex = draft.findIndex((p) => p.id === payload.patternId);
          if (existingIndex === -1) {
            // Add at beginning (newest first)
            draft.unshift(newPattern);
          } else {
            // Update existing (shouldn't happen for created, but handle it)
            draft[existingIndex] = newPattern;
          }
        }),
      );
    });

    onCleanup(unsubscribe);
  });

  // Subscribe to pattern.updated events
  createEffect(() => {
    const unsubscribe = streaming.subscribeToPatternUpdated((payload) => {
      log.ui.info(`Pattern updated: ${payload.patternId}`);

      // Adapt raw API data to UI type
      const apiPattern = payload.pattern as unknown as PatternGroupsAPIMetadata;
      const updatedPattern = adaptPatternGroupsMetadata(apiPattern);

      // Update in store
      setPatternsStore(
        produce((draft) => {
          const index = draft.findIndex((p) => p.id === payload.patternId);
          if (index !== -1) {
            // Update existing pattern
            draft[index] = updatedPattern;
          } else {
            // Pattern not in cache yet - add it (edge case, but be defensive)
            draft.unshift(updatedPattern);
          }
        }),
      );
    });

    onCleanup(unsubscribe);
  });

  // Subscribe to pattern.deleted events
  createEffect(() => {
    const unsubscribe = streaming.subscribeToPatternDeleted((payload) => {
      log.ui.info(`Pattern deleted: ${payload.patternId}`);

      // Remove from store
      setPatternsStore(
        produce((draft) => {
          const index = draft.findIndex((p) => p.id === payload.patternId);
          if (index !== -1) {
            draft.splice(index, 1);
          }
        }),
      );
    });

    onCleanup(unsubscribe);
  });

  // Refetch when SSE reconnects to prevent stale data
  createEffect(() => {
    const unsubscribe = streaming.subscribeToConnectionEstablished(() => {
      log.ui.info("Connection re-established, refreshing pattern cache");
      refetch();
    });

    onCleanup(unsubscribe);
  });

  // Helper to get single pattern by ID
  const getPattern = (id: string): PatternGroupsMetadata | undefined => {
    return patternsStore.find((p) => p.id === id);
  };

  const value: PatternCacheContextValue = {
    patterns: () => patternsStore,
    loading: () => patternsResource.loading,
    error: () => patternsResource.error ?? null,
    refetch,
    getPattern,
  };

  return <PatternCacheContext.Provider value={value}>{props.children}</PatternCacheContext.Provider>;
};
