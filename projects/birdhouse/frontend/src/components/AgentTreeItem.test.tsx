// ABOUTME: Unit tests for AgentTreeItem component
// ABOUTME: Tests rendering of agent metadata, indicators, and badges

import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { AgentTreeProvider } from "../contexts/AgentTreeContext";
import AgentTreeItem from "./AgentTreeItem";
import type { TreeNode } from "./TreeView";

// Mock the router hooks
vi.mock("@solidjs/router", () => ({
  useNavigate: () => vi.fn(),
}));

// Mock the WorkspaceContext
vi.mock("../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({
    workspaceId: "ws_test123",
    workspace: () => undefined,
    isLoading: () => false,
    error: () => null,
    refetch: vi.fn(),
  }),
}));

// Helper to create mock tree nodes
const createMockNode = (overrides?: Partial<TreeNode>): TreeNode => ({
  id: "node-1",
  title: "Test Agent",
  level: 0,
  children: [],
  collapsed: false,
  createdAt: new Date("2024-01-01T10:30:00"),
  updatedAt: new Date("2024-01-01T10:35:00"),
  clonedFrom: null,
  clonedAt: null,
  archivedAt: null,
  isActivelyWorking: false,
  hasUnreadMessages: false,
  modelName: "claude-sonnet-4",
  tokenUsage: 1000,
  ...overrides,
});

// Helper to render AgentTreeItem with context provider
const renderWithContext = (
  node: TreeNode,
  props?: { isSelected?: boolean },
  contextProps?: { selectAgent?: () => void; toggleCollapse?: () => void },
) => {
  const selectAgent = contextProps?.selectAgent || vi.fn();
  const toggleCollapse = contextProps?.toggleCollapse || vi.fn();

  return {
    ...render(() => (
      <AgentTreeProvider selectAgent={selectAgent} toggleCollapse={toggleCollapse}>
        <AgentTreeItem node={node} isSelected={props?.isSelected ?? false} focusAnimationStart={undefined} />
      </AgentTreeProvider>
    )),
    selectAgent,
    toggleCollapse,
  };
};

describe("AgentTreeItem", () => {
  it("renders agent title", () => {
    const node = createMockNode({ title: "My Test Agent" });
    renderWithContext(node);

    expect(screen.getByText("My Test Agent")).toBeInTheDocument();
  });

  it("shows working indicator when isActivelyWorking is true", () => {
    const node = createMockNode({ isActivelyWorking: true });
    const { container } = renderWithContext(node);

    const treeItem = container.querySelector(".tree-item");
    expect(treeItem?.className).toContain("working-gradient-pulse");
  });

  it("renders timestamp", () => {
    const updatedAt = new Date("2024-01-01T14:30:00");
    const node = createMockNode({ updatedAt });
    renderWithContext(node);

    // Should show time in format "2:30pm" (lowercase, no space) when same day
    expect(screen.getByText("2:30pm")).toBeInTheDocument();
  });

  it("does not render child count badge (feature removed)", () => {
    const node = createMockNode({
      children: [createMockNode({ id: "child-1", level: 1 }), createMockNode({ id: "child-2", level: 1 })],
    });
    renderWithContext(node);

    // Child count badge has been removed for cleaner UI
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("calls selectAgent when clicked", () => {
    const selectAgent = vi.fn();
    const node = createMockNode({ id: "test-node" });
    renderWithContext(node, {}, { selectAgent });

    const link = screen.getByRole("treeitem") as HTMLElement;
    link.click();

    expect(selectAgent).toHaveBeenCalledWith("test-node");
  });

  it("shows collapse indicator for items with children", () => {
    const node = createMockNode({
      children: [createMockNode({ id: "child-1", level: 1 })],
      collapsed: false,
    });
    renderWithContext(node);

    // Should show collapse button (▼)
    const collapseButton = screen.getByLabelText("Collapse");
    expect(collapseButton).toBeInTheDocument();
    expect(collapseButton.textContent).toBe("▼");
  });

  it("shows expand indicator for collapsed items with children", () => {
    const node = createMockNode({
      children: [createMockNode({ id: "child-1", level: 1 })],
      collapsed: true,
    });
    renderWithContext(node);

    // Should show expand button (rotated ▼)
    const expandButton = screen.getByLabelText("Expand");
    expect(expandButton).toBeInTheDocument();
  });

  it("calls toggleCollapse when collapse button clicked", () => {
    const toggleCollapse = vi.fn();
    const node = createMockNode({
      id: "parent-node",
      children: [createMockNode({ id: "child-1", level: 1 })],
    });
    renderWithContext(node, {}, { toggleCollapse });

    const collapseButton = screen.getByLabelText("Collapse") as HTMLElement;
    collapseButton.click();
    // Second argument is recursive flag (false when Alt key not pressed)
    expect(toggleCollapse).toHaveBeenCalledWith("parent-node", false);
  });

  it("no longer displays nested descendant count (feature removed)", () => {
    const node = createMockNode({
      children: [
        createMockNode({
          id: "child-1",
          level: 1,
          children: [
            createMockNode({ id: "grandchild-1", level: 2 }),
            createMockNode({ id: "grandchild-2", level: 2 }),
          ],
        }),
        createMockNode({ id: "child-2", level: 1 }),
      ],
    });
    renderWithContext(node);

    // Child count badge has been removed, so no count is displayed
    expect(screen.queryByText("4")).not.toBeInTheDocument();
  });
});
