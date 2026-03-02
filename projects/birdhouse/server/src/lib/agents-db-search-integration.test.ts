// ABOUTME: Integration tests for search with tree loading
// ABOUTME: Verifies searchAgentsWithTrees works correctly with loadAllAgentTrees

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type AgentsDB, createAgentsDB, insertTestData, loadAllAgentTrees } from "./agents-db";

describe("Search + Tree Loading Integration", () => {
  let db: AgentsDB;

  beforeEach(() => {
    db = createAgentsDB(":memory:");
    insertTestData(db);
  });

  afterEach(() => {
    db.close();
  });

  test("searchAgentsWithTrees + loadAllAgentTrees produces valid trees", () => {
    // Search for agents
    const result = db.searchAgentsWithTrees("agent");

    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    expect(result.matchedAgentIds.length).toBeGreaterThanOrEqual(1);

    // Load trees from the filtered rows
    const trees = loadAllAgentTrees(db, "updated_at", "desc", result.rows);

    // Verify we got trees
    expect(trees.length).toBeGreaterThanOrEqual(1);

    // Verify tree structure is valid
    for (const tree of trees) {
      // Root should match tree_id
      expect(tree.root.id).toBe(tree.tree_id);
      expect(tree.root.level).toBe(0);
      expect(tree.root.parent_id).toBeNull();

      // Count should match actual nodes
      let actualCount = 0;
      const countNodes = (node: typeof tree.root): number => {
        return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
      };
      actualCount = countNodes(tree.root);
      expect(tree.count).toBe(actualCount);
    }
  });

  test("filtered trees contain only matching tree_ids", () => {
    // Search for something specific
    const result = db.searchAgentsWithTrees("Bug Investigation");

    // Load trees
    const trees = loadAllAgentTrees(db, "updated_at", "desc", result.rows);

    // Get tree_ids from matched agents
    const matchedTreeIds = new Set(
      result.matchedAgentIds.map((id) => {
        const agent = result.rows.find((r) => r.id === id);
        return agent?.tree_id;
      }),
    );

    // Verify trees only include matching tree_ids
    for (const tree of trees) {
      expect(matchedTreeIds.has(tree.tree_id)).toBe(true);
    }
  });

  test("loadAllAgentTrees without preFilteredRows loads all trees", () => {
    // Load all trees
    const allTrees = loadAllAgentTrees(db, "updated_at", "desc");

    // Load filtered trees
    const result = db.searchAgentsWithTrees("Bug Investigation");
    const filteredTrees = loadAllAgentTrees(db, "updated_at", "desc", result.rows);

    // Filtered should be subset of all
    expect(filteredTrees.length).toBeLessThanOrEqual(allTrees.length);
    expect(filteredTrees.length).toBeGreaterThanOrEqual(1);
  });

  test("tree assembly works correctly with searchAgentsWithTrees rows", () => {
    // Search for agents that span multiple trees
    const result = db.searchAgentsWithTrees("agent", "updated_at", "desc");
    const trees = loadAllAgentTrees(db, "updated_at", "desc", result.rows);

    // Verify parent-child relationships are correct
    for (const tree of trees) {
      const verify = (node: typeof tree.root, expectedTreeId: string) => {
        expect(node.tree_id).toBe(expectedTreeId);

        for (const child of node.children) {
          expect(child.parent_id).toBe(node.id);
          expect(child.tree_id).toBe(expectedTreeId);
          expect(child.level).toBe(node.level + 1);
          verify(child, expectedTreeId);
        }
      };

      verify(tree.root, tree.tree_id);
    }
  });

  test("sorting parameter is respected through the full pipeline", () => {
    // Test with updated_at DESC
    const resultUpdatedDesc = db.searchAgentsWithTrees("agent", "updated_at", "desc");
    const treesUpdatedDesc = loadAllAgentTrees(db, "updated_at", "desc", resultUpdatedDesc.rows);

    // Test with created_at ASC
    const resultCreatedAsc = db.searchAgentsWithTrees("agent", "created_at", "asc");
    const treesCreatedAsc = loadAllAgentTrees(db, "created_at", "asc", resultCreatedAsc.rows);

    // Both should produce valid trees
    expect(treesUpdatedDesc.length).toBeGreaterThanOrEqual(1);
    expect(treesCreatedAsc.length).toBeGreaterThanOrEqual(1);

    // Order should be different (DESC vs ASC)
    // Verify DESC order
    if (treesUpdatedDesc.length > 1) {
      const tree0MaxUpdated = Math.max(
        treesUpdatedDesc[0].root.updated_at,
        ...treesUpdatedDesc[0].root.children.map((c) => c.updated_at),
      );
      const tree1MaxUpdated = Math.max(
        treesUpdatedDesc[1].root.updated_at,
        ...treesUpdatedDesc[1].root.children.map((c) => c.updated_at),
      );
      expect(tree0MaxUpdated).toBeGreaterThanOrEqual(tree1MaxUpdated);
    }

    // Verify ASC order
    if (treesCreatedAsc.length > 1) {
      const tree0Created = treesCreatedAsc[0].root.created_at;
      const tree1Created = treesCreatedAsc[1].root.created_at;
      expect(tree0Created).toBeLessThanOrEqual(tree1Created);
    }
  });

  test("sortDir parameter works with both sortBy options", () => {
    // Test all combinations
    const combos = [
      { sortBy: "updated_at" as const, sortDir: "desc" as const },
      { sortBy: "updated_at" as const, sortDir: "asc" as const },
      { sortBy: "created_at" as const, sortDir: "desc" as const },
      { sortBy: "created_at" as const, sortDir: "asc" as const },
    ];

    for (const { sortBy, sortDir } of combos) {
      const result = db.searchAgentsWithTrees("agent", sortBy, sortDir);
      const trees = loadAllAgentTrees(db, sortBy, sortDir, result.rows);

      // Should produce valid trees
      expect(trees.length).toBeGreaterThanOrEqual(1);

      // Each tree should be valid
      for (const tree of trees) {
        expect(tree.root.level).toBe(0);
        expect(tree.count).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
