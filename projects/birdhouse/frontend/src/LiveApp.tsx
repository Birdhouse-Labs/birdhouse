// ABOUTME: Live application for real agents
// ABOUTME: Chat with agents in resizable sidebar showing agent list and hash-based routing
// ABOUTME: Hosts modal stack handling for agent dialogs

import Resizable from "corvu/resizable";
import {
  type Accessor,
  type Component,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { BackendAgentNode } from "./adapters/agent-tree-adapter";
import { mapAgentNode } from "./adapters/agent-tree-adapter";
import AgentListHeader from "./components/AgentListHeader";
import AgentModal from "./components/AgentModal";
import AgentSearchDialog from "./components/AgentSearchDialog";
import AgentTreeItem from "./components/AgentTreeItem";
import CommandPalette from "./components/CommandPalette";
import ConnectionStatusBanner from "./components/ConnectionStatusBanner";
import LiveMessages from "./components/LiveMessages";
import MobileNavDrawer from "./components/MobileNavDrawer";
import NewAgent from "./components/NewAgent";
import TreeView, { type TreeNode } from "./components/TreeView";
import Button from "./components/ui/Button";
import { AgentTreeProvider } from "./contexts/AgentTreeContext";
import { useStreaming } from "./contexts/StreamingContext";
import { useWorkspace } from "./contexts/WorkspaceContext";
import { loadCollapseState, saveCollapseState } from "./lib/collapse-state";
import { log } from "./lib/logger";
import { usePageTitle } from "./lib/page-title";
import { keepAgentInView } from "./lib/preferences";
import { type ModalState, useModalRoute, useNavigateToWorkspaceAgent, useWorkspaceAgentId } from "./lib/routing";
import { fetchAgentTrees } from "./services/messages-api";
import SkillLibraryDialog from "./skills/components/SkillLibraryDialog";
import { createMediaQuery } from "./theme/createMediaQuery";

// Loading spinner component
const LoadingSpinner = () => (
  <div class="flex items-center justify-center h-full">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
  </div>
);

// Error message component with retry button
const ErrorMessage = (props: { error: Error; onRetry: () => void }) => (
  <div class="flex flex-col items-center justify-center h-full gap-4 p-4">
    <p class="text-danger text-center">Failed to load agents: {props.error.message}</p>
    <Button onClick={props.onRetry} variant="primary">
      Retry
    </Button>
  </div>
);

interface LiveAppProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

interface AgentModalStackNodeProps {
  stack: Accessor<ModalState[]>;
  index: number;
  onClose: () => void;
  onOpenAgentModal: (agentId: string) => void;
}

const AgentModalStackNode: Component<AgentModalStackNodeProps> = (props) => {
  const modal = createMemo(() => props.stack()[props.index]);

  return (
    <Show when={modal()} keyed>
      {(currentModal) => (
        <AgentModal
          agentId={currentModal.id}
          navigationDepth={props.index + 1}
          isTop={props.index === props.stack().length - 1}
          onClose={props.onClose}
          onOpenAgentModal={props.onOpenAgentModal}
        >
          <AgentModalStackNode
            stack={props.stack}
            index={props.index + 1}
            onClose={props.onClose}
            onOpenAgentModal={props.onOpenAgentModal}
          />
        </AgentModal>
      )}
    </Show>
  );
};

/**
 * Helper function to find a node by ID in the tree
 * @param nodes Array of tree nodes to search
 * @param targetId ID of the node to find
 * @returns The found node or undefined
 */
function findNodeById(nodes: TreeNode[], targetId: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.id === targetId) {
      return node;
    }
    if (node.children.length > 0) {
      const found = findNodeById(node.children, targetId);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

const LiveApp: Component<LiveAppProps> = (props) => {
  // Get workspace context
  const { workspaceId } = useWorkspace();

  // Navigation hook - must be called at component top level
  const navigateToAgent = useNavigateToWorkspaceAgent();

  // Store agent trees in a mutable store for in-place updates
  const [agentTrees, setAgentTrees] = createStore<TreeNode[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<Error | null>(null);
  const { modalStack, openModal, closeModal } = useModalRoute();

  const agentModalStack = createMemo(() => modalStack().filter((modal) => modal.type === "agent"));

  // Modal navigation handlers
  const openAgentModal = (agentId: string) => {
    openModal("agent", agentId);
  };

  // Track when SSE events arrive to detect stale SSE data vs fresh API data
  const sseTimestamps = new Map<string, number>();

  // Fetch agent trees from API on mount
  const refetch = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    // Remember selected agent to keep it in view after refetch (if visible)
    const currentSelectedId = selectedAgentId();

    // Mark when we're fetching - SSE events after this are fresher than API response
    const fetchStartTime = Date.now();

    try {
      const trees = await fetchAgentTrees(workspaceId);
      setAgentTrees(trees);

      // Update SSE cache with API status, but only for agents whose SSE data
      // is older than when we started this fetch (or have no SSE data)
      setAgentStatuses(
        produce((draft) => {
          const populateStatus = (node: TreeNode) => {
            if (node.status) {
              const sseTime = sseTimestamps.get(node.id) || 0;
              // Use API data if we have no SSE data, or SSE data is from before this fetch
              if (sseTime < fetchStartTime) {
                draft[node.id] = node.status;
              }
            }
            node.children.forEach(populateStatus);
          };
          trees.forEach(populateStatus);
        }),
      );

      // Keep selected agent in view after refetch (server may have re-sorted)
      // User preference controls whether we scroll - always highlight to show selection
      if (currentSelectedId && silent) {
        setTimeout(() => {
          treeViewRef?.focusNode(currentSelectedId, {
            scroll: keepAgentInView(),
            highlight: true,
          });
        }, 50);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch agent trees"));
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  onMount(() => {
    refetch();
  });

  // Get agent ID from route params (workspace-aware)
  const routeAgentId = useWorkspaceAgentId();

  const [selectedAgentId, setSelectedAgentIdInternal] = createSignal<string | undefined>(routeAgentId());

  const isDesktop = createMediaQuery("(min-width: 768px)");

  // Streaming context for session.created events
  const streaming = useStreaming();

  // Track collapsed state per agent (persists across refetches and page refreshes)
  // Initialize from sessionStorage to restore state within the same browser tab
  const [collapsedState, setCollapsedState] = createStore<Record<string, boolean>>(loadCollapseState());

  // Persist collapse state to sessionStorage whenever it changes
  createEffect(() => {
    // Access the entire store to track any changes
    const state = { ...collapsedState };
    saveCollapseState(state);
  });

  // Track status per agent (updated via SSE)
  const [agentStatuses, setAgentStatuses] = createStore<Record<string, { type: "idle" | "busy" | "retry" }>>({});

  // Ref to TreeView for focus control (scroll to agent in tree)
  let treeViewRef:
    | {
        focusNode: (itemId: string, options?: { scroll?: boolean; highlight?: boolean }) => void;
      }
    | undefined;

  // Subscribe to birdhouse.agent.created events to insert new agents in-place
  createEffect(() => {
    const unsubscribe = streaming.subscribeToAgentCreated((agentInfo) => {
      // Event includes full agent data - no API fetch needed!
      const newAgentData = agentInfo.agent as unknown as BackendAgentNode;

      // Insert into tree in-place
      setAgentTrees(
        produce((draft) => {
          // Map backend data to TreeNode format (with empty children array)
          const newNode = mapAgentNode({
            ...newAgentData,
            children: [], // New agents start with no children
          });

          // Find parent and insert as child, or insert at root level
          if (newAgentData.parent_id) {
            const parent = findNodeById(draft, newAgentData.parent_id);
            if (parent) {
              // Insert at top (index 0) - newest agents first
              parent.children.unshift(newNode);
            } else {
              log.ui.error(`Parent agent ${newAgentData.parent_id} not found for new agent ${agentInfo.agentId}`);
            }
          } else {
            // Insert root agent at top (index 0) - newest agents first
            draft.unshift(newNode);
          }
        }),
      );

      // Focus and scroll to new agent (border highlight animation)
      setTimeout(() => {
        treeViewRef?.focusNode(agentInfo.agentId, {
          scroll: true,
          highlight: true,
        });
      }, 100);
    });

    onCleanup(unsubscribe);
  });

  // Subscribe to agent updated events to update agent properties in-place
  createEffect(() => {
    const unsubscribe = streaming.subscribeToAgentUpdated((agentId: string, agent: Record<string, unknown>) => {
      // Agent updated (e.g., title changed) - update in-place
      setAgentTrees(
        produce((draft) => {
          const node = findNodeById(draft, agentId);
          // TypeScript requires bracket notation for index signatures
          if (node && typeof agent["title"] === "string") {
            node.title = agent["title"];
          }
        }),
      );
    });

    onCleanup(unsubscribe);
  });

  // Subscribe to agent archived events to remove archived agents from tree
  createEffect(() => {
    const unsubscribe = streaming.subscribeToAgentArchived((payload) => {
      // Remove all archived agents from the tree
      const archivedIdsSet = new Set(payload.archivedIds);

      setAgentTrees(
        produce((draft) => {
          // Helper to recursively filter out archived agents
          const filterArchived = (nodes: TreeNode[]): TreeNode[] => {
            return nodes.filter((node) => {
              if (archivedIdsSet.has(node.id)) {
                return false; // Remove this node
              }
              // Recursively filter children
              node.children = filterArchived(node.children);
              return true; // Keep this node
            });
          };

          // Filter archived agents from all root trees
          const filteredTrees = filterArchived(draft);
          // Replace draft array with filtered trees
          draft.splice(0, draft.length, ...filteredTrees);
        }),
      );
    });

    onCleanup(unsubscribe);
  });

  // Subscribe to agent unarchived events to restore agents in tree
  createEffect(() => {
    const unsubscribe = streaming.subscribeToAgentUnarchived((payload) => {
      // Agents were unarchived - refetch tree to restore them
      log.ui.info(`Unarchived ${payload.unarchivedCount} agents, refreshing tree`);
      refetch(true); // Silent refresh - tree will include unarchived agents
    });

    onCleanup(unsubscribe);
  });

  // Subscribe to connection established events to refresh stale data
  createEffect(() => {
    const unsubscribe = streaming.subscribeToConnectionEstablished(() => {
      // Tab became visible and SSE reconnected - refetch agent tree silently
      log.ui.info("Connection re-established, refreshing agent tree");
      refetch(true); // Silent refresh - keep displaying current tree
    });

    onCleanup(unsubscribe);
  });

  // Subscribe to ALL session status events to update agent status in real-time
  createEffect(() => {
    const unsubscribe = streaming.subscribeToAllSessionStatus(
      (agentId: string, status: { type: "idle" | "busy" | "retry" }) => {
        // Track when this SSE event arrived
        sseTimestamps.set(agentId, Date.now());

        // Update status in store (this will trigger re-render via treeWithCollapsedState)
        setAgentStatuses(
          produce((draft) => {
            draft[agentId] = status;
          }),
        );
      },
    );

    onCleanup(unsubscribe);
  });

  // Sync internal state with route changes (browser back/forward)
  // This is the ONLY place that updates selectedAgentId - URL is source of truth
  createEffect(() => {
    const agentId = routeAgentId();
    if (agentId !== selectedAgentId()) {
      setSelectedAgentIdInternal(agentId);
    }
  });

  // Update browser tab title to show selected agent name
  usePageTitle(() => {
    const agentId = selectedAgentId();

    if (!agentId) {
      return "New Agent - Birdhouse";
    }

    const agent = findNodeById(treeWithCollapsedState(), agentId);
    return agent ? `${agent.title} - Birdhouse` : "New Agent - Birdhouse";
  });

  // Agent selection handler - navigate to new route
  // IMPORTANT: Only navigates - the effect above syncs state automatically
  // This prevents double-update bugs where state is updated manually AND by effect
  const handleSelectAgent = (id: string) => {
    // Navigate to workspace agent route using router's navigate function
    // This ensures SolidJS Router's reactivity is triggered properly
    navigateToAgent(workspaceId, id);

    // Close drawer after selection, but only on mobile
    if (!isDesktop()) {
      props.setSidebarOpen(false);
    }
  };

  // Toggle collapse handler - updates local state
  const handleToggleCollapse = (id: string, recursive?: boolean) => {
    setCollapsedState(
      produce((state) => {
        // Get the new collapsed state for the target node
        const newCollapsedState = !state[id];
        state[id] = newCollapsedState;

        // If recursive, apply the same state to all descendants
        if (recursive) {
          const node = findNodeById(treeWithCollapsedState(), id);
          if (node) {
            const getAllDescendantIds = (n: TreeNode): string[] => {
              const ids: string[] = [];
              for (const child of n.children) {
                ids.push(child.id);
                ids.push(...getAllDescendantIds(child));
              }
              return ids;
            };

            const descendantIds = getAllDescendantIds(node);
            for (const descendantId of descendantIds) {
              state[descendantId] = newCollapsedState;
            }
          }
        }
      }),
    );
  };

  // Helper to expand all parent nodes in the path to a target node
  const expandPathToNode = (nodeId: string) => {
    // Find the path to the target node (list of parent IDs)
    const findPath = (nodes: TreeNode[], targetId: string, path: string[] = []): string[] | null => {
      for (const node of nodes) {
        if (node.id === targetId) {
          return path;
        }
        if (node.children.length > 0) {
          const childPath = findPath(node.children, targetId, [...path, node.id]);
          if (childPath !== null) {
            return childPath;
          }
        }
      }
      return null;
    };

    const pathToNode = findPath(treeWithCollapsedState(), nodeId);

    // Expand each parent node in the path
    if (pathToNode && pathToNode.length > 0) {
      setCollapsedState(
        produce((state) => {
          for (const parentId of pathToNode) {
            state[parentId] = false; // Expand
          }
        }),
      );
    }
  };

  // Handler for when agent header is clicked - scroll to agent in tree
  const handleAgentHeaderClick = (agentId: string) => {
    // Expand parent nodes if agent is nested
    expandPathToNode(agentId);
    // Wait for tree to update, then scroll and highlight
    setTimeout(() => {
      treeViewRef?.focusNode(agentId, { scroll: true, highlight: true });
    }, 100);
  };

  // Merge collapsed state and SSE status updates with fetched tree data
  const treeWithCollapsedState = createMemo(() => {
    const applyState = (node: TreeNode): TreeNode => {
      // Get status from SSE store, fall back to node's status from API
      const status = agentStatuses[node.id] ?? node.status;

      const result: TreeNode = {
        ...node,
        collapsed: collapsedState[node.id] ?? node.collapsed,
        // Re-compute isActivelyWorking from latest status
        isActivelyWorking: status?.type === "busy" || status?.type === "retry",
        children: node.children.map(applyState),
      };

      // Update status field if we have one (satisfies exactOptionalPropertyTypes)
      if (status !== undefined) {
        result.status = status;
      }

      return result;
    };

    return agentTrees.map(applyState);
  });

  // Tree view component with loading/error/empty states
  // Wrapped with AgentTreeProvider to avoid prop drilling through TreeView
  const TreeViewContent = () => (
    <div class="flex flex-col h-full">
      {/* Slim header with search button */}
      <AgentListHeader />

      {/* Tree content */}
      <div class="flex-1 overflow-hidden">
        <Show when={!isLoading()} fallback={<LoadingSpinner />}>
          <Show when={!error()} fallback={<ErrorMessage error={error() as Error} onRetry={() => refetch()} />}>
            <Show
              when={treeWithCollapsedState().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center h-full gap-4 p-4 text-center">
                  <p class="text-text-muted text-lg">No agents yet</p>
                  <p class="text-sm text-text-muted">Create your first agent to get started</p>
                </div>
              }
            >
              <AgentTreeProvider selectAgent={handleSelectAgent} toggleCollapse={handleToggleCollapse}>
                <TreeView
                  items={treeWithCollapsedState()}
                  selectedItemId={selectedAgentId() ?? ""}
                  height="100%"
                  showBorder={false}
                  ref={(ref) => {
                    treeViewRef = ref;
                  }}
                  renderItem={(node, isSelected, _isFocused, focusAnimationStart) => (
                    <AgentTreeItem node={node} isSelected={isSelected} focusAnimationStart={focusAnimationStart} />
                  )}
                />
              </AgentTreeProvider>
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );

  return (
    <div class="h-full overflow-hidden p-2 relative">
      {/* Connection status banner (fixed at top, only shown when not connected) */}
      <ConnectionStatusBanner status={streaming.connectionStatus()} />

      <Show
        when={isDesktop()}
        fallback={
          <>
            {/* Mobile: Drawer + Content */}
            <MobileNavDrawer
              components={[]}
              selectedComponent=""
              onSelect={() => {}}
              open={props.sidebarOpen}
              onOpenChange={props.setSidebarOpen}
              trigger={null}
            >
              <TreeViewContent />
            </MobileNavDrawer>
            {/* Main content - LiveMessages or NewAgent */}
            <div class="h-full bg-surface-raised rounded-lg overflow-hidden">
              <Show when={selectedAgentId()} keyed fallback={<NewAgent />}>
                {(agentId) => (
                  <LiveMessages
                    agentId={agentId}
                    onAgentHeaderClick={handleAgentHeaderClick}
                    onOpenAgentModal={openAgentModal}
                  />
                )}
              </Show>
            </div>
          </>
        }
      >
        {/* Desktop: Always-mounted Resizable with collapsible sidebar */}
        <Resizable class="h-full" orientation="horizontal">
          {(resizableContext) => {
            // Sync sidebar collapse state with props.sidebarOpen
            createEffect(() => {
              if (props.sidebarOpen) {
                resizableContext.expand(0, "following");
              } else {
                resizableContext.collapse(0, "following");
              }
            });

            return (
              <>
                {/* Left Sidebar Panel - collapsible */}
                <Resizable.Panel
                  initialSize={0.25}
                  minSize={0.2}
                  maxSize={0.5}
                  collapsible={true}
                  collapsedSize={0}
                  onCollapse={() => {
                    // User dragged to collapse - sync with hamburger state
                    props.setSidebarOpen(false);
                  }}
                  onExpand={() => {
                    // User dragged to expand - sync with hamburger state
                    props.setSidebarOpen(true);
                  }}
                  class="h-full bg-surface-raised rounded-lg overflow-hidden"
                >
                  <TreeViewContent />
                </Resizable.Panel>

                {/* Resizable Handle - always visible */}
                <Resizable.Handle
                  aria-label="Resize sidebar"
                  class="w-4 cursor-col-resize flex items-center justify-center group"
                >
                  <div class="w-1 h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                </Resizable.Handle>

                {/* Main Panel - always mounted */}
                <Resizable.Panel
                  initialSize={0.75}
                  minSize={0.5}
                  class="h-full bg-surface-raised rounded-lg overflow-hidden"
                >
                  <Show when={selectedAgentId()} keyed fallback={<NewAgent />}>
                    {(agentId) => (
                      <LiveMessages
                        agentId={agentId}
                        onAgentHeaderClick={handleAgentHeaderClick}
                        onOpenAgentModal={openAgentModal}
                      />
                    )}
                  </Show>
                </Resizable.Panel>
              </>
            );
          }}
        </Resizable>
      </Show>

      {/* Agent modal stack - option-click agent links to open */}
      <AgentModalStackNode stack={agentModalStack} index={0} onClose={closeModal} onOpenAgentModal={openAgentModal} />

      {/* Skills Library Dialog */}
      <SkillLibraryDialog workspaceId={workspaceId} />

      {/* Agent Search Dialog */}
      <AgentSearchDialog />

      {/* Command Palette */}
      <CommandPalette />
    </div>
  );
};

export default LiveApp;
