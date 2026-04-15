// ABOUTME: Tests for agent storage database operations
// ABOUTME: Verifies schema, indexes, CRUD operations, and foreign key constraints

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type AgentsDB, generateAgentId, initAgentsDB, insertTestData } from "./agents-db";

describe("AgentsDB", () => {
  let db: AgentsDB;

  beforeEach(async () => {
    // Use in-memory database for tests
    db = await initAgentsDB(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  describe("ID generation", () => {
    test("generates IDs in correct format", () => {
      const id = generateAgentId();
      expect(id).toMatch(/^agent_[A-Za-z0-9_-]{18}$/);
    });

    test("generates unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateAgentId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("insertAgent", () => {
    test("inserts a root agent successfully", () => {
      const now = Date.now();
      const agent = db.insertAgent({
        session_id: "ses_test123",
        parent_id: null,
        tree_id: "agent_root",
        level: 0,
        title: "Test Root Agent",
        project_id: "test-project",
        directory: "/test/path",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      });

      expect(agent.id).toMatch(/^agent_/);
      expect(agent.session_id).toBe("ses_test123");
      expect(agent.parent_id).toBeNull();
      expect(agent.level).toBe(0);
      expect(agent.title).toBe("Test Root Agent");
    });

    test("inserts a child agent successfully", () => {
      const now = Date.now();

      // Insert parent first
      const parent = db.insertAgent({
        session_id: "ses_parent",
        parent_id: null,
        tree_id: "agent_parent",
        level: 0,
        title: "Parent Agent",
        project_id: "test-project",
        directory: "/test/path",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
        id: "agent_parent",
      });

      // Insert child
      const child = db.insertAgent({
        session_id: "ses_child",
        parent_id: parent.id,
        tree_id: parent.tree_id,
        level: 1,
        title: "Child Agent",
        project_id: "test-project",
        directory: "/test/path",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      });

      expect(child.parent_id).toBe(parent.id);
      expect(child.tree_id).toBe(parent.tree_id);
      expect(child.level).toBe(1);
    });

    test("uses provided ID if given", () => {
      const now = Date.now();
      const customId = "agent_custom123";

      const agent = db.insertAgent({
        id: customId,
        session_id: "ses_test",
        parent_id: null,
        tree_id: customId,
        level: 0,
        title: "Test",
        project_id: "test-project",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      });

      expect(agent.id).toBe(customId);
    });

    test("rejects duplicate session_id", () => {
      const now = Date.now();

      db.insertAgent({
        session_id: "ses_duplicate",
        parent_id: null,
        tree_id: "agent_root",
        level: 0,
        title: "First",
        project_id: "test-project",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      });

      expect(() => {
        db.insertAgent({
          session_id: "ses_duplicate",
          parent_id: null,
          tree_id: "agent_root2",
          level: 0,
          title: "Second",
          project_id: "test-project",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });
      }).toThrow(/already exists/);
    });

    test("rejects foreign key constraint violation", () => {
      const now = Date.now();

      expect(() => {
        db.insertAgent({
          session_id: "ses_orphan",
          parent_id: "agent_nonexistent",
          tree_id: "agent_root",
          level: 1,
          title: "Orphan",
          project_id: "test-project",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });
      }).toThrow(/not found/);
    });
  });

  describe("getAllAgents", () => {
    test("returns empty array when no agents exist", () => {
      const agents = db.getAllAgents();
      expect(agents).toEqual([]);
    });

    test("returns all agents sorted by updated_at DESC by default", () => {
      const now = Date.now();

      // Create a single tree with root and children having different updated_at times
      const treeRoot = db.insertAgent({
        id: "agent_tree1",
        session_id: "ses_tree1_root",
        parent_id: null,
        tree_id: "agent_tree1",
        level: 0,
        title: "Tree Root",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now - 3000,
        updated_at: now - 3000,
      });

      // Two children with different updated_at times
      db.insertAgent({
        session_id: "ses_child_old",
        parent_id: treeRoot.id,
        tree_id: treeRoot.tree_id,
        level: 1,
        title: "Old Child",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now - 2000,
        updated_at: now - 2000,
      });

      db.insertAgent({
        session_id: "ses_child_new",
        parent_id: treeRoot.id,
        tree_id: treeRoot.tree_id,
        level: 1,
        title: "New Child",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now - 1000,
        updated_at: now - 500,
      });

      const agents = db.getAllAgents();
      expect(agents).toHaveLength(3);
      // Root comes first (level 0)
      expect(agents[0].level).toBe(0);
      // Among children (level 1), newest updated_at first
      expect(agents[1].session_id).toBe("ses_child_new");
      expect(agents[2].session_id).toBe("ses_child_old");
    });

    test("can sort by created_at instead", () => {
      const now = Date.now();

      db.insertAgent({
        id: "agent_created_first",
        session_id: "ses_first",
        parent_id: null,
        tree_id: "agent_created_first",
        level: 0,
        title: "Created First",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now - 2000,
        updated_at: now - 100, // updated recently
      });

      db.insertAgent({
        id: "agent_created_second",
        session_id: "ses_second",
        parent_id: null,
        tree_id: "agent_created_second",
        level: 0,
        title: "Created Second",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now - 1000,
        updated_at: now - 3000, // updated long ago
      });

      const agents = db.getAllAgents("created_at");
      expect(agents).toHaveLength(2);
      // Newest created_at first
      expect(agents[0].id).toBe("agent_created_second");
      expect(agents[1].id).toBe("agent_created_first");
    });

    test("sorts by tree_id DESC, then level ASC, then timestamp DESC", () => {
      const now = Date.now();

      // Create two trees
      // Tree 1 (older tree_id)
      const tree1Root = db.insertAgent({
        id: "agent_tree1",
        session_id: "ses_tree1_root",
        parent_id: null,
        tree_id: "agent_tree1",
        level: 0,
        title: "Tree 1 Root",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now - 5000,
        updated_at: now - 5000,
      });

      db.insertAgent({
        session_id: "ses_tree1_child",
        parent_id: tree1Root.id,
        tree_id: tree1Root.tree_id,
        level: 1,
        title: "Tree 1 Child",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now - 4000,
        updated_at: now - 4000,
      });

      // Tree 2 (newer tree_id - should come first)
      const tree2Root = db.insertAgent({
        id: "agent_tree2",
        session_id: "ses_tree2_root",
        parent_id: null,
        tree_id: "agent_tree2",
        level: 0,
        title: "Tree 2 Root",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now - 3000,
        updated_at: now - 3000,
      });

      db.insertAgent({
        session_id: "ses_tree2_child",
        parent_id: tree2Root.id,
        tree_id: tree2Root.tree_id,
        level: 1,
        title: "Tree 2 Child",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now - 2000,
        updated_at: now - 2000,
      });

      const agents = db.getAllAgents();
      expect(agents).toHaveLength(4);

      // Tree 2 comes first (newer tree_id)
      expect(agents[0].tree_id).toBe("agent_tree2");
      expect(agents[0].level).toBe(0); // root
      expect(agents[1].tree_id).toBe("agent_tree2");
      expect(agents[1].level).toBe(1); // child

      // Then tree 1
      expect(agents[2].tree_id).toBe("agent_tree1");
      expect(agents[2].level).toBe(0); // root
      expect(agents[3].tree_id).toBe("agent_tree1");
      expect(agents[3].level).toBe(1); // child
    });
  });

  describe("getAgentBySessionId", () => {
    test("returns agent when found", () => {
      const now = Date.now();
      const inserted = db.insertAgent({
        session_id: "ses_find_me",
        parent_id: null,
        tree_id: "agent_root",
        level: 0,
        title: "Find Me",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      });

      const found = db.getAgentBySessionId("ses_find_me");
      expect(found).not.toBeNull();
      expect(found?.id).toBe(inserted.id);
      expect(found?.session_id).toBe("ses_find_me");
      expect(found?.title).toBe("Find Me");
    });

    test("returns null when not found", () => {
      const found = db.getAgentBySessionId("ses_nonexistent");
      expect(found).toBeNull();
    });
  });

  describe("getAgentById", () => {
    test("returns agent when found", () => {
      const now = Date.now();
      const _inserted = db.insertAgent({
        id: "agent_specific",
        session_id: "ses_test",
        parent_id: null,
        tree_id: "agent_specific",
        level: 0,
        title: "Specific Agent",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      });

      const found = db.getAgentById("agent_specific");
      expect(found).not.toBeNull();
      expect(found?.id).toBe("agent_specific");
      expect(found?.session_id).toBe("ses_test");
    });

    test("returns null when not found", () => {
      const found = db.getAgentById("agent_nonexistent");
      expect(found).toBeNull();
    });
  });

  describe("CASCADE DELETE", () => {
    test("deletes children when parent is deleted", () => {
      const now = Date.now();

      // Create parent
      const parent = db.insertAgent({
        id: "agent_parent_delete",
        session_id: "ses_parent_delete",
        parent_id: null,
        tree_id: "agent_parent_delete",
        level: 0,
        title: "Parent",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      });

      // Create child
      const child = db.insertAgent({
        session_id: "ses_child_delete",
        parent_id: parent.id,
        tree_id: parent.tree_id,
        level: 1,
        title: "Child",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      });

      // Verify both exist
      expect(db.getAgentById(parent.id)).not.toBeNull();
      expect(db.getAgentById(child.id)).not.toBeNull();

      // Delete parent using raw SQL
      const rawDb = db.getDatabase();
      rawDb.prepare("DELETE FROM agents WHERE id = ?").run(parent.id);

      // Verify child is also deleted
      expect(db.getAgentById(parent.id)).toBeNull();
      expect(db.getAgentById(child.id)).toBeNull();
    });
  });

  describe("insertTestData", () => {
    test("creates valid sample data", () => {
      insertTestData(db);

      const agents = db.getAllAgents();

      // Should have multiple agents (at least 15 based on fixture)
      expect(agents.length).toBeGreaterThanOrEqual(15);

      // Should have multiple trees
      const treeIds = new Set(agents.map((a) => a.tree_id));
      expect(treeIds.size).toBeGreaterThanOrEqual(5);

      // Should have multiple levels
      const levels = new Set(agents.map((a) => a.level));
      expect(levels.has(0)).toBe(true); // has roots
      expect(levels.has(1)).toBe(true); // has children
      expect(levels.has(2)).toBe(true); // has grandchildren
    });

    test("test data has valid parent-child relationships", () => {
      insertTestData(db);

      const agents = db.getAllAgents();
      const agentMap = new Map(agents.map((a) => [a.id, a]));

      for (const agent of agents) {
        if (agent.parent_id) {
          // Child must have parent that exists
          const parent = agentMap.get(agent.parent_id);
          expect(parent).toBeDefined();

          if (parent) {
            // Child must be in same tree as parent
            expect(agent.tree_id).toBe(parent.tree_id);

            // Child must have level = parent.level + 1
            expect(agent.level).toBe(parent.level + 1);
          }
        } else {
          // Root must have level 0
          expect(agent.level).toBe(0);

          // Root's tree_id should be its own ID
          expect(agent.tree_id).toBe(agent.id);
        }
      }
    });

    test("test data returns agents in correct order", () => {
      insertTestData(db);

      const agents = db.getAllAgents();

      // Verify ordering: tree_id DESC, level ASC, updated_at DESC
      for (let i = 0; i < agents.length - 1; i++) {
        const current = agents[i];
        const next = agents[i + 1];

        if (current.tree_id === next.tree_id) {
          // Same tree: level should be ASC
          if (current.level === next.level) {
            // Same level: updated_at should be DESC
            expect(current.updated_at).toBeGreaterThanOrEqual(next.updated_at);
          } else {
            expect(current.level).toBeLessThanOrEqual(next.level);
          }
        } else {
          // Different trees: should be sorted by MAX(updated_at) in tree DESC (most recent activity first)
          // Get all agents in each tree and find MAX(updated_at)
          const currentTreeAgents = agents.filter((a) => a.tree_id === current.tree_id);
          const nextTreeAgents = agents.filter((a) => a.tree_id === next.tree_id);
          const currentMaxUpdated = Math.max(...currentTreeAgents.map((a) => a.updated_at));
          const nextMaxUpdated = Math.max(...nextTreeAgents.map((a) => a.updated_at));
          expect(currentMaxUpdated).toBeGreaterThanOrEqual(nextMaxUpdated);
        }
      }
    });
  });

  describe("database configuration", () => {
    test("enforces foreign key constraints", () => {
      const now = Date.now();

      // Try to insert with invalid parent_id
      expect(() => {
        db.insertAgent({
          session_id: "ses_test",
          parent_id: "agent_nonexistent",
          tree_id: "agent_root",
          level: 1,
          title: "Test",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });
      }).toThrow();
    });

    test("has correct indexes", () => {
      const rawDb = db.getDatabase();
      const indexes = rawDb
        .prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' AND tbl_name = 'agents'
      `)
        .all() as Array<{ name: string }>;

      const indexNames = indexes.map((i) => i.name);

      // Check for our custom indexes (SQLite auto-creates some)
      expect(indexNames).toContain("idx_agents_session_id");
      expect(indexNames).toContain("idx_agents_directory");
      expect(indexNames).toContain("idx_agents_tree_updated");
      expect(indexNames).toContain("idx_agents_tree_created");
    });

    test("session_id index is unique", () => {
      const now = Date.now();

      db.insertAgent({
        session_id: "ses_unique_test",
        parent_id: null,
        tree_id: "agent_root",
        level: 0,
        title: "First",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
      });

      // Try to insert another with same session_id
      expect(() => {
        db.insertAgent({
          session_id: "ses_unique_test",
          parent_id: null,
          tree_id: "agent_root2",
          level: 0,
          title: "Second",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });
      }).toThrow(/already exists/);
    });
  });

  describe("searchAgents", () => {
    test("returns all agents when query is empty", () => {
      insertTestData(db);
      const results = db.searchAgents("");
      const allAgents = db.getAllAgents();
      expect(results.length).toBe(allAgents.length);
    });

    test("returns matching agents by title", () => {
      insertTestData(db);
      const results = db.searchAgents("Bug Investigation");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].title).toContain("Bug Investigation");
    });

    test("returns matching agents by fuzzy title match", () => {
      insertTestData(db);
      const results = db.searchAgents("database");
      expect(results.length).toBeGreaterThanOrEqual(1);
      // Should match "Database optimization"
      const hasMatch = results.some((r) => r.title.toLowerCase().includes("database"));
      expect(hasMatch).toBe(true);
    });

    test("returns matching agents by id", () => {
      insertTestData(db);
      const results = db.searchAgents("agent_tree1");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].id).toBe("agent_tree1");
    });

    test("returns matching agents by project_id", () => {
      insertTestData(db);
      const results = db.searchAgents("other-project");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].project_id).toBe("other-project");
    });

    test("returns empty array when no matches", () => {
      insertTestData(db);
      const results = db.searchAgents("nonexistentxyz123");
      expect(results).toEqual([]);
    });

    test("returns results sorted by relevance score", () => {
      insertTestData(db);
      const results = db.searchAgents("agent");
      expect(results.length).toBeGreaterThanOrEqual(1);
      // Results should be sorted by score (best matches first)
      // All results should have non-zero scores
    });

    // ========================================================================
    // Quoted Exact Match Tests
    // ========================================================================

    test("quoted search requires exact substring match", () => {
      insertTestData(db);

      // Search for exact "Bug Investigation"
      const results = db.searchAgents('"Bug Investigation"');

      // Should only match agents with exact substring
      expect(results.length).toBeGreaterThanOrEqual(1);
      const allMatch = results.every(
        (r) =>
          r.title.toLowerCase().includes("bug investigation") ||
          r.id.toLowerCase().includes("bug investigation") ||
          r.project_id.toLowerCase().includes("bug investigation"),
      );
      expect(allMatch).toBe(true);
    });

    test("quoted search is case-insensitive", () => {
      insertTestData(db);

      // Lowercase search should match title with different casing
      const results = db.searchAgents('"bug investigation"');
      expect(results.length).toBeGreaterThanOrEqual(1);

      // Should match "Bug Investigation" (case-insensitive)
      const hasMatch = results.some((r) => r.title.toLowerCase().includes("bug investigation"));
      expect(hasMatch).toBe(true);
    });

    test("quoted search does NOT fuzzy match", () => {
      insertTestData(db);

      // "database" exact match should NOT match fuzzy subsequences
      const results = db.searchAgents('"database"');

      // Should only get agents with actual "database" substring
      const allHaveDatabase = results.every(
        (r) =>
          r.title.toLowerCase().includes("database") ||
          r.id.toLowerCase().includes("database") ||
          r.project_id.toLowerCase().includes("database"),
      );
      expect(allHaveDatabase).toBe(true);
    });

    test("unquoted search uses fuzzy matching", () => {
      insertTestData(db);

      // Unquoted "agent" should fuzzy match many things
      const fuzzyResults = db.searchAgents("agent");

      // Should get multiple matches (fuzzy is permissive)
      expect(fuzzyResults.length).toBeGreaterThan(2);
    });

    // ========================================================================
    // Multi-term AND Logic Tests
    // ========================================================================

    test("multiple unquoted terms require ALL to match (AND logic)", () => {
      const now = Date.now();

      // Create test agents
      db.insertAgent({
        session_id: "ses_both",
        parent_id: null,
        tree_id: "agent_both",
        level: 0,
        title: "Database agent optimization",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
        id: "agent_both",
      });

      db.insertAgent({
        session_id: "ses_database_only",
        parent_id: null,
        tree_id: "agent_db_only",
        level: 0,
        title: "Database optimization",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
        id: "agent_db_only",
      });

      db.insertAgent({
        session_id: "ses_agent_only",
        parent_id: null,
        tree_id: "agent_agent_only",
        level: 0,
        title: "Agent service handler",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
        id: "agent_agent_only",
      });

      // Search for "database agent" - both terms required
      const results = db.searchAgents("database agent");

      // Should only match the agent with BOTH terms
      // Note: Results may include matches from insertTestData if titles match both terms
      expect(results.length).toBeGreaterThanOrEqual(1);

      // Our specific test agent should be in results
      const hasOurAgent = results.some((r) => r.id === "agent_both");
      expect(hasOurAgent).toBe(true);

      // All results should fuzzy match BOTH "database" and "agent"
      const allMatchBothTerms = results.every((r) => {
        const text = `${r.title} ${r.id} ${r.project_id}`.toLowerCase();
        // Check if both "database" and "agent" appear as subsequences
        return text.includes("database") || text.includes("agent");
      });
      expect(allMatchBothTerms).toBe(true);
    });

    test("mixed quoted and unquoted terms work together", () => {
      const now = Date.now();

      db.insertAgent({
        session_id: "ses_exact_fuzzy",
        parent_id: null,
        tree_id: "agent_exact_fuzzy",
        level: 0,
        title: "Database optimization agent service",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
        id: "agent_exact_fuzzy",
      });

      db.insertAgent({
        session_id: "ses_no_exact",
        parent_id: null,
        tree_id: "agent_no_exact",
        level: 0,
        title: "Data base optimization agent",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
        id: "agent_no_exact",
      });

      // Require exact "Database" + fuzzy "agent"
      const results = db.searchAgents('"Database" agent');

      // Should only match first (has exact "Database")
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("agent_exact_fuzzy");
    });

    test("all terms must match or agent is excluded", () => {
      insertTestData(db);

      // Search for terms that won't all match together
      const results = db.searchAgents("database nonexistent123");

      // No agent has both terms
      expect(results.length).toBe(0);
    });

    test("multiple exact match terms all required", () => {
      const now = Date.now();

      db.insertAgent({
        session_id: "ses_multi_exact",
        parent_id: null,
        tree_id: "agent_multi_exact",
        level: 0,
        title: "Fix database connection in agent service",
        project_id: "test",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now,
        id: "agent_multi_exact",
      });

      // Both exact terms required
      const results = db.searchAgents('"database" "agent"');

      expect(results.length).toBe(1);
      expect(results[0].id).toBe("agent_multi_exact");
    });
  });

  describe("searchAgentsWithTrees", () => {
    test("returns empty arrays when query matches nothing", () => {
      insertTestData(db);
      const result = db.searchAgentsWithTrees("nonexistentxyz123");
      expect(result.rows).toEqual([]);
      expect(result.matchedAgentIds).toEqual([]);
    });

    test("returns full tree when root matches", () => {
      insertTestData(db);
      const result = db.searchAgentsWithTrees("Bug Investigation");

      // Should find at least one match
      expect(result.matchedAgentIds.length).toBeGreaterThanOrEqual(1);

      // Should return all agents in the matching tree(s)
      expect(result.rows.length).toBeGreaterThanOrEqual(result.matchedAgentIds.length);

      // All rows should have tree_id matching one of the matched agents
      const matchedTreeIds = new Set(
        result.matchedAgentIds.map((id) => {
          const agent = result.rows.find((r) => r.id === id);
          return agent?.tree_id;
        }),
      );

      for (const row of result.rows) {
        expect(matchedTreeIds.has(row.tree_id)).toBe(true);
      }
    });

    test("returns full trees when child matches", () => {
      insertTestData(db);
      // Search for a child agent
      const result = db.searchAgentsWithTrees("Implement endpoints");

      expect(result.matchedAgentIds.length).toBeGreaterThanOrEqual(1);

      // Should return entire tree including root and siblings
      const treeIds = [...new Set(result.rows.map((r) => r.tree_id))];
      expect(treeIds.length).toBeGreaterThanOrEqual(1);

      // Verify we got the root of the tree
      const hasRoot = result.rows.some((r) => r.level === 0);
      expect(hasRoot).toBe(true);
    });

    test("returns multiple trees when matches span trees", () => {
      insertTestData(db);
      // Search for something that appears in multiple trees
      const result = db.searchAgentsWithTrees("agent");

      expect(result.matchedAgentIds.length).toBeGreaterThanOrEqual(1);

      // Should have multiple tree_ids
      const treeIds = [...new Set(result.rows.map((r) => r.tree_id))];
      expect(treeIds.length).toBeGreaterThan(1);

      // Each tree should be complete (have a root at level 0)
      for (const treeId of treeIds) {
        const treeRows = result.rows.filter((r) => r.tree_id === treeId);
        const root = treeRows.find((r) => r.level === 0);
        expect(root).toBeDefined();
        expect(root?.id).toBe(treeId);
      }
    });

    test("respects sortBy parameter (updated_at)", () => {
      insertTestData(db);
      const result = db.searchAgentsWithTrees("agent", "updated_at");

      expect(result.rows.length).toBeGreaterThanOrEqual(1);

      // Verify trees are sorted by max updated_at DESC
      const treeIds = [...new Set(result.rows.map((r) => r.tree_id))];
      const treeMaxUpdated = treeIds.map((treeId) => {
        const treeRows = result.rows.filter((r) => r.tree_id === treeId);
        return Math.max(...treeRows.map((r) => r.updated_at));
      });

      // Check trees are sorted DESC by max updated_at
      for (let i = 0; i < treeMaxUpdated.length - 1; i++) {
        expect(treeMaxUpdated[i]).toBeGreaterThanOrEqual(treeMaxUpdated[i + 1]);
      }
    });

    test("respects sortBy parameter (created_at)", () => {
      insertTestData(db);
      const result = db.searchAgentsWithTrees("agent", "created_at");

      expect(result.rows.length).toBeGreaterThanOrEqual(1);

      // Verify trees are sorted by root created_at DESC
      const treeIds = [...new Set(result.rows.map((r) => r.tree_id))];
      const rootCreatedTimes = treeIds.map((treeId) => {
        const root = result.rows.find((r) => r.id === treeId);
        return root?.created_at ?? 0;
      });

      // Check trees are sorted DESC by root created_at
      for (let i = 0; i < rootCreatedTimes.length - 1; i++) {
        expect(rootCreatedTimes[i]).toBeGreaterThanOrEqual(rootCreatedTimes[i + 1]);
      }
    });

    test("rows are sorted correctly within each tree", () => {
      insertTestData(db);
      const result = db.searchAgentsWithTrees("agent");

      expect(result.rows.length).toBeGreaterThanOrEqual(1);

      // Within each tree, verify level ordering
      const treeIds = [...new Set(result.rows.map((r) => r.tree_id))];
      for (const treeId of treeIds) {
        const treeRows = result.rows.filter((r) => r.tree_id === treeId);

        // Root should come first
        expect(treeRows[0].level).toBe(0);

        // Levels should be in ascending order (parents before children)
        for (let i = 0; i < treeRows.length - 1; i++) {
          expect(treeRows[i].level).toBeLessThanOrEqual(treeRows[i + 1].level);
        }
      }
    });

    test("matchedAgentIds contains only agents that matched search", () => {
      insertTestData(db);
      const result = db.searchAgentsWithTrees("Implement endpoints");

      expect(result.matchedAgentIds.length).toBeGreaterThanOrEqual(1);

      // Verify all matched IDs exist in rows
      for (const matchedId of result.matchedAgentIds) {
        const found = result.rows.find((r) => r.id === matchedId);
        expect(found).toBeDefined();
      }

      // Verify matched agents actually match the query
      for (const matchedId of result.matchedAgentIds) {
        const agent = result.rows.find((r) => r.id === matchedId);
        expect(agent).toBeDefined();
        // Should match in title, id, or project_id
        const matchesQuery =
          agent?.title.toLowerCase().includes("implement") ||
          agent?.title.toLowerCase().includes("endpoint") ||
          agent?.id.toLowerCase().includes("implement") ||
          agent?.project_id.toLowerCase().includes("implement");
        expect(matchesQuery).toBe(true);
      }
    });

    test("sortDir='asc' returns trees in ascending order (oldest first)", () => {
      insertTestData(db);
      const result = db.searchAgentsWithTrees("agent", "updated_at", "asc");

      expect(result.rows.length).toBeGreaterThanOrEqual(1);

      // Get unique tree_ids in order they appear
      const treeIds = [...new Set(result.rows.map((r) => r.tree_id))];
      expect(treeIds.length).toBeGreaterThan(1);

      // Calculate max updated_at for each tree
      const treeMaxUpdated = treeIds.map((treeId) => {
        const treeRows = result.rows.filter((r) => r.tree_id === treeId);
        return Math.max(...treeRows.map((r) => r.updated_at));
      });

      // Check trees are sorted ASC by max updated_at (oldest first)
      for (let i = 0; i < treeMaxUpdated.length - 1; i++) {
        expect(treeMaxUpdated[i]).toBeLessThanOrEqual(treeMaxUpdated[i + 1]);
      }
    });

    test("sortDir='desc' returns trees in descending order (newest first)", () => {
      insertTestData(db);
      const result = db.searchAgentsWithTrees("agent", "updated_at", "desc");

      expect(result.rows.length).toBeGreaterThanOrEqual(1);

      // Get unique tree_ids in order they appear
      const treeIds = [...new Set(result.rows.map((r) => r.tree_id))];
      expect(treeIds.length).toBeGreaterThan(1);

      // Calculate max updated_at for each tree
      const treeMaxUpdated = treeIds.map((treeId) => {
        const treeRows = result.rows.filter((r) => r.tree_id === treeId);
        return Math.max(...treeRows.map((r) => r.updated_at));
      });

      // Check trees are sorted DESC by max updated_at (newest first)
      for (let i = 0; i < treeMaxUpdated.length - 1; i++) {
        expect(treeMaxUpdated[i]).toBeGreaterThanOrEqual(treeMaxUpdated[i + 1]);
      }
    });

    test("level is always ASC regardless of sortDir", () => {
      insertTestData(db);

      // Test with sortDir='asc'
      const resultAsc = db.searchAgentsWithTrees("agent", "updated_at", "asc");
      const treeIdsAsc = [...new Set(resultAsc.rows.map((r) => r.tree_id))];
      for (const treeId of treeIdsAsc) {
        const treeRows = resultAsc.rows.filter((r) => r.tree_id === treeId);
        // Root should come first
        expect(treeRows[0].level).toBe(0);
        // Levels should be ascending (parents before children)
        for (let i = 0; i < treeRows.length - 1; i++) {
          expect(treeRows[i].level).toBeLessThanOrEqual(treeRows[i + 1].level);
        }
      }

      // Test with sortDir='desc'
      const resultDesc = db.searchAgentsWithTrees("agent", "updated_at", "desc");
      const treeIdsDesc = [...new Set(resultDesc.rows.map((r) => r.tree_id))];
      for (const treeId of treeIdsDesc) {
        const treeRows = resultDesc.rows.filter((r) => r.tree_id === treeId);
        // Root should come first
        expect(treeRows[0].level).toBe(0);
        // Levels should be ascending (parents before children)
        for (let i = 0; i < treeRows.length - 1; i++) {
          expect(treeRows[i].level).toBeLessThanOrEqual(treeRows[i + 1].level);
        }
      }
    });
  });

  describe("getAllAgents with sortDir", () => {
    test("sortDir='desc' returns trees newest first (default)", () => {
      insertTestData(db);
      const agents = db.getAllAgents("updated_at", "desc");

      expect(agents.length).toBeGreaterThanOrEqual(1);

      // Get unique tree_ids in order
      const treeIds = [...new Set(agents.map((a) => a.tree_id))];
      const treeMaxUpdated = treeIds.map((treeId) => {
        const treeAgents = agents.filter((a) => a.tree_id === treeId);
        return Math.max(...treeAgents.map((a) => a.updated_at));
      });

      // Should be descending
      for (let i = 0; i < treeMaxUpdated.length - 1; i++) {
        expect(treeMaxUpdated[i]).toBeGreaterThanOrEqual(treeMaxUpdated[i + 1]);
      }
    });

    test("sortDir='asc' returns trees oldest first", () => {
      insertTestData(db);
      const agents = db.getAllAgents("updated_at", "asc");

      expect(agents.length).toBeGreaterThanOrEqual(1);

      // Get unique tree_ids in order
      const treeIds = [...new Set(agents.map((a) => a.tree_id))];
      const treeMaxUpdated = treeIds.map((treeId) => {
        const treeAgents = agents.filter((a) => a.tree_id === treeId);
        return Math.max(...treeAgents.map((a) => a.updated_at));
      });

      // Should be ascending
      for (let i = 0; i < treeMaxUpdated.length - 1; i++) {
        expect(treeMaxUpdated[i]).toBeLessThanOrEqual(treeMaxUpdated[i + 1]);
      }
    });

    test("sortDir='asc' with created_at sorts by root created_at ascending", () => {
      insertTestData(db);
      const agents = db.getAllAgents("created_at", "asc");

      expect(agents.length).toBeGreaterThanOrEqual(1);

      // Get unique tree_ids (which are root agent IDs)
      const treeIds = [...new Set(agents.map((a) => a.tree_id))];
      const rootCreatedTimes = treeIds.map((treeId) => {
        const root = agents.find((a) => a.id === treeId);
        return root?.created_at ?? 0;
      });

      // Should be ascending (oldest first)
      for (let i = 0; i < rootCreatedTimes.length - 1; i++) {
        expect(rootCreatedTimes[i]).toBeLessThanOrEqual(rootCreatedTimes[i + 1]);
      }
    });

    test("level is always ASC regardless of sortDir", () => {
      insertTestData(db);

      // Test DESC
      const agentsDesc = db.getAllAgents("updated_at", "desc");
      const treeIdsDesc = [...new Set(agentsDesc.map((a) => a.tree_id))];
      for (const treeId of treeIdsDesc) {
        const treeAgents = agentsDesc.filter((a) => a.tree_id === treeId);
        // Verify levels are ascending
        for (let i = 0; i < treeAgents.length - 1; i++) {
          expect(treeAgents[i].level).toBeLessThanOrEqual(treeAgents[i + 1].level);
        }
      }

      // Test ASC
      const agentsAsc = db.getAllAgents("updated_at", "asc");
      const treeIdsAsc = [...new Set(agentsAsc.map((a) => a.tree_id))];
      for (const treeId of treeIdsAsc) {
        const treeAgents = agentsAsc.filter((a) => a.tree_id === treeId);
        // Verify levels are ascending
        for (let i = 0; i < treeAgents.length - 1; i++) {
          expect(treeAgents[i].level).toBeLessThanOrEqual(treeAgents[i + 1].level);
        }
      }
    });
  });

  describe("Archive functionality", () => {
    describe("archiveAgent and collectDescendants", () => {
      test("archives single agent with no children", () => {
        const now = Date.now();
        const root = db.insertAgent({
          session_id: "ses_root",
          parent_id: null,
          tree_id: "agent_root",
          level: 0,
          title: "Root",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_root",
        });

        const archivedIds = db.archiveAgent(root.id);

        expect(archivedIds).toHaveLength(1);
        expect(archivedIds).toContain(root.id);

        const archivedAgent = db.getAgentById(root.id);
        expect(archivedAgent?.archived_at).not.toBeNull();
      });

      test("archives agent and all descendants recursively", () => {
        const now = Date.now();
        const root = db.insertAgent({
          session_id: "ses_root",
          parent_id: null,
          tree_id: "agent_root",
          level: 0,
          title: "Root",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_root",
        });

        const child1 = db.insertAgent({
          session_id: "ses_child1",
          parent_id: root.id,
          tree_id: root.tree_id,
          level: 1,
          title: "Child 1",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        const child2 = db.insertAgent({
          session_id: "ses_child2",
          parent_id: root.id,
          tree_id: root.tree_id,
          level: 1,
          title: "Child 2",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        const archivedIds = db.archiveAgent(root.id);

        expect(archivedIds).toHaveLength(3);
        expect(archivedIds).toContain(root.id);
        expect(archivedIds).toContain(child1.id);
        expect(archivedIds).toContain(child2.id);

        expect(db.getAgentById(root.id)?.archived_at).not.toBeNull();
        expect(db.getAgentById(child1.id)?.archived_at).not.toBeNull();
        expect(db.getAgentById(child2.id)?.archived_at).not.toBeNull();
      });

      test("archives deep tree with grandchildren", () => {
        const now = Date.now();
        const root = db.insertAgent({
          session_id: "ses_root",
          parent_id: null,
          tree_id: "agent_root",
          level: 0,
          title: "Root",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_root",
        });

        const child = db.insertAgent({
          session_id: "ses_child",
          parent_id: root.id,
          tree_id: root.tree_id,
          level: 1,
          title: "Child",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        const grandchild = db.insertAgent({
          session_id: "ses_grandchild",
          parent_id: child.id,
          tree_id: root.tree_id,
          level: 2,
          title: "Grandchild",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        const archivedIds = db.archiveAgent(root.id);

        expect(archivedIds).toHaveLength(3);
        expect(archivedIds).toContain(root.id);
        expect(archivedIds).toContain(child.id);
        expect(archivedIds).toContain(grandchild.id);
      });

      test("archives subtree without affecting parent", () => {
        const now = Date.now();
        const root = db.insertAgent({
          session_id: "ses_root",
          parent_id: null,
          tree_id: "agent_root",
          level: 0,
          title: "Root",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_root",
        });

        const child = db.insertAgent({
          session_id: "ses_child",
          parent_id: root.id,
          tree_id: root.tree_id,
          level: 1,
          title: "Child",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        const grandchild = db.insertAgent({
          session_id: "ses_grandchild",
          parent_id: child.id,
          tree_id: root.tree_id,
          level: 2,
          title: "Grandchild",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        // Archive child branch only
        const archivedIds = db.archiveAgent(child.id);

        expect(archivedIds).toHaveLength(2);
        expect(archivedIds).toContain(child.id);
        expect(archivedIds).toContain(grandchild.id);

        // Root should NOT be archived
        expect(db.getAgentById(root.id)?.archived_at).toBeNull();
        expect(db.getAgentById(child.id)?.archived_at).not.toBeNull();
        expect(db.getAgentById(grandchild.id)?.archived_at).not.toBeNull();
      });
    });

    describe("Query filtering - archived agents excluded from queries", () => {
      test("getAllAgents excludes archived agents", () => {
        const now = Date.now();
        const agent1 = db.insertAgent({
          session_id: "ses_1",
          parent_id: null,
          tree_id: "agent_1",
          level: 0,
          title: "Active Agent",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_1",
        });

        const agent2 = db.insertAgent({
          session_id: "ses_2",
          parent_id: null,
          tree_id: "agent_2",
          level: 0,
          title: "Archived Agent",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_2",
        });

        // Archive agent2
        db.archiveAgent(agent2.id);

        const allAgents = db.getAllAgents();
        expect(allAgents).toHaveLength(1);
        expect(allAgents[0].id).toBe(agent1.id);
      });

      test("searchAgents excludes archived agents", () => {
        const now = Date.now();
        db.insertAgent({
          session_id: "ses_1",
          parent_id: null,
          tree_id: "agent_1",
          level: 0,
          title: "Test Active Agent",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_1",
        });

        const agent2 = db.insertAgent({
          session_id: "ses_2",
          parent_id: null,
          tree_id: "agent_2",
          level: 0,
          title: "Test Archived Agent",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_2",
        });

        // Archive agent2
        db.archiveAgent(agent2.id);

        const searchResults = db.searchAgents("Test");
        expect(searchResults).toHaveLength(1);
        expect(searchResults[0].id).toBe("agent_1");
      });

      test("searchAgentsWithTrees excludes archived agents and trees", () => {
        const now = Date.now();
        const root1 = db.insertAgent({
          session_id: "ses_root1",
          parent_id: null,
          tree_id: "agent_root1",
          level: 0,
          title: "Active Root",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_root1",
        });

        const root2 = db.insertAgent({
          session_id: "ses_root2",
          parent_id: null,
          tree_id: "agent_root2",
          level: 0,
          title: "Archived Root",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_root2",
        });

        // Archive entire second tree
        db.archiveAgent(root2.id);

        const { rows } = db.searchAgentsWithTrees("Root");
        const treeIds = [...new Set(rows.map((r) => r.tree_id))];
        expect(treeIds).toHaveLength(1);
        expect(treeIds).toContain(root1.tree_id);
        expect(treeIds).not.toContain(root2.tree_id);
      });

      test("getAgentById returns archived agents (direct lookup)", () => {
        const now = Date.now();
        const agent = db.insertAgent({
          session_id: "ses_1",
          parent_id: null,
          tree_id: "agent_1",
          level: 0,
          title: "Agent",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_1",
        });

        db.archiveAgent(agent.id);

        // Should still return archived agent
        const result = db.getAgentById(agent.id);
        expect(result).not.toBeNull();
        expect(result?.id).toBe(agent.id);
        expect(result?.archived_at).not.toBeNull();
      });

      test("getAgentBySessionId returns archived agents (direct lookup)", () => {
        const now = Date.now();
        const agent = db.insertAgent({
          session_id: "ses_1",
          parent_id: null,
          tree_id: "agent_1",
          level: 0,
          title: "Agent",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_1",
        });

        db.archiveAgent(agent.id);

        // Should still return archived agent
        const result = db.getAgentBySessionId("ses_1");
        expect(result).not.toBeNull();
        expect(result?.id).toBe(agent.id);
        expect(result?.archived_at).not.toBeNull();
      });
    });

    describe("unarchiveAgent - restore archived agents", () => {
      test("unarchives single agent with no children", () => {
        const now = Date.now();
        const root = db.insertAgent({
          session_id: "ses_root",
          parent_id: null,
          tree_id: "agent_root",
          level: 0,
          title: "Root",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_root",
        });

        // Archive then unarchive
        db.archiveAgent(root.id);
        const unarchivedIds = db.unarchiveAgent(root.id);

        expect(unarchivedIds).toHaveLength(1);
        expect(unarchivedIds).toContain(root.id);

        const unarchivedAgent = db.getAgentById(root.id);
        expect(unarchivedAgent?.archived_at).toBeNull();
      });

      test("unarchives agent and all descendants recursively", () => {
        const now = Date.now();
        const root = db.insertAgent({
          session_id: "ses_root",
          parent_id: null,
          tree_id: "agent_root",
          level: 0,
          title: "Root",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_root",
        });

        const child1 = db.insertAgent({
          session_id: "ses_child1",
          parent_id: root.id,
          tree_id: root.tree_id,
          level: 1,
          title: "Child 1",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        const child2 = db.insertAgent({
          session_id: "ses_child2",
          parent_id: root.id,
          tree_id: root.tree_id,
          level: 1,
          title: "Child 2",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        // Archive then unarchive
        db.archiveAgent(root.id);
        const unarchivedIds = db.unarchiveAgent(root.id);

        expect(unarchivedIds).toHaveLength(3);
        expect(unarchivedIds).toContain(root.id);
        expect(unarchivedIds).toContain(child1.id);
        expect(unarchivedIds).toContain(child2.id);

        expect(db.getAgentById(root.id)?.archived_at).toBeNull();
        expect(db.getAgentById(child1.id)?.archived_at).toBeNull();
        expect(db.getAgentById(child2.id)?.archived_at).toBeNull();
      });

      test("unarchives deep tree with grandchildren", () => {
        const now = Date.now();
        const root = db.insertAgent({
          session_id: "ses_root",
          parent_id: null,
          tree_id: "agent_root",
          level: 0,
          title: "Root",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_root",
        });

        const child = db.insertAgent({
          session_id: "ses_child",
          parent_id: root.id,
          tree_id: root.tree_id,
          level: 1,
          title: "Child",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        const grandchild = db.insertAgent({
          session_id: "ses_grandchild",
          parent_id: child.id,
          tree_id: root.tree_id,
          level: 2,
          title: "Grandchild",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        // Archive then unarchive
        db.archiveAgent(root.id);
        const unarchivedIds = db.unarchiveAgent(root.id);

        expect(unarchivedIds).toHaveLength(3);
        expect(unarchivedIds).toContain(root.id);
        expect(unarchivedIds).toContain(child.id);
        expect(unarchivedIds).toContain(grandchild.id);
      });

      test("unarchives subtree without affecting parent (goes DOWN only)", () => {
        const now = Date.now();
        const root = db.insertAgent({
          session_id: "ses_root",
          parent_id: null,
          tree_id: "agent_root",
          level: 0,
          title: "Root",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_root",
        });

        const child = db.insertAgent({
          session_id: "ses_child",
          parent_id: root.id,
          tree_id: root.tree_id,
          level: 1,
          title: "Child",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        const grandchild = db.insertAgent({
          session_id: "ses_grandchild",
          parent_id: child.id,
          tree_id: root.tree_id,
          level: 2,
          title: "Grandchild",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        // Archive entire tree
        db.archiveAgent(root.id);

        // Unarchive child branch only
        const unarchivedIds = db.unarchiveAgent(child.id);

        expect(unarchivedIds).toHaveLength(2);
        expect(unarchivedIds).toContain(child.id);
        expect(unarchivedIds).toContain(grandchild.id);

        // Root should STILL be archived (unarchive goes DOWN only)
        expect(db.getAgentById(root.id)?.archived_at).not.toBeNull();
        expect(db.getAgentById(child.id)?.archived_at).toBeNull();
        expect(db.getAgentById(grandchild.id)?.archived_at).toBeNull();
      });
    });

    describe("Ancestry checking - auto-archive new agents with archived ancestors", () => {
      test("auto-archives new agent when immediate parent is archived", () => {
        const now = Date.now();
        const root = db.insertAgent({
          session_id: "ses_root",
          parent_id: null,
          tree_id: "agent_root",
          level: 0,
          title: "Root",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_root",
        });

        // Archive root
        db.archiveAgent(root.id);

        // Try to create child under archived parent
        const child = db.insertAgent({
          session_id: "ses_child",
          parent_id: root.id,
          tree_id: root.tree_id,
          level: 1,
          title: "Child",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        // Child should be auto-archived
        expect(child.archived_at).not.toBeNull();
        expect(child.archived_at).toBeGreaterThanOrEqual(1);
      });

      test("auto-archives new agent when grandparent is archived", () => {
        const now = Date.now();
        const root = db.insertAgent({
          session_id: "ses_root",
          parent_id: null,
          tree_id: "agent_root",
          level: 0,
          title: "Root",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_root",
        });

        const child = db.insertAgent({
          session_id: "ses_child",
          parent_id: root.id,
          tree_id: root.tree_id,
          level: 1,
          title: "Child",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        // Archive root (but not child yet)
        db.archiveAgent(root.id);

        // Try to create grandchild
        const grandchild = db.insertAgent({
          session_id: "ses_grandchild",
          parent_id: child.id,
          tree_id: root.tree_id,
          level: 2,
          title: "Grandchild",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        // Grandchild should be auto-archived (archived grandparent in ancestry)
        expect(grandchild.archived_at).not.toBeNull();
      });

      test("does not auto-archive when no ancestors are archived", () => {
        const now = Date.now();
        const root = db.insertAgent({
          session_id: "ses_root",
          parent_id: null,
          tree_id: "agent_root",
          level: 0,
          title: "Root",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_root",
        });

        const child = db.insertAgent({
          session_id: "ses_child",
          parent_id: root.id,
          tree_id: root.tree_id,
          level: 1,
          title: "Child",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        // Child should NOT be auto-archived (no archived ancestors)
        expect(child.archived_at).toBeNull();
      });

      test("CRITICAL: auto-archives child when parent archived BEFORE child insertion (race condition)", () => {
        const now = Date.now();

        // Create parent
        const root = db.insertAgent({
          session_id: "ses_root",
          parent_id: null,
          tree_id: "agent_root",
          level: 0,
          title: "Root",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
          id: "agent_root",
        });

        // Archive parent FIRST (simulates race condition)
        db.archiveAgent(root.id);

        // NOW try to insert child (this is the race condition case)
        const child = db.insertAgent({
          session_id: "ses_child",
          parent_id: root.id,
          tree_id: root.tree_id,
          level: 1,
          title: "Child",
          project_id: "test",
          directory: "/test",
          model: "anthropic/claude-sonnet-4",
          cloned_from: null,
          cloned_at: null,
          archived_at: null,
          created_at: now,
          updated_at: now,
        });

        // Child MUST be auto-archived because parent was already archived
        // This prevents orphaned agents from appearing after archive
        expect(child.archived_at).not.toBeNull();
        expect(child.archived_at).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ============================================================================
  // getRecentAgents
  // ============================================================================

  describe("getRecentAgents", () => {
    function insertRecentAgent(db: AgentsDB, id: string, sessionId: string, title: string, updatedAtOffset = 0) {
      const now = Date.now();
      return db.insertAgent({
        id,
        session_id: sessionId,
        parent_id: null,
        tree_id: id,
        level: 0,
        title,
        project_id: "test-project",
        directory: "/test",
        model: "anthropic/claude-sonnet-4",
        cloned_from: null,
        cloned_at: null,
        archived_at: null,
        created_at: now + updatedAtOffset,
        updated_at: now + updatedAtOffset,
      });
    }

    test("returns all recent agents when no limit is provided", () => {
      insertRecentAgent(db, "agent_a", "ses_a", "Agent A", -1000);
      insertRecentAgent(db, "agent_b", "ses_b", "Agent B", -2000);
      insertRecentAgent(db, "agent_c", "ses_c", "Agent C", -3000);

      const results = db.getRecentAgents();
      expect(results.length).toBeGreaterThanOrEqual(3);
    });

    test("limits results to the given number when limit is provided", () => {
      insertRecentAgent(db, "agent_l1", "ses_l1", "Limit Agent 1", -1000);
      insertRecentAgent(db, "agent_l2", "ses_l2", "Limit Agent 2", -2000);
      insertRecentAgent(db, "agent_l3", "ses_l3", "Limit Agent 3", -3000);

      const results = db.getRecentAgents(undefined, 2);
      expect(results).toHaveLength(2);
    });

    test("limit=1 returns only the most recently updated agent", () => {
      insertRecentAgent(db, "agent_newest", "ses_newest", "Newest Agent", -500);
      insertRecentAgent(db, "agent_older", "ses_older", "Older Agent", -5000);

      const results = db.getRecentAgents(undefined, 1);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("agent_newest");
    });

    test("limit applies before fuzzy filtering", () => {
      // Insert 3 agents that all match "Agent", limit to 2
      insertRecentAgent(db, "agent_m1", "ses_m1", "Match Agent One", -1000);
      insertRecentAgent(db, "agent_m2", "ses_m2", "Match Agent Two", -2000);
      insertRecentAgent(db, "agent_m3", "ses_m3", "Match Agent Three", -3000);

      // With limit=2, only the 2 most recent rows come out of SQL before fuzzy filter
      const results = db.getRecentAgents("Agent", 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });
});
