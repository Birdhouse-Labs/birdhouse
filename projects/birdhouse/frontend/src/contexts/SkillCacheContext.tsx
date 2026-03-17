// ABOUTME: Global visible-skill cache used by composer auto-attach typeahead.
// ABOUTME: Loads read-only skill metadata from the skills library shell and exposes trigger phrases.

import {
  type Accessor,
  createContext,
  createEffect,
  createResource,
  onCleanup,
  type ParentComponent,
  useContext,
} from "solid-js";
import { createStore } from "solid-js/store";
import { log } from "../lib/logger";
import { fetchPatternLibrary } from "../patterns/services/pattern-library-api";
import { useStreaming } from "./StreamingContext";
import { useWorkspace } from "./WorkspaceContext";

interface CachedSkillMetadata {
  id: string;
  title: string;
  triggerPhrases: string[];
}

interface SkillCacheContextValue {
  /**
   * Cached visible skills with trigger phrases for the current workspace
   */
  patterns: Accessor<CachedSkillMetadata[]>;

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
  getPattern: (id: string) => CachedSkillMetadata | undefined;
}

const SkillCacheContext = createContext<SkillCacheContextValue>();

export function useSkillCache(): SkillCacheContextValue {
  const ctx = useContext(SkillCacheContext);
  if (!ctx) {
    throw new Error("useSkillCache must be used within SkillCacheProvider");
  }
  return ctx;
}

export const SkillCacheProvider: ParentComponent = (props) => {
  const { workspaceId } = useWorkspace();
  const streaming = useStreaming();

  const [patternsStore, setPatternsStore] = createStore<CachedSkillMetadata[]>([]);

  const fetchVisibleSkills = async (currentWorkspaceId: string): Promise<CachedSkillMetadata[]> => {
    const library = await fetchPatternLibrary(currentWorkspaceId);
    return library.skills.map((pattern) => ({
      id: pattern.id,
      title: pattern.title,
      triggerPhrases: pattern.trigger_phrases,
    }));
  };

  const [patternsResource, { refetch: resourceRefetch }] = createResource(workspaceId, fetchVisibleSkills);

  // Sync resource data to store when it arrives
  createEffect(() => {
    if (patternsResource.error) {
      return;
    }
    const data = patternsResource();
    if (data) {
      setPatternsStore(data);
    }
  });

  // Manual refetch function
  const refetch = async () => {
    await resourceRefetch();
  };

  createEffect(() => {
    const unsubscribe = streaming.subscribeToConnectionEstablished(() => {
      log.ui.info("Connection re-established, refreshing visible skill cache");
      refetch();
    });

    onCleanup(unsubscribe);
  });

  const getPattern = (id: string): CachedSkillMetadata | undefined => {
    return patternsStore.find((p) => p.id === id);
  };

  const value: SkillCacheContextValue = {
    patterns: () => patternsStore,
    loading: () => patternsResource.loading,
    error: () => patternsResource.error ?? null,
    refetch,
    getPattern,
  };

  return <SkillCacheContext.Provider value={value}>{props.children}</SkillCacheContext.Provider>;
};
