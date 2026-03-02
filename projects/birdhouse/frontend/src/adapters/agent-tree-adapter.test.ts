// ABOUTME: Unit tests for agent tree adapter mapping backend to frontend format
// ABOUTME: Tests status field mapping to isActivelyWorking boolean

import { describe, expect, it } from "vitest";
import type { BackendAgentNode } from "./agent-tree-adapter";
import { mapAgentNode, mapAgentTrees } from "./agent-tree-adapter";

describe("mapAgentNode", () => {
  const createMockBackendNode = (overrides?: Partial<BackendAgentNode>): BackendAgentNode => ({
    id: "agent_123",
    session_id: "ses_456",
    parent_id: null,
    tree_id: "agent_123",
    level: 0,
    title: "Test Agent",
    project_id: "proj_789",
    directory: "/test",
    model: "anthropic/claude-sonnet-4",
    created_at: Date.now(),
    updated_at: Date.now(),
    cloned_from: null,
    cloned_at: null,
    archived_at: null,
    children: [],
    ...overrides,
  });

  describe("status field mapping", () => {
    it('maps status.type "busy" to isActivelyWorking: true', () => {
      const node = createMockBackendNode({
        status: { type: "busy" },
      });

      const result = mapAgentNode(node);

      expect(result.isActivelyWorking).toBe(true);
    });

    it('maps status.type "retry" to isActivelyWorking: true', () => {
      const node = createMockBackendNode({
        status: { type: "retry" },
      });

      const result = mapAgentNode(node);

      expect(result.isActivelyWorking).toBe(true);
    });

    it('maps status.type "idle" to isActivelyWorking: false', () => {
      const node = createMockBackendNode({
        status: { type: "idle" },
      });

      const result = mapAgentNode(node);

      expect(result.isActivelyWorking).toBe(false);
    });

    it("maps missing status to isActivelyWorking: false", () => {
      const node = createMockBackendNode();
      // Don't set status - it should be undefined

      const result = mapAgentNode(node);

      expect(result.isActivelyWorking).toBe(false);
    });

    it("recursively maps status for all children", () => {
      const node = createMockBackendNode({
        status: { type: "idle" },
        children: [
          createMockBackendNode({
            id: "agent_child1",
            level: 1,
            status: { type: "busy" },
            children: [],
          }),
          createMockBackendNode({
            id: "agent_child2",
            level: 1,
            status: { type: "idle" },
            children: [],
          }),
        ],
      });

      const result = mapAgentNode(node);

      expect(result.isActivelyWorking).toBe(false); // Parent is idle
      expect(result.children).toHaveLength(2);
      expect(result.children[0]?.isActivelyWorking).toBe(true); // Child1 is busy
      expect(result.children[1]?.isActivelyWorking).toBe(false); // Child2 is idle
    });

    it("preserves status field in mapped TreeNode (prevents regression)", () => {
      const node = createMockBackendNode({
        status: { type: "busy" },
      });

      const result = mapAgentNode(node);

      // CRITICAL: status field must be included, not just used for isActivelyWorking
      expect(result.status).toBeDefined();
      expect(result.status?.type).toBe("busy");
      expect(result.isActivelyWorking).toBe(true);
    });

    it("preserves status field recursively for children", () => {
      const node = createMockBackendNode({
        status: { type: "idle" },
        children: [
          createMockBackendNode({
            id: "agent_child",
            level: 1,
            status: { type: "busy" },
            children: [],
          }),
        ],
      });

      const result = mapAgentNode(node);

      // Parent status preserved
      expect(result.status?.type).toBe("idle");

      // Child status preserved
      expect(result.children[0]?.status).toBeDefined();
      expect(result.children[0]?.status?.type).toBe("busy");
    });
  });

  describe("basic mapping", () => {
    it("maps basic node fields correctly", () => {
      const now = Date.now();
      const node = createMockBackendNode({
        id: "agent_abc",
        title: "My Agent",
        level: 2,
        model: "anthropic/claude-opus-4",
        created_at: now - 1000,
        updated_at: now,
      });

      const result = mapAgentNode(node);

      expect(result.id).toBe("agent_abc");
      expect(result.title).toBe("My Agent");
      expect(result.level).toBe(2);
      expect(result.modelName).toBe("anthropic/claude-opus-4");
      expect(result.createdAt).toEqual(new Date(now - 1000));
      expect(result.updatedAt).toEqual(new Date(now));
      expect(result.collapsed).toBe(false); // Default value
    });

    it("maps children recursively", () => {
      const node = createMockBackendNode({
        children: [
          createMockBackendNode({
            id: "agent_child",
            level: 1,
            children: [],
          }),
        ],
      });

      const result = mapAgentNode(node);

      expect(result.children).toHaveLength(1);
      expect(result.children[0]?.id).toBe("agent_child");
      expect(result.children[0]?.level).toBe(1);
    });
  });
});

describe("mapAgentTrees", () => {
  it("maps array of backend trees to array of frontend root nodes", () => {
    const trees = [
      {
        tree_id: "agent_1",
        root: {
          id: "agent_1",
          session_id: "ses_1",
          parent_id: null,
          tree_id: "agent_1",
          level: 0,
          title: "Tree 1",
          project_id: "proj_1",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          created_at: Date.now(),
          updated_at: Date.now(),
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          children: [],
          status: { type: "busy" as const },
        },
        count: 1,
      },
      {
        tree_id: "agent_2",
        root: {
          id: "agent_2",
          session_id: "ses_2",
          parent_id: null,
          tree_id: "agent_2",
          level: 0,
          title: "Tree 2",
          project_id: "proj_1",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          created_at: Date.now(),
          updated_at: Date.now(),
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          children: [],
          status: { type: "idle" as const },
        },
        count: 1,
      },
    ];

    const result = mapAgentTrees(trees);

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("agent_1");
    expect(result[0]?.isActivelyWorking).toBe(true);
    expect(result[1]?.id).toBe("agent_2");
    expect(result[1]?.isActivelyWorking).toBe(false);
  });
});
