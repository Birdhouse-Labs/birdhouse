// ABOUTME: Tree view demo with animated reordering and FLIP animations
// ABOUTME: Demo showing TreeView and AgentTreeItem components with mock data

import type { Component } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import AgentTreeItem from "../components/AgentTreeItem";
import TreeView, { type TreeNode } from "../components/TreeView";
import { Button } from "../components/ui";
import { AgentTreeProvider } from "../contexts/AgentTreeContext";
import { log } from "../lib/logger";

const chatTitles = [
  "Fix authentication bug in login flow",
  "Implement dark mode toggle",
  "Refactor database queries",
  "Add unit tests for API endpoints",
  "Debug WebSocket connection issues",
  "Optimize image loading performance",
  "Create user dashboard component",
  "Setup CI/CD pipeline",
  "Migrate to TypeScript",
  "Add form validation",
  "Implement search functionality",
  "Fix memory leak in useEffect",
  "Add pagination to table",
  "Create reusable button component",
  "Setup error boundary",
  "Add loading skeletons",
  "Implement infinite scroll",
  "Fix CSS grid layout issues",
  "Add keyboard shortcuts",
  "Create notification system",
  "Implement file upload",
  "Add drag and drop support",
  "Fix timezone handling",
  "Create modal component",
  "Add export to CSV feature",
  // Longer titles to test 2-line wrapping
  "Investigate and resolve performance degradation in the user authentication service after recent Redis upgrade",
  "Refactor the legacy payment processing module to use the new Stripe API and implement proper error handling",
  "Design and implement a comprehensive monitoring dashboard for tracking real-time system metrics across all microservices",
  "Debug intermittent timeout errors in the webhook delivery system that occur during high traffic periods",
  "Migrate the entire codebase from JavaScript to TypeScript with full type coverage and strict mode enabled",
  "Create automated end-to-end tests for the complete user registration and onboarding flow",
  "Optimize database query performance by adding appropriate indexes and restructuring complex joins",
  "Implement feature flags system with rollout controls and A/B testing capabilities for gradual deployments",
  "Review and update all third-party dependencies to address security vulnerabilities identified in the audit",
  "Build a comprehensive component library with documentation and interactive examples for the design system",
];

const modelNames = ["claude-sonnet-4", "claude-sonnet-3.5", "claude-opus-4", "gpt-4o", "o1-preview"];

// Helper to generate realistic agent metadata
const generateAgentMetadata = (baseDate: Date) => {
  const isWorking = Math.random() < 0.05; // 5% actively working
  const hasUnread = !isWorking && Math.random() < 0.15; // 15% have unread if not working
  const updatedOffset = Math.random() * 300000; // Up to 5 min after creation

  return {
    updatedAt: new Date(baseDate.getTime() + updatedOffset),
    clonedFrom: null,
    clonedAt: null,
    archivedAt: null,
    isActivelyWorking: isWorking,
    hasUnreadMessages: hasUnread,
    modelName: modelNames[Math.floor(Math.random() * modelNames.length)] ?? "claude-sonnet-4",
    tokenUsage: Math.floor(Math.random() * 50000) + 1000,
  };
};

// Use timestamp + counter to ensure IDs are unique across tree generations
let treeIdCounter = 0;
let treeGenerationId = Date.now();
const generateTreeId = () => `tree-${treeGenerationId}-${++treeIdCounter}`;

