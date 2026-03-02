// ABOUTME: Unit tests for TreeView component
// ABOUTME: Tests rendering, selection, expand/collapse, and date grouping

import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import TreeView, { flattenTree, groupByDateSections, type TreeNode } from "./TreeView";

// Helper to create mock tree nodes
const createMockNode = (overrides?: Partial<TreeNode>): TreeNode => ({
  id: "node-1",
  title: "Test Node",
  level: 0,
  children: [],
  collapsed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  clonedFrom: null,
  clonedAt: null,
  archivedAt: null,
  isActivelyWorking: false,
  hasUnreadMessages: false,
  modelName: "claude-sonnet-4",
  tokenUsage: 1000,
  ...overrides,
});

describe("TreeView", () => {
  it("renders empty state", () => {
    render(() => <TreeView items={[]} renderItem={() => <div>Item</div>} />);
    expect(screen.getByText("No items")).toBeInTheDocument();
  });

  it("exposes focusNode method via ref", () => {
    let refApi:
      | {
          focusNode: (itemId: string, options?: { scroll?: boolean; highlight?: boolean }) => void;
        }
      | undefined;
    const items = [createMockNode({ id: "1", title: "Node 1" })];

    render(() => (
      <TreeView
        items={items}
        renderItem={(node) => <div>{node.title}</div>}
        ref={(api) => {
          refApi = api;
        }}
      />
    ));

    // Ref should be called with an API object
    expect(refApi).toBeDefined();
    expect(refApi?.focusNode).toBeTypeOf("function");

    // Calling focusNode should not crash (even though scrolling won't work in jsdom)
    expect(() => refApi?.focusNode("1", { scroll: true })).not.toThrow();
    expect(() => refApi?.focusNode("invalid-id", { scroll: false })).not.toThrow();

    // Should throw if scroll option is not provided
    expect(() => refApi?.focusNode("1")).toThrow(/scroll option is required/);
  });

  it.skip("renders tree with items", () => {
    // SKIPPED: Virtualization doesn't work in jsdom (requires real DOM measurements)
    // The virtualizer needs actual scroll container dimensions to render items.
    // This test would pass in a real browser environment (Playwright/Puppeteer).
    // The important logic is tested via helper function tests below.
    const items = [createMockNode({ id: "1", title: "Node 1" }), createMockNode({ id: "2", title: "Node 2" })];

    const renderItem = (node: TreeNode) => <div data-testid={`node-${node.id}`}>{node.title}</div>;

    render(() => <TreeView items={items} renderItem={renderItem} />);

    expect(screen.getByTestId("node-1")).toBeInTheDocument();
    expect(screen.getByTestId("node-2")).toBeInTheDocument();
  });

  it.skip("renders section headers correctly", () => {
    // SKIPPED: Virtualization doesn't work in jsdom (requires real DOM measurements)
    // Section header rendering is validated via flattenTree helper function tests.
    const today = new Date();
    const items = [createMockNode({ id: "1", title: "Today's Node", createdAt: today })];

    render(() => <TreeView items={items} renderItem={(node) => <div>{node.title}</div>} />);

    // Should show "Today" section header
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText(/1 Agent/)).toBeInTheDocument();
  });

  it.skip("groups items by date correctly", () => {
    // SKIPPED: Virtualization doesn't work in jsdom (requires real DOM measurements)
    // Date grouping is validated via groupByDateSections helper function tests.
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const items = [
      createMockNode({ id: "1", title: "Today's Node", createdAt: today }),
      createMockNode({
        id: "2",
        title: "Yesterday's Node",
        createdAt: yesterday,
      }),
    ];

    render(() => <TreeView items={items} renderItem={(node) => <div>{node.title}</div>} />);

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });
});

