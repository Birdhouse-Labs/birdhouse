// ABOUTME: Resizable demo component showing draggable panel layouts
// ABOUTME: Includes basic resizable panels and advanced splittable panes demo

import Resizable from "corvu/resizable";
import { type Component, createSignal, type JSX, Show } from "solid-js";
import { Button } from "../components/ui";

// Pane data structure for splittable demo
type PaneNode =
  | {
      id: string;
      type: "leaf";
    }
  | {
      id: string;
      type: "split";
      direction: "horizontal" | "vertical";
      children: [PaneNode, PaneNode];
    };

let paneIdCounter = 0;
const generatePaneId = () => `pane-${++paneIdCounter}`;

const SplittablePanesDemo: Component = () => {
  const [root, setRoot] = createSignal<PaneNode>({
    id: generatePaneId(),
    type: "leaf",
  });

  const splitPane = (paneId: string, direction: "horizontal" | "vertical") => {
    const splitNode = (node: PaneNode): PaneNode => {
      if (node.type === "leaf" && node.id === paneId) {
        return {
          id: node.id,
          type: "split",
          direction,
          children: [
            { id: generatePaneId(), type: "leaf" },
            { id: generatePaneId(), type: "leaf" },
          ],
        };
      }
      if (node.type === "split") {
        return {
          ...node,
          children: [splitNode(node.children[0]), splitNode(node.children[1])],
        };
      }
      return node;
    };
    setRoot(splitNode(root()));
  };

  const closePane = (paneId: string) => {
    const removeNode = (node: PaneNode, _parentNode?: PaneNode): PaneNode | null => {
      if (node.type === "leaf") {
        return node.id === paneId ? null : node;
      }

      // Check if either child is the pane to close
      const leftChild = node.children[0];
      const rightChild = node.children[1];

      // If left child is the one to close, return right child (promoted up)
      if (leftChild.type === "leaf" && leftChild.id === paneId) {
        return rightChild;
      }
      // If right child is the one to close, return left child (promoted up)
      if (rightChild.type === "leaf" && rightChild.id === paneId) {
        return leftChild;
      }

      // Recurse into children
      const newLeft = removeNode(leftChild, node);
      const newRight = removeNode(rightChild, node);

      // If a child was removed and replaced, update the tree
      if (newLeft !== leftChild || newRight !== rightChild) {
        return {
          ...node,
          children: [newLeft || leftChild, newRight || rightChild] as [PaneNode, PaneNode],
        };
      }

      return node;
    };

    const newRoot = removeNode(root());
    if (newRoot) {
      setRoot(newRoot);
    }
  };

  const canClose = () => root().type === "split";

  const resetPanes = () => {
    paneIdCounter = 0;
    setRoot({ id: generatePaneId(), type: "leaf" });
  };

  // Pane colors use theme tokens for the first color, then rotate through other accents
  const defaultColor = {
    gradient: "from-gradient-from/20 to-gradient-to/20",
    text: "text-accent",
  };

  const colors = [
    defaultColor,
    {
      gradient: "from-cyan-500/20 to-blue-500/20",
      text: "text-cyan-500",
    },
    {
      gradient: "from-emerald-500/20 to-teal-500/20",
      text: "text-emerald-500",
    },
    {
      gradient: "from-amber-500/20 to-orange-500/20",
      text: "text-amber-500",
    },
    {
      gradient: "from-rose-500/20 to-red-500/20",
      text: "text-rose-500",
    },
  ];

  const getColorIndex = (id: string) => {
    const num = parseInt(id.replace("pane-", ""), 10) || 0;
    return num % colors.length;
  };

  const renderPane = (node: PaneNode): JSX.Element => {
    if (node.type === "leaf") {
      const colorIdx = getColorIndex(node.id);
      const color = colors[colorIdx] ?? defaultColor;
      return (
        <div
          class={`h-full w-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br p-2 relative ${color.gradient}`}
        >
          {/* Close button - only show if there are multiple panes */}
          <Show when={canClose()}>
            <button
              type="button"
              onClick={() => closePane(node.id)}
              class="absolute top-1 right-1 w-5 h-5 flex items-center justify-center text-xs rounded transition-colors opacity-60 hover:opacity-100 bg-surface-overlay/70 hover:bg-red-500 hover:text-white text-text-secondary"
              title="Close Pane"
            >
              ×
            </button>
          </Show>
          <p class={`font-medium text-sm ${color.text}`}>Pane {node.id.replace("pane-", "")}</p>
          <div class="flex gap-1">
            <button
              type="button"
              onClick={() => splitPane(node.id, "horizontal")}
              class="px-2 py-1 text-xs rounded transition-colors bg-surface-overlay/70 hover:bg-surface-overlay text-text-primary"
              title="Split Horizontal"
              aria-label="Split pane horizontally"
            >
              <span aria-hidden="true">↔</span>
            </button>
            <button
              type="button"
              onClick={() => splitPane(node.id, "vertical")}
              class="px-2 py-1 text-xs rounded transition-colors bg-surface-overlay/70 hover:bg-surface-overlay text-text-primary"
              title="Split Vertical"
              aria-label="Split pane vertically"
            >
              ↕
            </button>
          </div>
        </div>
      );
    }

    const isHorizontal = node.direction === "horizontal";

    return (
      <Resizable orientation={isHorizontal ? "horizontal" : "vertical"} class="h-full w-full">
        {() => (
          <>
            <Resizable.Panel initialSize={0.5} minSize={0.1} class="overflow-hidden">
              {renderPane(node.children[0])}
            </Resizable.Panel>
            <Resizable.Handle
              aria-label="Resize handle"
              class="flex items-center justify-center transition-colors bg-border-muted hover:bg-accent"
              classList={{
                "w-1.5 cursor-col-resize": isHorizontal,
                "h-1.5 cursor-row-resize": !isHorizontal,
              }}
            >
              <div
                class="rounded-full bg-text-muted"
                classList={{
                  "w-0.5 h-6": isHorizontal,
                  "h-0.5 w-6": !isHorizontal,
                }}
              />
            </Resizable.Handle>
            <Resizable.Panel initialSize={0.5} minSize={0.1} class="overflow-hidden">
              {renderPane(node.children[1])}
            </Resizable.Panel>
          </>
        )}
      </Resizable>
    );
  };

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-heading">Splittable Panes</h3>
        <Button variant="secondary" onClick={resetPanes}>
          Reset
        </Button>
      </div>
      <p class="text-sm text-text-secondary">
        Click ↔ or ↕ to split panes. Drag handles to resize. Click × to close panes.
      </p>
      <div class="w-full h-80 rounded-xl overflow-hidden border border-border-muted">{renderPane(root())}</div>
    </div>
  );
};

