// ABOUTME: Unit tests for bundle loading and metadata management
// ABOUTME: Tests marketplace bundle loading, personal/workspace bundle generation, and bundle retrieval

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";
import { TestDataDB } from "../test-utils/data-db-test";
import {
  getAllBundles,
  getBundleById,
  getMarketplaceBundleById,
  getPersonalBundle,
  getWorkspaceBundle,
  loadMarketplaceBundles,
} from "./bundles-db";
import { DataDB, initDataDB } from "./data-db";

// Test fixtures path
const FIXTURES_PATH = join(import.meta.dir, "__fixtures__", "pattern-bundles");
const TEST_DB_PATH = join(import.meta.dir, "__fixtures__", "test-bundles.db");

describe("bundles-db", () => {
  let testDb: DataDB;
  let dbInitialized = false;

  beforeEach(async () => {
    // Only initialize database once for all tests
    if (!dbInitialized) {
      // Clean up any existing test database
      if (existsSync(TEST_DB_PATH)) {
        rmSync(TEST_DB_PATH);
      }

      // Set environment variable for test database path
      process.env.BIRDHOUSE_DATA_DB_PATH = TEST_DB_PATH;

      // Run migrations
      await initDataDB();

      // Create test database instance
      testDb = new DataDB(TEST_DB_PATH);

      dbInitialized = true;
    }

    // Set up test user profile (refreshes for each test)
    testDb.setUserName("Test User");

    // Set up test workspace (refreshes for each test)
    testDb.insertWorkspace({
      workspace_id: "test-workspace",
      directory: "/test/workspace",
      title: "Test Workspace",
      opencode_port: null,
      opencode_pid: null,
      created_at: new Date().toISOString(),
      last_used: new Date().toISOString(),
    });

    // Create test bundle fixtures if they don't exist
    if (!existsSync(FIXTURES_PATH)) {
      mkdirSync(FIXTURES_PATH, { recursive: true });

      // Create test-bundle-01
      const bundle1Dir = join(FIXTURES_PATH, "test-bundle-01");
      mkdirSync(bundle1Dir, { recursive: true });

      const bundle1Metadata = {
        id: "test-bundle-01",
        name: "Test Bundle 01",
        description: "First test bundle",
        author: "Test Author",
        version: "1.0.0",
        created_at: "2026-02-23T00:00:00Z",
        updated_at: "2026-02-23T00:00:00Z",
        installable: true,
      };
      writeFileSync(join(bundle1Dir, "bundle.yml"), yaml.dump(bundle1Metadata), "utf-8");

      // Create a pattern in bundle 01
      const pattern1Dir = join(bundle1Dir, "test-pattern-01");
      mkdirSync(pattern1Dir, { recursive: true });

      const pattern1Metadata = {
        id: "test-pattern-01",
        title: "Test Pattern 01",
        category: "Testing",
        trigger_phrases: ["test pattern"],
        created_at: "2026-02-23T00:00:00Z",
        updated_at: "2026-02-23T00:00:00Z",
      };
      writeFileSync(join(pattern1Dir, "metadata.yml"), yaml.dump(pattern1Metadata), "utf-8");
      writeFileSync(join(pattern1Dir, "prompt.md"), "# Test Pattern 01\n\nTest content", "utf-8");

      // Create test-bundle-02
      const bundle2Dir = join(FIXTURES_PATH, "test-bundle-02");
      mkdirSync(bundle2Dir, { recursive: true });

      const bundle2Metadata = {
        id: "test-bundle-02",
        name: "Test Bundle 02",
        description: "Second test bundle",
        created_at: "2026-02-23T00:00:00Z",
        updated_at: "2026-02-23T00:00:00Z",
        installable: true,
      };
      writeFileSync(join(bundle2Dir, "bundle.yml"), yaml.dump(bundle2Metadata), "utf-8");
    }
  });

  afterEach(() => {
    // Clean up test data (but keep database open for next test)
    const workspaces = testDb.getAllWorkspaces();
    for (const workspace of workspaces) {
      testDb.deleteWorkspace(workspace.workspace_id);
    }

    // Clean up test fixtures
    if (existsSync(FIXTURES_PATH)) {
      rmSync(FIXTURES_PATH, { recursive: true });
    }
  });

  describe("loadMarketplaceBundles", () => {
    test("loads valid marketplace bundles from fixtures", () => {
      const bundles = loadMarketplaceBundles(FIXTURES_PATH);

      expect(bundles.size).toBe(2);

      const bundle1 = bundles.get("test-bundle-01");
      expect(bundle1).toBeDefined();
      expect(bundle1?.id).toBe("test-bundle-01");
      expect(bundle1?.name).toBe("Test Bundle 01");
      expect(bundle1?.type).toBe("marketplace");
      expect(bundle1?.installed).toBe(false);
      expect(bundle1?.pattern_count).toBe(1);
      expect(bundle1?.author).toBe("Test Author");
      expect(bundle1?.version).toBe("1.0.0");

      const bundle2 = bundles.get("test-bundle-02");
      expect(bundle2).toBeDefined();
      expect(bundle2?.id).toBe("test-bundle-02");
      expect(bundle2?.name).toBe("Test Bundle 02");
      expect(bundle2?.pattern_count).toBe(0);
    });

    test("returns empty map when bundles directory does not exist", () => {
      const bundles = loadMarketplaceBundles("/nonexistent/path");
      expect(bundles.size).toBe(0);
    });

    test("skips bundles without bundle.yml", () => {
      const noBundleYmlDir = join(FIXTURES_PATH, "no-bundle-yml");
      mkdirSync(noBundleYmlDir, { recursive: true });

      const bundles = loadMarketplaceBundles(FIXTURES_PATH);

      // Should still only have the 2 valid bundles
      expect(bundles.size).toBe(2);
      expect(bundles.has("no-bundle-yml")).toBe(false);
    });
  });

  describe("getMarketplaceBundleById", () => {
    test("loads bundle metadata with pattern count", () => {
      const bundle = getMarketplaceBundleById("test-bundle-01", FIXTURES_PATH);

      expect(bundle).toBeDefined();
      expect(bundle?.id).toBe("test-bundle-01");
      expect(bundle?.pattern_count).toBe(1);
      // Patterns no longer loaded - use pattern-groups-db to access patterns
    });

    test("returns undefined for non-existent bundle", () => {
      const bundle = getMarketplaceBundleById("nonexistent", FIXTURES_PATH);
      expect(bundle).toBeUndefined();
    });

    test("returns undefined when bundle directory does not exist", () => {
      const bundle = getMarketplaceBundleById("test-bundle-01", "/nonexistent/path");
      expect(bundle).toBeUndefined();
    });
  });

  describe("getPersonalBundle", () => {
    test("returns personal bundle with user name from profile", () => {
      const bundle = getPersonalBundle(testDb);

      expect(bundle.id).toBe("user");
      expect(bundle.name).toBe("Test User's Patterns");
      expect(bundle.type).toBe("personal");
      expect(bundle.installed).toBe(true);
      expect(bundle.installable).toBe(false);
      expect(bundle.pattern_count).toBe(0);
    });

    test("returns default name when no profile name exists", () => {
      const emptyDb = new TestDataDB();
      const bundle = getPersonalBundle(emptyDb);

      expect(bundle.id).toBe("user");
      expect(bundle.name).toBe("My Patterns");
      expect(bundle.type).toBe("personal");

      emptyDb.close();
    });
  });

  describe("getWorkspaceBundle", () => {
    test("returns workspace bundle with workspace title", () => {
      const bundle = getWorkspaceBundle(testDb, "test-workspace");

      expect(bundle).toBeDefined();
      expect(bundle?.id).toBe("workspace");
      expect(bundle?.name).toBe("Test Workspace Patterns");
      expect(bundle?.type).toBe("workspace");
      expect(bundle?.installed).toBe(true);
      expect(bundle?.installable).toBe(false);
      expect(bundle?.pattern_count).toBe(0);
    });

    test("returns null for non-existent workspace", () => {
      const bundle = getWorkspaceBundle(testDb, "nonexistent");
      expect(bundle).toBeNull();
    });

    test("uses default name when workspace has no title", () => {
      // Insert workspace without title
      testDb.insertWorkspace({
        workspace_id: "no-title-workspace",
        directory: "/test/no-title",
        title: null,
        opencode_port: null,
        opencode_pid: null,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      });

      const bundle = getWorkspaceBundle(testDb, "no-title-workspace");

      expect(bundle).toBeDefined();
      expect(bundle?.name).toBe("Workspace Patterns");
    });
  });

  describe("getAllBundles", () => {
    test("returns personal, workspace, and marketplace bundles", () => {
      const bundles = getAllBundles(testDb, "test-workspace", FIXTURES_PATH);

      expect(bundles.length).toBe(4); // 1 personal + 1 workspace + 2 marketplace

      // Check personal bundle
      const personalBundle = bundles.find((b) => b.id === "user");
      expect(personalBundle).toBeDefined();
      expect(personalBundle?.type).toBe("personal");
      expect(personalBundle?.name).toBe("Test User's Patterns");

      // Check workspace bundle
      const workspaceBundle = bundles.find((b) => b.id === "workspace");
      expect(workspaceBundle).toBeDefined();
      expect(workspaceBundle?.type).toBe("workspace");
      expect(workspaceBundle?.name).toBe("Test Workspace Patterns");

      // Check marketplace bundles
      const marketplaceBundles = bundles.filter((b) => b.type === "marketplace");
      expect(marketplaceBundles.length).toBe(2);
    });

    test("omits workspace bundle when workspace does not exist", () => {
      const bundles = getAllBundles(testDb, "nonexistent", FIXTURES_PATH);

      expect(bundles.length).toBe(3); // 1 personal + 0 workspace + 2 marketplace

      const workspaceBundle = bundles.find((b) => b.id === "workspace");
      expect(workspaceBundle).toBeUndefined();
    });
  });

  describe("getBundleById", () => {
    test("returns personal bundle when id is 'user'", () => {
      const bundle = getBundleById("user", testDb, "test-workspace", FIXTURES_PATH);

      expect(bundle).toBeDefined();
      expect(bundle?.id).toBe("user");
      expect(bundle?.type).toBe("personal");
    });

    test("returns workspace bundle when id is 'workspace'", () => {
      const bundle = getBundleById("workspace", testDb, "test-workspace", FIXTURES_PATH);

      expect(bundle).toBeDefined();
      expect(bundle?.id).toBe("workspace");
      expect(bundle?.type).toBe("workspace");
    });

    test("returns marketplace bundle for marketplace bundle id", () => {
      const bundle = getBundleById("test-bundle-01", testDb, "test-workspace", FIXTURES_PATH);

      expect(bundle).toBeDefined();
      expect(bundle?.id).toBe("test-bundle-01");
      expect(bundle?.type).toBe("marketplace");
    });

    test("returns null for non-existent bundle", () => {
      const bundle = getBundleById("nonexistent", testDb, "test-workspace", FIXTURES_PATH);
      expect(bundle).toBeNull();
    });

    test("returns null for workspace bundle when workspace does not exist", () => {
      const bundle = getBundleById("workspace", testDb, "nonexistent", FIXTURES_PATH);
      expect(bundle).toBeNull();
    });
  });
});
