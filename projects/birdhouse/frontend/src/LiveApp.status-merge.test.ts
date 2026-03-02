// ABOUTME: Tests for SSE status merging in treeWithCollapsedState memo
// ABOUTME: Prevents regression where status field wasn't updated from SSE store

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TreeNode } from "./components/TreeView";

/**
 * This test simulates the logic in LiveApp.tsx treeWithCollapsedState memo
 * to ensure SSE status updates are properly merged into tree nodes.
 */
describe("treeWithCollapsedState status merging", () => {
  /**
   * Simulates the applyState function from LiveApp.tsx:349-360
   */
  function applyState(
    node: TreeNode,
    agentStatuses: Record<string, { type: "idle" | "busy" | "retry" }>,
    collapsedState: Record<string, boolean>,
  ): TreeNode {
    // Get status from SSE store, fall back to node's status from API
    const status = agentStatuses[node.id] ?? node.status;

    const result: TreeNode = {
      ...node,
      collapsed: collapsedState[node.id] ?? node.collapsed,
      // Re-compute isActivelyWorking from latest status
      isActivelyWorking: status?.type === "busy" || status?.type === "retry",
      children: node.children.map((child) => applyState(child, agentStatuses, collapsedState)),
    };

    // Update status field if we have one (satisfies exactOptionalPropertyTypes)
    if (status !== undefined) {
      result.status = status;
    }

    return result;
  }

  it("preserves status field from SSE store update", () => {
    const node: TreeNode = {
      id: "agent_1",
      title: "Test Agent",
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
      tokenUsage: 0,
      status: { type: "idle" }, // Initial API value
    };

    // SSE update arrives - agent becomes busy
    const agentStatuses = {
      agent_1: { type: "busy" as const },
    };

    const result = applyState(node, agentStatuses, {});

    // CRITICAL: status field must be updated, not just isActivelyWorking
    expect(result.status?.type).toBe("busy");
    expect(result.isActivelyWorking).toBe(true);
  });

  it("falls back to API status when no SSE update exists", () => {
    const node: TreeNode = {
      id: "agent_1",
      title: "Test Agent",
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
      tokenUsage: 0,
      status: { type: "busy" }, // API says busy
    };

    // No SSE update for this agent
    const agentStatuses = {};

    const result = applyState(node, agentStatuses, {});

    // Should use API status
    expect(result.status?.type).toBe("busy");
    expect(result.isActivelyWorking).toBe(true);
  });

  it("handles undefined status gracefully", () => {
    const node: TreeNode = {
      id: "agent_1",
      title: "Test Agent",
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
      tokenUsage: 0,
      // No status field
    };

    const agentStatuses = {};

    const result = applyState(node, agentStatuses, {});

    // Should handle undefined without error
    expect(result.status).toBeUndefined();
    expect(result.isActivelyWorking).toBe(false);
  });

  it("recursively updates status for child nodes", () => {
    const node: TreeNode = {
      id: "agent_parent",
      title: "Parent",
      level: 0,
      children: [
        {
          id: "agent_child",
          title: "Child",
          level: 1,
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
          tokenUsage: 0,
          status: { type: "idle" },
        },
      ],
      collapsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      clonedFrom: null,
      clonedAt: null,
      archivedAt: null,
      isActivelyWorking: false,
      hasUnreadMessages: false,
      modelName: "claude-sonnet-4",
      tokenUsage: 0,
      status: { type: "idle" },
    };

    // SSE updates: parent and child both become busy
    const agentStatuses = {
      agent_parent: { type: "busy" as const },
      agent_child: { type: "busy" as const },
    };

    const result = applyState(node, agentStatuses, {});

    // Both parent and child should have updated status
    expect(result.status?.type).toBe("busy");
    expect(result.isActivelyWorking).toBe(true);
    expect(result.children[0]?.status?.type).toBe("busy");
    expect(result.children[0]?.isActivelyWorking).toBe(true);
  });

  it("prevents regression: status field changes trigger isActivelyWorking recompute", () => {
    const node: TreeNode = {
      id: "agent_1",
      title: "Test Agent",
      level: 0,
      children: [],
      collapsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      clonedFrom: null,
      clonedAt: null,
      archivedAt: null,
      isActivelyWorking: true, // Old computed value
      hasUnreadMessages: false,
      modelName: "claude-sonnet-4",
      tokenUsage: 0,
      status: { type: "busy" }, // Old status
    };

    // SSE update: agent goes idle
    const agentStatuses = {
      agent_1: { type: "idle" as const },
    };

    const result = applyState(node, agentStatuses, {});

    // Both status AND isActivelyWorking must update
    expect(result.status?.type).toBe("idle");
    expect(result.isActivelyWorking).toBe(false);

    // This is the regression test - if we only computed isActivelyWorking
    // but didn't update status field, next render would break
  });
});

