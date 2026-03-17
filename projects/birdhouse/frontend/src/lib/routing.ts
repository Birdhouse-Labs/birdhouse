// ABOUTME: URL routing abstraction using @solidjs/router
// ABOUTME: Hash-based routing for workspace and modal stack modes

import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { type Accessor, createMemo } from "solid-js";

/**
 * Hook to get the current playground component from route params
 *
 * @returns reactive accessor for component ID or undefined
 */
export function usePlaygroundComponent(): Accessor<string | undefined> {
  const params = useParams<{ component?: string }>();
  return createMemo(() => params.component);
}

/**
 * Hook to navigate to a playground component
 *
 * @returns function to set playground component
 */
export function useSetPlaygroundComponent() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();

  return (component: string) => {
    const wsId = workspaceId();
    if (!wsId) {
      return;
    }
    navigate(`/workspace/${wsId}/playground/${component}`);
  };
}

/**
 * Hook to navigate to playground within current workspace
 *
 * @returns function to navigate to playground
 */
export function useNavigateToPlayground() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();

  return (component: string = "buttons") => {
    const wsId = workspaceId();
    if (!wsId) {
      return;
    }
    navigate(`/workspace/${wsId}/playground/${component}`);
  };
}

/**
 * Hook to get the current workspace ID from route params
 *
 * @returns reactive accessor for workspace ID or undefined
 */
export function useWorkspaceId(): Accessor<string | undefined> {
  const params = useParams<{ workspaceId?: string }>();
  return createMemo(() => params.workspaceId);
}

/**
 * Hook to get the current agent ID in workspace context
 *
 * @returns reactive accessor for agent ID or undefined
 */
export function useWorkspaceAgentId(): Accessor<string | undefined> {
  const params = useParams<{ agentId?: string }>();
  return createMemo(() => params.agentId);
}

/**
 * Hook to navigate to a workspace
 *
 * @returns function to navigate to workspace
 */
export function useNavigateToWorkspace() {
  const navigate = useNavigate();

  return (workspaceId: string) => {
    navigate(`/workspace/${workspaceId}/agents`);
  };
}

/**
 * Hook to navigate to an agent within a workspace
 *
 * @returns function to navigate to workspace agent
 */
export function useNavigateToWorkspaceAgent() {
  const navigate = useNavigate();

  return (workspaceId: string, agentId: string) => {
    navigate(`/workspace/${workspaceId}/agent/${agentId}`);
  };
}

/**
 * Parsed modal state from URL
 */
export interface ModalState {
  type: string;
  id: string;
}

/**
 * Cache for modal objects to maintain referential equality across parses.
 * Key format: "type/id"
 */
const modalCache = new Map<string, ModalState>();

export function parseModalStack(modalsParam: string | undefined): ModalState[] {
  if (!modalsParam) return [];

  const result = modalsParam
    .split(",")
    .map((entry) => {
      const slashIndex = entry.indexOf("/");
      if (slashIndex <= 0 || slashIndex >= entry.length - 1) return null;

      const type = entry.slice(0, slashIndex);
      const id = entry.slice(slashIndex + 1);

      if (!type || !id) return null;

      // Use cached object if it exists, otherwise create and cache
      const cacheKey = `${type}/${id}`;
      let modal = modalCache.get(cacheKey);

      if (!modal) {
        modal = { type, id };
        modalCache.set(cacheKey, modal);
      }

      return modal;
    })
    .filter((modal): modal is ModalState => modal !== null);

  return result;
}

export function serializeModalStack(modals: ModalState[]): string | undefined {
  if (modals.length === 0) return undefined;

  return modals.map((modal) => `${modal.type}/${modal.id}`).join(",");
}

export function pushModalStack(stack: ModalState[], modal: ModalState): ModalState[] {
  const lastModal = stack[stack.length - 1];
  if (lastModal?.type === modal.type && lastModal?.id === modal.id) {
    return stack;
  }

  return [...stack, modal];
}

export function popModalStack(stack: ModalState[]): ModalState[] {
  if (stack.length === 0) return stack;

  return stack.slice(0, -1);
}

export function replaceModalByType(stack: ModalState[], type: string, id: string): ModalState[] {
  let changed = false;
  const next = stack.map((modal) => {
    if (modal.type !== type) return modal;
    if (modal.id === id) return modal;

    changed = true;
    const cacheKey = `${type}/${id}`;
    let updated = modalCache.get(cacheKey);
    if (!updated) {
      updated = { type, id };
      modalCache.set(cacheKey, updated);
    }
    return updated;
  });
  return changed ? next : stack;
}

/**
 * Hook for URL-driven modal state using query parameters
 * Format: ?modals=type/id,type/id (e.g., ?modals=workspace_config/ws_123)
 *
 * @returns modal state and control functions
 */
export function useModalRoute() {
  const [searchParams, setSearchParams] = useSearchParams<{ modals?: string }>();

  const modalStack = createMemo(() => parseModalStack(searchParams.modals));

  const currentModal = createMemo((): ModalState | null => {
    const stack = modalStack();
    return stack.at(-1) ?? null;
  });

  const openModal = (type: string, id: string) => {
    const stack = modalStack();
    const nextStack = pushModalStack(stack, { type, id });
    if (nextStack === stack) return;

    setSearchParams({ modals: serializeModalStack(nextStack) });
  };

  const replaceModal = (type: string, id: string) => {
    const stack = modalStack();
    const nextStack = replaceModalByType(stack, type, id);
    if (nextStack === stack) return;

    setSearchParams({ modals: serializeModalStack(nextStack) });
  };

  const closeModal = () => {
    const stack = modalStack();
    const nextStack = popModalStack(stack);
    if (nextStack === stack) return;

    setSearchParams({ modals: serializeModalStack(nextStack) });
  };

  const isModalOpen = (type: string, id: string) => {
    return modalStack().some((modal) => modal.type === type && modal.id === id);
  };

  return {
    modalStack,
    currentModal,
    openModal,
    replaceModal,
    closeModal,
    isModalOpen,
  };
}
