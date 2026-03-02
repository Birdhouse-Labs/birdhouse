// ABOUTME: Generic reusable virtualized tree view component with date grouping
// ABOUTME: Handles virtualization, section headers, and FLIP animations for expand/collapse

import { createVirtualizer } from "@tanstack/solid-virtual";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { unwrap } from "solid-js/store";

export type TreeNode = {
  id: string;
  title: string;
  level: number;
  children: TreeNode[];
  collapsed: boolean;
  createdAt: Date;
  updatedAt: Date;
  clonedFrom: string | null; // ID of agent this was cloned from
  clonedAt: Date | null; // When this agent was cloned
  archivedAt: Date | null; // When this agent was archived, null if not archived
  isActivelyWorking: boolean;
  hasUnreadMessages: boolean;
  modelName: string;
  tokenUsage: number;
  status?: { type: "idle" | "busy" | "retry" }; // Session status from backend API
  sectionDate?: Date; // The date of the section this node appears under (for smart time formatting)
};

type VirtualItem =
  | { type: "section"; date: Date; label: string; count: number }
  | { type: "node"; node: TreeNode; sectionDate: Date };

export interface TreeViewProps {
  items: TreeNode[];
  selectedItemId?: string;
  renderItem: (node: TreeNode, isSelected: boolean, isFocused: boolean, focusAnimationStart?: number) => JSX.Element;
  title?: string;
  height?: string; // CSS height value, defaults to "650px" for demo compatibility
  showBorder?: boolean; // Show border around container, defaults to true
  ref?: (element: { focusNode: (itemId: string, options?: { scroll?: boolean; highlight?: boolean }) => void }) => void; // Expose focus control
}

// Helper to format date labels
const formatDateLabel = (date: Date): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - itemDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  // After days, show nice formatted date
  return formatFullDate(date);
};

// Helper to format full date nicely (e.g., "Dec 15, 2024")
const formatFullDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Calculate the maximum updatedAt timestamp in a tree (recursively checks all descendants)
const getMaxUpdatedAt = (node: TreeNode): Date => {
  let max = node.updatedAt;
  for (const child of node.children) {
    const childMax = getMaxUpdatedAt(child);
    if (childMax > max) {
      max = childMax;
    }
  }
  return max;
};

// Group root nodes by date sections (uses max updatedAt across entire tree)
export const groupByDateSections = (items: TreeNode[]): Map<string, TreeNode[]> => {
  const rootsByDay = new Map<string, TreeNode[]>();
  for (const node of items) {
    // Use the maximum updatedAt from anywhere in the tree
    const maxUpdated = getMaxUpdatedAt(node);
    const dayKey = new Date(maxUpdated.getFullYear(), maxUpdated.getMonth(), maxUpdated.getDate()).toISOString();
    if (!rootsByDay.has(dayKey)) {
      rootsByDay.set(dayKey, []);
    }
    rootsByDay.get(dayKey)?.push(node);
  }
  return rootsByDay;
};

// Flatten tree with section headers - maintains tree hierarchy within each day
export const flattenTree = (items: TreeNode[]): VirtualItem[] => {
  const result: VirtualItem[] = [];

  // Group root nodes by day
  const rootsByDay = groupByDateSections(items);

  // Sort days descending (newest first)
  const sortedDays = Array.from(rootsByDay.keys()).sort((a, b) => b.localeCompare(a));

  // For each day, add section header then traverse tree hierarchy
  for (const dayKey of sortedDays) {
    const dayRoots = rootsByDay.get(dayKey) || [];
    const date = new Date(dayKey);

    // Count all items in this day recursively (including all descendants)
    let dayItemCount = 0;
    const countAllItems = (nodes: TreeNode[]): number => {
      let count = nodes.length;
      for (const node of nodes) {
        count += countAllItems(node.children);
      }
      return count;
    };
    dayItemCount = countAllItems(dayRoots);

    // Add section header with count
    result.push({
      type: "section",
      date,
      label: formatDateLabel(date),
      count: dayItemCount,
    });

    // Traverse each root and its children in order (preserves tree structure)
    const traverseTree = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        // Unwrap store proxy to get plain object, then add sectionDate without mutation warnings
        const unwrappedNode = unwrap(node);
        const nodeWithSection = { ...unwrappedNode, sectionDate: date };
        result.push({ type: "node", node: nodeWithSection, sectionDate: date });
        if (!node.collapsed && node.children.length > 0) {
          traverseTree(node.children);
        }
      }
    };
    traverseTree(dayRoots);
  }
  return result;
};

