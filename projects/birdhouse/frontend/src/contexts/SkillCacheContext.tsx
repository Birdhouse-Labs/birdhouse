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
import { fetchSkillLibrary } from "../skills/services/skill-library-api";
import { useStreaming } from "./StreamingContext";
import { useWorkspace } from "./WorkspaceContext";

interface CachedSkillMetadata {
  id: string;
  title: string;
  triggerPhrases: string[];
  metadataTriggerPhrases: string[];
}

interface SkillCacheContextValue {
  /**
   * Cached visible skills with trigger phrases for the current workspace
   */
  skills: Accessor<CachedSkillMetadata[]>;

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
   * Get single skill by ID (from cache)
   */
  getSkill: (id: string) => CachedSkillMetadata | undefined;
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

  const [skillsStore, setSkillsStore] = createStore<CachedSkillMetadata[]>([]);

  const fetchVisibleSkills = async (currentWorkspaceId: string): Promise<CachedSkillMetadata[]> => {
    const library = await fetchSkillLibrary(currentWorkspaceId);
    return library.skills.map((skill) => ({
      id: skill.id,
      title: skill.title,
      triggerPhrases: skill.trigger_phrases,
      metadataTriggerPhrases: skill.metadata_trigger_phrases,
    }));
  };

  const [skillsResource, { refetch: resourceRefetch }] = createResource(workspaceId, fetchVisibleSkills);

  // Sync resource data to store when it arrives
  createEffect(() => {
    if (skillsResource.error) {
      return;
    }
    const data = skillsResource();
    if (data) {
      setSkillsStore(data);
    }
  });

  // Manual refetch function
  const refetch = async () => {
    await resourceRefetch();
  };

  createEffect(() => {
    const unsubscribe = streaming.subscribeToConnectionEstablished(() => {
      log.ui.info("Connection re-established, refreshing visible skill cache");
      void refetch();
    });

    onCleanup(unsubscribe);
  });

  createEffect(() => {
    const unsubscribe = streaming.subscribeToSkillUpdated(() => {
      log.ui.info("Skill updated, refreshing visible skill cache");
      void refetch();
    });

    onCleanup(unsubscribe);
  });

  const getSkill = (id: string): CachedSkillMetadata | undefined => {
    return skillsStore.find((skill) => skill.id === id);
  };

  const value: SkillCacheContextValue = {
    skills: () => skillsStore,
    loading: () => skillsResource.loading,
    error: () => skillsResource.error ?? null,
    refetch,
    getSkill,
  };

  return <SkillCacheContext.Provider value={value}>{props.children}</SkillCacheContext.Provider>;
};