describe("groupByDateSections", () => {
  it("groups nodes by date", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const items = [
      createMockNode({ id: "1", createdAt: today, updatedAt: today }),
      createMockNode({ id: "2", createdAt: today, updatedAt: today }),
      createMockNode({ id: "3", createdAt: yesterday, updatedAt: yesterday }),
    ];

    const grouped = groupByDateSections(items);

    // Should have 2 date groups
    expect(grouped.size).toBe(2);

    // Today's group should have 2 items
    const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    expect(grouped.get(todayKey)?.length).toBe(2);

    // Yesterday's group should have 1 item
    const yesterdayKey = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
    expect(grouped.get(yesterdayKey)?.length).toBe(1);
  });

  it("groups by max updatedAt across entire tree", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Tree with root from yesterday but child updated today
    const items = [
      createMockNode({
        id: "1",
        createdAt: yesterday,
        updatedAt: yesterday,
        children: [
          createMockNode({
            id: "2",
            level: 1,
            createdAt: today,
            updatedAt: today, // Child updated today
          }),
        ],
      }),
    ];

    const grouped = groupByDateSections(items);

    // Should be grouped under today (child's updatedAt)
    const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    expect(grouped.get(todayKey)?.length).toBe(1);
    expect(grouped.get(todayKey)?.[0]?.id).toBe("1");
  });

  it("handles deeply nested trees with max updatedAt", () => {
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Deep tree: root is 3 days old, child is 2 days old, grandchild is today
    const items = [
      createMockNode({
        id: "1",
        createdAt: threeDaysAgo,
        updatedAt: threeDaysAgo,
        children: [
          createMockNode({
            id: "2",
            level: 1,
            createdAt: twoDaysAgo,
            updatedAt: twoDaysAgo,
            children: [
              createMockNode({
                id: "3",
                level: 2,
                createdAt: today,
                updatedAt: today, // Grandchild updated today
              }),
            ],
          }),
        ],
      }),
    ];

    const grouped = groupByDateSections(items);

    // Should be grouped under today (grandchild's updatedAt)
    const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    expect(grouped.get(todayKey)?.length).toBe(1);
    expect(grouped.get(todayKey)?.[0]?.id).toBe("1");
  });
});

describe("flattenTree", () => {
  it("flattens tree with section headers", () => {
    const today = new Date();
    const items = [
      createMockNode({
        id: "1",
        title: "Parent",
        createdAt: today,
        children: [
          createMockNode({
            id: "2",
            title: "Child",
            level: 1,
            createdAt: today,
          }),
        ],
        collapsed: false,
      }),
    ];

    const flattened = flattenTree(items);

    // Should have section header + parent + child = 3 items
    expect(flattened.length).toBe(3);
    expect(flattened[0]?.type).toBe("section");
    expect(flattened[1]?.type).toBe("node");
    expect(flattened[2]?.type).toBe("node");
  });

  it("respects collapsed state", () => {
    const today = new Date();
    const items = [
      createMockNode({
        id: "1",
        title: "Parent",
        createdAt: today,
        children: [
          createMockNode({
            id: "2",
            title: "Child",
            level: 1,
            createdAt: today,
          }),
        ],
        collapsed: true,
      }),
    ];

    const flattened = flattenTree(items);

    // Should have section header + parent only (child hidden) = 2 items
    expect(flattened.length).toBe(2);
    expect(flattened[0]?.type).toBe("section");
    expect(flattened[1]?.type).toBe("node");
  });

  it("counts all descendants in section", () => {
    const today = new Date();
    const items = [
      createMockNode({
        id: "1",
        title: "Parent",
        createdAt: today,
        children: [
          createMockNode({
            id: "2",
            title: "Child",
            level: 1,
            createdAt: today,
            children: [
              createMockNode({
                id: "3",
                title: "Grandchild",
                level: 2,
                createdAt: today,
              }),
            ],
          }),
        ],
        collapsed: false,
      }),
    ];

    const flattened = flattenTree(items);
    const sectionHeader = flattened[0];

    // Section should count all 3 nodes (parent + child + grandchild)
    expect(sectionHeader?.type).toBe("section");
    if (sectionHeader?.type === "section") {
      expect(sectionHeader.count).toBe(3);
    }
  });
});