describe("timestamp-based SSE vs API deduplication", () => {
  /**
   * Simulates the timestamp logic from LiveApp.tsx:95-135
   * Tracks SSE event times and only applies API status if SSE data is stale
   */
  let sseTimestamps: Map<string, number>;
  let currentTime: number;

  beforeEach(() => {
    sseTimestamps = new Map();
    currentTime = 1000000; // Start at arbitrary timestamp
    vi.useFakeTimers();
    vi.setSystemTime(currentTime);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Simulates the API status update logic from LiveApp.tsx:112-126
   * Returns whether API status should be applied for given agent
   */
  function shouldApplyApiStatus(agentId: string, fetchStartTime: number): boolean {
    const sseTime = sseTimestamps.get(agentId) || 0;
    // Use API data if we have no SSE data, or SSE data is from before this fetch
    return sseTime < fetchStartTime;
  }

  it("applies API status when SSE event arrived before fetch started", () => {
    const agentId = "agent_1";

    // SSE event arrives at t=1000
    currentTime = 1000;
    vi.setSystemTime(currentTime);
    sseTimestamps.set(agentId, Date.now());

    // API fetch starts at t=2000 (after SSE event)
    currentTime = 2000;
    vi.setSystemTime(currentTime);
    const fetchStartTime = Date.now();

    // API status should win - SSE data is stale
    expect(shouldApplyApiStatus(agentId, fetchStartTime)).toBe(true);
  });

  it("rejects API status when SSE event arrived during fetch", () => {
    const agentId = "agent_1";

    // API fetch starts at t=1000
    currentTime = 1000;
    vi.setSystemTime(currentTime);
    const fetchStartTime = Date.now();

    // SSE event arrives at t=1500 (during fetch)
    currentTime = 1500;
    vi.setSystemTime(currentTime);
    sseTimestamps.set(agentId, Date.now());

    // SSE status should win - API data is stale
    expect(shouldApplyApiStatus(agentId, fetchStartTime)).toBe(false);
  });

  it("applies API status for agent with no SSE data (timestamp defaults to 0)", () => {
    const agentId = "agent_new";

    // No SSE event for this agent
    // sseTimestamps.get(agentId) returns undefined -> defaults to 0

    // API fetch starts at any time
    currentTime = 5000;
    vi.setSystemTime(currentTime);
    const fetchStartTime = Date.now();

    // API status should win - no SSE data exists
    expect(shouldApplyApiStatus(agentId, fetchStartTime)).toBe(true);
  });

  it("handles multiple refetches with correct timestamp comparisons", () => {
    const agentId = "agent_1";

    // SSE event 1 arrives at t=1000
    currentTime = 1000;
    vi.setSystemTime(currentTime);
    sseTimestamps.set(agentId, Date.now());

    // First refetch at t=2000 (after SSE event 1)
    currentTime = 2000;
    vi.setSystemTime(currentTime);
    const fetchStartTime1 = Date.now();
    expect(shouldApplyApiStatus(agentId, fetchStartTime1)).toBe(true);

    // SSE event 2 arrives at t=3000 (after first fetch)
    currentTime = 3000;
    vi.setSystemTime(currentTime);
    sseTimestamps.set(agentId, Date.now());

    // Second refetch at t=4000 (after SSE event 2)
    currentTime = 4000;
    vi.setSystemTime(currentTime);
    const fetchStartTime2 = Date.now();
    expect(shouldApplyApiStatus(agentId, fetchStartTime2)).toBe(true);

    // SSE event 3 arrives at t=4500 (during second fetch conceptually)
    currentTime = 4500;
    vi.setSystemTime(currentTime);
    sseTimestamps.set(agentId, Date.now());

    // Third refetch at t=5000
    currentTime = 5000;
    vi.setSystemTime(currentTime);
    const fetchStartTime3 = Date.now();
    // SSE at 4500 is before fetch at 5000, so API should win
    expect(shouldApplyApiStatus(agentId, fetchStartTime3)).toBe(true);
  });

  it("handles race condition: SSE event arrives just before fetch completes", () => {
    const agentId = "agent_1";

    // API fetch starts at t=1000
    currentTime = 1000;
    vi.setSystemTime(currentTime);
    const fetchStartTime = Date.now();

    // ... network delay ...

    // SSE event arrives at t=1999 (just before fetch completes at t=2000)
    currentTime = 1999;
    vi.setSystemTime(currentTime);
    sseTimestamps.set(agentId, Date.now());

    // Fetch completes at t=2000
    currentTime = 2000;
    vi.setSystemTime(currentTime);

    // SSE timestamp (1999) > fetchStartTime (1000)
    // SSE status should win - it's fresher
    expect(shouldApplyApiStatus(agentId, fetchStartTime)).toBe(false);
  });

  it("handles simultaneous updates to different agents independently", () => {
    const agent1 = "agent_1";
    const agent2 = "agent_2";

    // SSE for agent1 at t=1000
    currentTime = 1000;
    vi.setSystemTime(currentTime);
    sseTimestamps.set(agent1, Date.now());

    // Fetch starts at t=1500
    currentTime = 1500;
    vi.setSystemTime(currentTime);
    const fetchStartTime = Date.now();

    // SSE for agent2 at t=2000 (during fetch)
    currentTime = 2000;
    vi.setSystemTime(currentTime);
    sseTimestamps.set(agent2, Date.now());

    // Agent1: SSE before fetch -> API wins
    expect(shouldApplyApiStatus(agent1, fetchStartTime)).toBe(true);

    // Agent2: SSE during fetch -> SSE wins
    expect(shouldApplyApiStatus(agent2, fetchStartTime)).toBe(false);
  });
});