const generateRandomTree = (largeDataset = false, yearOfData = false): TreeNode[] => {
  const getRandomTitle = (): string => chatTitles[Math.floor(Math.random() * chatTitles.length)] ?? "Untitled";

  const generateChildren = (level: number, maxChildren: number, baseDate: Date): TreeNode[] => {
    if (level >= 5) return [];
    const numChildren = Math.floor(Math.random() * maxChildren);
    return Array.from({ length: numChildren }, () => {
      const metadata = generateAgentMetadata(baseDate);
      return {
        id: generateTreeId(),
        title: getRandomTitle(),
        level,
        children: generateChildren(level + 1, Math.max(1, maxChildren - 1), baseDate),
        collapsed: level > 1,
        createdAt: baseDate,
        ...metadata,
      };
    });
  };

  // Generate year of data: 365 days × ~100 items/day = ~36,500 items
  // Structure: 6-10 root items per day, with children to reach ~100 total
  if (yearOfData) {
    const now = new Date();
    const allNodes: TreeNode[] = [];

    // Helper to generate children until we hit target count
    const generateChildrenToTarget = (targetCount: number, level: number, baseDate: Date): TreeNode[] => {
      const children: TreeNode[] = [];
      let remaining = targetCount;

      while (remaining > 0) {
        const childCount = Math.min(remaining, level < 3 ? Math.floor(Math.random() * 5) + 1 : 1);
        const hasGrandchildren = remaining > childCount && level < 3;

        const metadata = generateAgentMetadata(baseDate);
        children.push({
          id: generateTreeId(),
          title: getRandomTitle(),
          level,
          children: hasGrandchildren
            ? generateChildrenToTarget(Math.min(remaining - 1, Math.floor(Math.random() * 8) + 2), level + 1, baseDate)
            : [],
          collapsed: level > 1,
          createdAt: baseDate,
          ...metadata,
        });

        remaining -= childCount;
      }

      return children;
    };

    // Go back 365 days
    for (let daysAgo = 0; daysAgo < 365; daysAgo++) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      date.setHours(0, 0, 0, 0);

      // Generate 6-10 root items per day
      const rootItemsCount = 6 + Math.floor(Math.random() * 5);
      const targetItemsPerDay = 90 + Math.floor(Math.random() * 20); // 90-110 items per day
      const itemsPerRoot = Math.floor(targetItemsPerDay / rootItemsCount);

      for (let i = 0; i < rootItemsCount; i++) {
        const itemDate = new Date(date);
        itemDate.setHours(Math.floor(Math.random() * 24));
        itemDate.setMinutes(Math.floor(Math.random() * 60));

        // Each root gets roughly equal share of the day's items
        const childrenCount = itemsPerRoot - 1; // -1 for the root itself

        const metadata = generateAgentMetadata(itemDate);
        allNodes.push({
          id: generateTreeId(),
          title: getRandomTitle(),
          level: 0,
          children: childrenCount > 0 ? generateChildrenToTarget(childrenCount, 1, itemDate) : [],
          collapsed: daysAgo > 7, // Only expand recent week
          createdAt: itemDate,
          ...metadata,
        });
      }
    }

    // Sort by date descending (newest first)
    return allNodes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Generate large dataset for performance testing
  if (largeDataset) {
    const now = new Date();
    return Array.from({ length: 50 }, (_, i) => {
      const rootMeta = generateAgentMetadata(now);
      return {
        id: generateTreeId(),
        title: `Root Folder ${i + 1}`,
        level: 0,
        children: Array.from({ length: 20 }, (_, j) => {
          const childMeta = generateAgentMetadata(now);
          return {
            id: generateTreeId(),
            title: `Subfolder ${i + 1}.${j + 1}`,
            level: 1,
            children: Array.from({ length: 10 }, (_, k) => {
              const grandchildMeta = generateAgentMetadata(now);
              return {
                id: generateTreeId(),
                title: `File ${i + 1}.${j + 1}.${k + 1}.ts`,
                level: 2,
                children: [],
                collapsed: false,
                createdAt: now,
                ...grandchildMeta,
              };
            }),
            collapsed: true,
            createdAt: now,
            ...childMeta,
          };
        }),
        collapsed: false,
        createdAt: now,
        ...rootMeta,
      };
    });
  }

  const now = new Date();
  return Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => {
    const metadata = generateAgentMetadata(now);
    return {
      id: generateTreeId(),
      title: getRandomTitle(),
      level: 0,
      children: generateChildren(1, 4, now),
      collapsed: false,
      createdAt: now,
      ...metadata,
    };
  });
};