const TreeView: Component<TreeViewProps> = (props) => {
  // Reference to the scrollable container for virtualizer (direct variable, not signal)
  let scrollElement!: HTMLDivElement;

  // Track the active sticky section header
  const [activeStickySection, setActiveStickySection] = createSignal<{
    type: "section";
    date: Date;
    label: string;
    count: number;
  } | null>(null);

  // Reactive scroll position for z-index calculations
  const [scrollTop, setScrollTop] = createSignal(0);

  // Track focus animation start times by node ID
  const [focusAnimations, setFocusAnimations] = createSignal<Map<string, number>>(new Map());

  // Track pending remove timers for each focused node
  const focusTimerMap = new Map<string, number>();

  // Show overlay only when scrolled past top (hide during overscroll)
  const showOverlay = createMemo(() => {
    return activeStickySection() && scrollTop() > 0;
  });

  // Flatten tree with section headers
  const flatItems = createMemo((): VirtualItem[] => {
    return flattenTree(props.items);
  });

  // Create virtualizer - only renders visible items (nodes + section headers)
  const virtualizer = createVirtualizer({
    get count() {
      return flatItems().length;
    },
    getScrollElement: () => scrollElement,
    estimateSize: (index) => {
      const item = flatItems()[index];
      // Fixed heights: 38px for sections, 26px for tree items
      return item?.type === "section" ? 38 : 26;
    },
    overscan: 20,
    // Stable keys so virtualizer tracks items by ID, not index (critical for expand/collapse!)
    getItemKey: (index) => {
      const item = flatItems()[index];
      if (!item) return String(index);
      return item.type === "section" ? `section-${item.date.toISOString()}` : `node-${item.node.id}`;
    },
  });

  // Notify virtualizer when flatItems changes (expand/collapse adds/removes items)
  createEffect(() => {
    const _len = flatItems().length;
    virtualizer.measure(); // Reset cached measurements when array mutates
  });

  // Helper to focus a node by ID - scrolls to center and/or highlights
  const focusNode = (nodeId: string, options?: { scroll?: boolean; highlight?: boolean }) => {
    const { scroll, highlight = true } = options ?? {};

    // Scroll is required - caller must explicitly specify
    if (scroll === undefined) {
      throw new Error("focusNode: scroll option is required. Pass { scroll: true } or { scroll: false }");
    }

    if (scroll) {
      // Scroll to the node
      const items = flatItems();
      const fullIndex = items.findIndex((item) => item.type === "node" && item.node.id === nodeId);
      if (fullIndex !== -1) {
        virtualizer.scrollToIndex(fullIndex, {
          align: "center",
          behavior: "auto",
        });
      }
    }

    if (highlight) {
      // Cancel existing timer for this node
      const existingTimer = focusTimerMap.get(nodeId);
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
        focusTimerMap.delete(nodeId);
      }

      // Store animation start time (prevents restarts on tree mutations)
      const startTime = Date.now();
      setFocusAnimations((prev) => {
        const next = new Map(prev);
        next.set(nodeId, startTime);
        return next;
      });

      // Schedule cleanup after 5 seconds
      const timerId = setTimeout(() => {
        setFocusAnimations((prev) => {
          const next = new Map(prev);
          next.delete(nodeId);
          return next;
        });
        focusTimerMap.delete(nodeId);
      }, 5000) as unknown as number;

      focusTimerMap.set(nodeId, timerId);
    }
  };

  // Expose focus control to parent via ref
  onMount(() => {
    if (props.ref) {
      props.ref({ focusNode });
    }
  });

  // Track scroll position reactively - use onMount to ensure ref is ready
  onMount(() => {
    const handleScroll = () => {
      setScrollTop(scrollElement.scrollTop);
    };

    scrollElement.addEventListener("scroll", handleScroll, { passive: true });

    onCleanup(() => {
      scrollElement.removeEventListener("scroll", handleScroll);
    });
  });

  // Update sticky header based on visible items
  createEffect(() => {
    // Track both virtualizer items AND flatItems changes
    const items = virtualizer.getVirtualItems();
    const allItems = flatItems();

    if (items.length === 0 || allItems.length === 0) {
      setActiveStickySection(null);
      return;
    }

    // Get actual scroll position to find the item at viewport top
    const scrollTop = scrollElement?.scrollTop ?? 0;

    // Find which index is at the top of the viewport using actual positions
    let indexAtScrollTop = 0;
    for (const virtualItem of items) {
      if (virtualItem.start <= scrollTop) {
        indexAtScrollTop = virtualItem.index;
      }
    }

    // Find the last section header at or before the scroll position
    let activeSectionIndex = -1;
    for (let i = indexAtScrollTop; i >= 0; i--) {
      const item = allItems[i];
      if (item?.type === "section") {
        activeSectionIndex = i;
        break;
      }
    }

    if (activeSectionIndex >= 0) {
      const sectionItem = allItems[activeSectionIndex];
      if (sectionItem?.type === "section") {
        setActiveStickySection(sectionItem);
      }
    } else {
      // Fallback: use first section if we can't find one
      const firstSection = allItems.find((item) => item.type === "section");
      if (firstSection?.type === "section") {
        setActiveStickySection(firstSection);
      }
    }
  });

  const containerHeight = props.height ?? "650px";
  const showBorder = props.showBorder ?? true;

  return (
    <div
      class="w-full relative flex flex-col"
      classList={{
        "border border-border-muted": showBorder,
      }}
      style={{ height: containerHeight }}
    >
      {/* Optional Title */}
      <Show when={props.title}>
        <div class="px-4 pt-4 pb-4">
          <h2 class="text-2xl font-bold bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent">
            {props.title}
          </h2>
        </div>
      </Show>

      {/* Fixed Sticky Header Overlay - z-index 10 (sections lift to their index when close) */}
      <Show when={showOverlay() ? activeStickySection() : false} keyed>
        {(section) => (
          <div
            class="absolute top-0 left-0 right-0 flex items-center justify-between py-2 px-3 bg-surface-overlay border-b border-border-muted font-semibold text-sm text-heading"
            style={{ "z-index": "10", "pointer-events": "none" }}
          >
            <div class="flex items-center gap-2">
              <span>{section.label}</span>
              <Show
                when={section.label === "Today" || section.label === "Yesterday" || section.label.includes("days ago")}
              >
                <span class="text-xs text-text-muted">{formatFullDate(section.date)}</span>
              </Show>
            </div>
            <span class="text-xs font-normal text-text-muted">
              {section.count} {section.count === 1 ? "Agent" : "Agents"}
            </span>
          </div>
        )}
      </Show>

      <div ref={scrollElement} class="w-full flex-1 overflow-y-auto scrollbar-hide">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          <Show
            when={flatItems().length > 0}
            fallback={<div class="p-4 text-center text-sm text-text-muted">No items</div>}
          >
            <For each={virtualizer.getVirtualItems()} fallback={null}>
              {(virtualRow) => {
                // CRITICAL: The `keyed` prop is REQUIRED here to prevent stale props bug
                //
                // THE BUG WE'RE PREVENTING (see git commits 6828c5c and 810afb1):
                // When tree expands/collapses, flatItems() creates a new array with
                // different items. Without `keyed`, the same DOM element/component
                // instance renders the new item but TreeItem retains stale props.node
                // from the old item. Result: clicking Node A toggles Node B.
                //
                // WHY KEYED FIXES IT:
                // When `keyed` is true, Show recreates children when the `when` prop's
                // REFERENCE changes. On expand/collapse, flatItems()[index] returns a
                // different object reference, forcing recreation with fresh props.
                //
                // WHY OTHER SOLUTIONS DON'T WORK:
                // - Direct assignment (const item = flatItems()[index]) creates stale closure
                // - createMemo(() => flatItems()[index]) fails because virtualRow.index
                //   is NOT reactive - virtualizer reuses/mutates virtualRow objects
                //
                // PERFORMANCE NOTE:
                // Yes, `keyed` forces recreation on every expand/collapse. This is the
                // CORRECT behavior - we need fresh component instances with fresh props.
                // The "performance cost" is actually the bug fix. Without it, the tree
                // is completely broken.
                return (
                  <Show when={flatItems()[virtualRow.index]} keyed>
                    {(item) => (
                      <div
                        data-index={virtualRow.index}
                        data-key={virtualRow.key}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                          // Calculate z-index reactively using scrollTop() signal
                          // Sections lift to z-11 when approaching (below top), stay under when past top
                          "z-index":
                            item.type === "section" &&
                            virtualRow.start - scrollTop() > 0 &&
                            virtualRow.start - scrollTop() < 50
                              ? "11"
                              : "auto",
                        }}
                      >
                        {item.type === "section" ? (
                          <div class="flex items-center justify-between py-2 px-3 bg-surface-overlay border-b border-border-muted font-semibold text-sm text-heading">
                            <div class="flex items-center gap-2">
                              <span>{item.label}</span>
                              <Show
                                when={
                                  item.label === "Today" ||
                                  item.label === "Yesterday" ||
                                  item.label.includes("days ago")
                                }
                              >
                                <span class="text-xs text-text-muted">{formatFullDate(item.date)}</span>
                              </Show>
                            </div>
                            <span class="text-xs font-normal text-text-muted">
                              {item.count} {item.count === 1 ? "Agent" : "Agents"}
                            </span>
                          </div>
                        ) : (
                          props.renderItem(
                            item.node,
                            props.selectedItemId === item.node.id,
                            focusAnimations().has(item.node.id),
                            focusAnimations().get(item.node.id),
                          )
                        )}
                      </div>
                    )}
                  </Show>
                );
              }}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default TreeView;
