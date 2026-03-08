// ABOUTME: Specific rendering component for agent tree items
// ABOUTME: Shows agent metadata including status indicators, badges, and timestamps

import { type Component, createMemo, Show } from "solid-js";
import { useAgentTree } from "../contexts/AgentTreeContext";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { recordAgentView } from "../utils/agent-navigation";
import AgentInfoPopover from "./AgentInfoPopover";
import type { TreeNode } from "./TreeView";

export interface AgentTreeItemProps {
  node: TreeNode;
  isSelected: boolean;
  focusAnimationStart?: number | undefined;
}

const AgentTreeItem: Component<AgentTreeItemProps> = (props) => {
  // Get actions from context (no prop drilling!)
  const context = useAgentTree();
  const { selectAgent, toggleCollapse } = context;
  const { workspaceId } = useWorkspace();

  const hasChildren = () => props.node.children.length > 0;

  // Check if this node matched the search query (call getter to preserve reactivity)
  const isMatchedNode = () => {
    const matchedIds = context.matchedAgentIds(); // Call the getter!
    return matchedIds?.has(props.node.id) ?? false;
  };

  // Calculate effective level for indentation (0 if in flat mode OR if matched in tree mode)
  const effectiveLevel = () => {
    if (context.flatMode()) return 0;
    if (isMatchedNode()) return 0; // Matched nodes always at root level
    return props.node.level;
  };

  // Get the section date for smart time formatting
  // Falls back to node's own day if sectionDate not set
  const sectionDate = createMemo(() => {
    if (props.node.sectionDate) {
      return props.node.sectionDate;
    }
    // Fallback: use the node's own updatedAt day
    const d = props.node.updatedAt;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });

  // Calculate animation delay to continue from where it left off
  const animationDelay = createMemo(() => {
    if (!props.focusAnimationStart) return undefined;
    const elapsed = Date.now() - props.focusAnimationStart;
    // If animation should have finished, don't show it
    if (elapsed >= 5000) return undefined;
    // Return negative delay to start partway through
    return `-${elapsed}ms`;
  });

  const isFocused = () => props.focusAnimationStart !== undefined;

  // Handle navigation - let browser handle Ctrl/Cmd+Click natively via the <a> tag
  const handleClick = (e: MouseEvent) => {
    // If modifier keys are pressed, let the browser's native link behavior handle it
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      return;
    }
    // Normal click: prevent default link navigation and use SPA routing
    e.preventDefault();
    // Track this agent as viewed
    recordAgentView(props.node.id);
    selectAgent(props.node.id);
  };

  return (
    <div
      class="tree-item flex items-center border-b border-border-muted/30"
      classList={{
        "animate-focus-highlight": isFocused(),
        "relative overflow-hidden": true,
        "working-gradient-pulse": props.node.isActivelyWorking,
        "matched-node": isMatchedNode(),
      }}
      style={{
        height: "26px",
        "animation-delay": animationDelay(),
      }}
    >
      <a
        href={`#/workspace/${workspaceId}/agent/${props.node.id}`}
        role="treeitem"
        tabIndex={0}
        aria-expanded={hasChildren() ? !props.node.collapsed : undefined}
        class="flex items-center gap-2 px-2 select-none no-underline flex-1 min-w-0"
        style={{
          "padding-left": `${effectiveLevel() * 16 + 8}px`,
        }}
        onClick={handleClick}
        data-ph-capture-attribute-element-type="agent-tree-item"
        data-ph-capture-attribute-agent-id={props.node.id}
        data-ph-capture-attribute-workspace-id={workspaceId}
        data-ph-capture-attribute-is-selected={props.isSelected ? "true" : "false"}
        data-ph-capture-attribute-has-children={hasChildren() ? "true" : "false"}
        data-ph-capture-attribute-is-collapsed={props.node.collapsed ? "true" : "false"}
        data-ph-capture-attribute-is-working={props.node.isActivelyWorking ? "true" : "false"}
      >
        {/* Gradient pulse overlay */}
        <div class="gradient-overlay" />

        {/* Content wrapper (z-index above gradient) */}
        <div class="flex items-center gap-1 w-full relative z-10">
          {/* Collapse/Expand Icon - Only this is clickable */}
          <Show
            when={hasChildren()}
            fallback={
              <span
                class="w-4 h-4 flex items-center justify-center text-[10px] flex-shrink-0"
                classList={{
                  "text-text-on-accent": props.node.isActivelyWorking || isMatchedNode(),
                  "text-text-muted": !props.node.isActivelyWorking && !isMatchedNode() && !props.isSelected,
                  "text-text-primary": !props.node.isActivelyWorking && !isMatchedNode() && props.isSelected,
                }}
              >
                •
              </span>
            }
          >
            <button
              type="button"
              class="w-4 h-4 flex items-center justify-center text-[10px] transition-all duration-200 flex-shrink-0 hover:text-accent cursor-pointer"
              classList={{
                "rotate-0": !props.node.collapsed,
                "-rotate-90": props.node.collapsed,
                "text-text-on-accent": props.node.isActivelyWorking || isMatchedNode(),
                "text-text-muted": !props.node.isActivelyWorking && !isMatchedNode() && !props.isSelected,
                "text-text-primary": !props.node.isActivelyWorking && !isMatchedNode() && props.isSelected,
              }}
              onClick={(e) => {
                e.preventDefault(); // Prevent <a> navigation
                e.stopPropagation(); // Prevent onClick from bubbling to <a>
                // Alt+click (Option+click on Mac) triggers recursive expand/collapse
                toggleCollapse(props.node.id, e.altKey);
              }}
              aria-label={props.node.collapsed ? "Expand" : "Collapse"}
              data-ph-capture-attribute-button-type="toggle-collapse-tree-node"
              data-ph-capture-attribute-agent-id={props.node.id}
              data-ph-capture-attribute-is-collapsed={props.node.collapsed ? "true" : "false"}
              data-ph-capture-attribute-action={props.node.collapsed ? "expand" : "collapse"}
            >
              ▼
            </button>
          </Show>

          {/* Title - single line with truncation */}
          <span
            class="text-xs flex-1 min-w-0 truncate"
            classList={{
              "text-text-on-accent": props.node.isActivelyWorking || isMatchedNode(),
              "text-text-primary font-bold":
                !props.node.isActivelyWorking &&
                !isMatchedNode() &&
                (props.isSelected || (isMatchedNode() && !context.flatMode())),
              "text-text-secondary":
                !props.node.isActivelyWorking &&
                !isMatchedNode() &&
                !props.isSelected &&
                !(isMatchedNode() && !context.flatMode()),
              "font-bold": props.isSelected || (isMatchedNode() && !context.flatMode()),
            }}
          >
            {props.node.title}
          </span>
        </div>
        {/* Close content wrapper */}

        {/* CSS for gradient pulse and matched node indicator */}
        <style>{`
        .gradient-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to right,
            var(--theme-gradient-from),
            var(--theme-gradient-to)
          );
          opacity: 0;
          pointer-events: none;
          z-index: 0;
        }

        @keyframes gradient-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        .working-gradient-pulse .gradient-overlay {
          animation: gradient-pulse 2s ease-in-out infinite;
          opacity: 1;
        }

        .matched-node::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 6px;
          background: linear-gradient(
            to bottom,
            var(--theme-gradient-from),
            var(--theme-gradient-to)
          );
          z-index: 1;
        }

        .matched-node::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to right,
            var(--theme-gradient-from),
            var(--theme-gradient-to)
          );
          opacity: 0.5;
          pointer-events: none;
          z-index: 0;
        }
      `}</style>
      </a>

      {/* Time - with popover - OUTSIDE the <a> tag */}
      <AgentInfoPopover
        agentId={props.node.id}
        workspaceId={workspaceId}
        title={props.node.title}
        modelName={props.node.modelName}
        createdAt={props.node.createdAt}
        updatedAt={props.node.updatedAt}
        tokenUsage={props.node.tokenUsage}
        clonedFrom={props.node.clonedFrom}
        clonedAt={props.node.clonedAt}
        isSelected={props.isSelected}
        isGradientActive={props.node.isActivelyWorking || isMatchedNode()}
        sectionDate={sectionDate()}
        onAgentLinkClick={(agentId, metaKey) => {
          if (metaKey) {
            // Meta+click: open in new tab via hash navigation
            window.open(`#/workspace/${workspaceId}/agent/${agentId}`, "_blank");
          } else {
            // Normal click: navigate in current view
            recordAgentView(agentId);
            selectAgent(agentId);
          }
        }}
      />
    </div>
  );
};

export default AgentTreeItem;