const TreeViewDemo: Component = () => {
  // Generate year of data, all collapsed
  const generateInitialTree = () => {
    const tree = generateRandomTree(false, true); // yearOfData = true
    const collapseAll = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        node.collapsed = true;
        collapseAll(node.children);
      }
    };
    collapseAll(tree);
    return tree;
  };

  // Use a store for fine-grained reactivity - this preserves object references
  const [store, setStore] = createStore<{ tree: TreeNode[] }>({
    tree: generateInitialTree(),
  });

  // Ref to TreeView for focus control
  let treeViewRef:
    | {
        focusNode: (itemId: string, options?: { scroll?: boolean; highlight?: boolean }) => void;
      }
    | undefined;

  // Toggle collapse using store's produce for in-place mutation (preserves references!)
  const toggleCollapse = (id: string, recursive?: boolean) => {
    log.ui.debug("Toggle collapse", { nodeId: id, recursive });
    // Use produce for fine-grained update - this preserves object references
    setStore(
      produce((state) => {
        const toggleNode = (nodes: TreeNode[]): boolean => {
          for (const node of nodes) {
            if (node.id === id) {
              const newCollapsedState = !node.collapsed;
              node.collapsed = newCollapsedState;
              log.ui.info("Node toggled", {
                nodeId: id,
                collapsed: node.collapsed,
                title: node.title,
                recursive,
              });

              // If recursive, apply the same state to all descendants
              if (recursive) {
                const toggleDescendants = (children: TreeNode[]) => {
                  for (const child of children) {
                    child.collapsed = newCollapsedState;
                    toggleDescendants(child.children);
                  }
                };
                toggleDescendants(node.children);
              }

              return true;
            }
            if (toggleNode(node.children)) return true;
          }
          return false;
        };
        toggleNode(state.tree);
      }),
    );
  };

  // Scramble tree order using produce to preserve references
  const scrambleTree = () => {
    setStore(
      produce((state) => {
        const shuffleArray = <T,>(arr: T[]): void => {
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const valI = arr[i];
            const valJ = arr[j];
            if (valI === undefined || valJ === undefined) continue;
            arr[i] = valJ;
            arr[j] = valI;
          }
        };

        const shuffleChildren = (nodes: TreeNode[]) => {
          shuffleArray(nodes);
          for (const node of nodes) {
            shuffleChildren(node.children);
          }
        };

        shuffleChildren(state.tree);
      }),
    );
  };

  // Expand all nodes using produce
  const expandAll = () => {
    setStore(
      produce((state) => {
        const expand = (nodes: TreeNode[]) => {
          for (const node of nodes) {
            node.collapsed = false;
            expand(node.children);
          }
        };
        expand(state.tree);
      }),
    );
  };

  // Collapse all nodes including roots
  const collapseAll = () => {
    setStore(
      produce((state) => {
        const collapse = (nodes: TreeNode[]) => {
          for (const node of nodes) {
            node.collapsed = true;
            collapse(node.children);
          }
        };
        collapse(state.tree);
      }),
    );
  };

  // Regenerate creates entirely new tree - reconcile handles diffing
  const regenerate = () => {
    treeIdCounter = 0;
    treeGenerationId = Date.now(); // New generation ID to ensure unique IDs
    setStore(reconcile({ tree: generateRandomTree() }));
  };

  // Generate large dataset for stress testing
  const generateLarge = () => {
    treeIdCounter = 0;
    treeGenerationId = Date.now(); // New generation ID to ensure unique IDs
    setStore(reconcile({ tree: generateRandomTree(true, false) }));
  };

  // Generate year of data with date sections
  const generateYearOfData = () => {
    treeIdCounter = 0;
    treeGenerationId = Date.now(); // New generation ID to ensure unique IDs
    setStore(reconcile({ tree: generateRandomTree(false, true) }));
  };

  // Add a new agent (always as most recent)
  const addNewAgent = () => {
    log.ui.info("Adding new agent");
    const newId = generateTreeId();
    const getRandomTitle = (): string => chatTitles[Math.floor(Math.random() * chatTitles.length)] ?? "Untitled";

    const now = new Date();
    const metadata = generateAgentMetadata(now);
    const newNode: TreeNode = {
      id: newId,
      title: getRandomTitle(),
      level: 0,
      children: [],
      collapsed: false,
      createdAt: now,
      ...metadata,
      isActivelyWorking: true, // New agents start actively working
      hasUnreadMessages: false, // No unread yet
    };

    setStore(
      produce((state) => {
        // Add to the beginning since tree is sorted by date descending
        state.tree.unshift(newNode);
      }),
    );

    // Focus the newly added agent (border highlight animation)
    setTimeout(() => {
      treeViewRef?.focusNode(newId, { scroll: true, highlight: true });
    }, 100);
  };

  // Focus a random item - scroll to center and highlight
  const focusRandomItem = () => {
    log.ui.info("Focus random item requested");
    // Helper to collect all nodes from the tree (including collapsed children)
    const getAllNodes = (nodes: TreeNode[]): TreeNode[] => {
      const result: TreeNode[] = [];
      for (const node of nodes) {
        result.push(node);
        if (node.children.length > 0) {
          result.push(...getAllNodes(node.children));
        }
      }
      return result;
    };

    // Get all nodes (including those hidden by collapsed parents)
    const allNodes = getAllNodes(store.tree);

    if (allNodes.length === 0) return;

    // Pick a random node
    const randomNode = allNodes[Math.floor(Math.random() * allNodes.length)];
    if (!randomNode) return;

    // Helper to find path to a node and expand all parents
    const expandPathToNode = (nodes: TreeNode[], targetId: string, path: string[] = []): string[] | null => {
      for (const node of nodes) {
        if (node.id === targetId) {
          return path;
        }
        if (node.children.length > 0) {
          const childPath = expandPathToNode(node.children, targetId, [...path, node.id]);
          if (childPath !== null) {
            return childPath;
          }
        }
      }
      return null;
    };

    // Find path to the random node
    const pathToNode = expandPathToNode(store.tree, randomNode.id);

    // Expand all parent nodes in the path
    if (pathToNode && pathToNode.length > 0) {
      setStore(
        produce((state) => {
          const expandNode = (nodes: TreeNode[], targetId: string): boolean => {
            for (const node of nodes) {
              if (node.id === targetId) {
                node.collapsed = false;
                return true;
              }
              if (expandNode(node.children, targetId)) {
                return true;
              }
            }
            return false;
          };

          // Expand each parent in the path
          for (const parentId of pathToNode) {
            expandNode(state.tree, parentId);
          }
        }),
      );
    }

    // Use the focus helper to scroll and highlight
    setTimeout(() => {
      treeViewRef?.focusNode(randomNode.id, { scroll: true, highlight: true });
    }, 100); // Wait for tree to update after expansion
  };

  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Animated Tree View</h2>
        <p class="text-sm text-text-secondary hidden md:block">Collapsible tree with FLIP animations on reorder</p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-8 space-y-4">
        {/* Controls */}
        <div class="flex flex-wrap gap-2">
          <Button variant="primary" onClick={addNewAgent}>
            Add New Agent
          </Button>
          <Button variant="primary" onClick={focusRandomItem}>
            Focus Random Item
          </Button>
          <Button variant="primary" onClick={scrambleTree}>
            Scramble
          </Button>
          <Button variant="secondary" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="secondary" onClick={collapseAll}>
            Collapse All
          </Button>
          <Button variant="secondary" onClick={regenerate}>
            Regenerate
          </Button>
          <Button variant="primary" onClick={generateLarge}>
            Generate 10,000 Items
          </Button>
          <Button variant="primary" onClick={generateYearOfData}>
            Generate Year of Data (36k items)
          </Button>
        </div>

        {/* Stats */}
        <div class="text-xs text-text-muted">
          Showing {store.tree.length} items (virtualized rendering with date sections)
        </div>

        {/* Tree List Container - using TreeView component with context */}
        <AgentTreeProvider selectAgent={(id) => log.ui.info("Item selected", { id })} toggleCollapse={toggleCollapse}>
          <TreeView
            items={store.tree}
            ref={(ref) => {
              treeViewRef = ref;
            }}
            renderItem={(node, _isSelected, _isFocused, focusAnimationStart) => (
              <AgentTreeItem node={node} isSelected={false} focusAnimationStart={focusAnimationStart} />
            )}
          />
        </AgentTreeProvider>

        <p class="text-xs text-text-muted">
          Click items with children to expand/collapse. "Generate Year of Data" creates 365 days × ~100 items = ~36,500
          items with date sections.
        </p>
      </div>
    </div>
  );
};

export default TreeViewDemo;