const ResizableDemo: Component = () => {
  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Resizable</h2>
        <p class="text-sm text-text-secondary hidden md:block">Draggable panel layouts with nested splits</p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Basic Example */}
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-heading">Basic Example</h3>
          <div class="w-full h-48 rounded-xl overflow-hidden border border-border-muted">
            <Resizable class="h-full">
              {(props) => (
                <>
                  <Resizable.Panel
                    initialSize={0.3}
                    minSize={0.15}
                    class="flex items-center justify-center bg-gradient-to-br from-gradient-from/20 to-gradient-to/20"
                  >
                    <div class="text-center">
                      <p class="font-medium text-accent">Sidebar</p>
                      <p class="text-sm text-text-muted">{((props.sizes[0] ?? 0) * 100).toFixed(0)}%</p>
                    </div>
                  </Resizable.Panel>
                  <Resizable.Handle
                    aria-label="Resize handle"
                    class="w-2 bg-border-muted hover:bg-accent transition-colors cursor-col-resize flex items-center justify-center"
                  >
                    <div class="w-0.5 h-8 rounded-full bg-text-muted" />
                  </Resizable.Handle>
                  <Resizable.Panel initialSize={0.7} minSize={0.3} class="flex items-center justify-center bg-surface">
                    <div class="text-center">
                      <p class="font-medium text-text-secondary">Main Content</p>
                      <p class="text-sm text-text-muted">{((props.sizes[1] ?? 0) * 100).toFixed(0)}%</p>
                    </div>
                  </Resizable.Panel>
                </>
              )}
            </Resizable>
          </div>
        </div>

        {/* Splittable Panes */}
        <SplittablePanesDemo />
      </div>
    </div>
  );
};

export default ResizableDemo;
